-- analytics module (phase 12, docs/adr/0018-analytics.md). Anonymous learning events.
-- Privacy by construction: there is no column for an IP address, a user agent or an account.
-- session_id is a random UUID the browser makes; it is not linked to anything.

CREATE TABLE learning_event (
  id           bigint GENERATED ALWAYS AS IDENTITY,
  received_at  timestamptz NOT NULL,                 -- server time; the partition key
  occurred_at  timestamptz NOT NULL,                 -- client time, clamped to [received - 48 h, received + 5 min]
  session_id   uuid NOT NULL,
  event_type   varchar(32) NOT NULL CHECK (event_type IN (
                 'simulation_started', 'step_viewed', 'simulation_completed', 'simulation_abandoned', 'quiz_answered',
                 'choice_made', 'mode_switched', 'cross_link_followed', 'legend_toggle', 'time_slider_used')),
  owner_type   varchar(16) CHECK (owner_type IN ('PERSON', 'CONFLICT', 'STATE')),
  owner_slug   varchar(120) CHECK (is_slug(owner_slug)),
  step_key     varchar(120) CHECK (is_slug(step_key)),
  class_code   varchar(6),
  detail       varchar(150) NOT NULL DEFAULT '',     -- what the event is about: q0, o2, story, person:x, 1501…
  payload      jsonb NOT NULL DEFAULT '{}',          -- only the typed fields of the event type (correct, durationMs)
  PRIMARY KEY (id, received_at),
  CONSTRAINT learning_event_owner_chk CHECK ((owner_type IS NULL) = (owner_slug IS NULL))
) PARTITION BY RANGE (received_at);

CREATE INDEX learning_event_occurred_idx ON learning_event (occurred_at);

-- Monthly partitions learning_event_YYYY_MM, from this month on for `months` more months.
-- Idempotent; the analytics module calls it on startup and every night.
CREATE FUNCTION analytics_ensure_partitions(months int) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  first_month date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  m date;
  created int := 0;
BEGIN
  FOR i IN 0..months LOOP
    m := (first_month + make_interval(months => i))::date;
    IF to_regclass(format('learning_event_%s', to_char(m, 'YYYY_MM'))) IS NULL THEN
      EXECUTE format('CREATE TABLE %I PARTITION OF learning_event FOR VALUES FROM (%L) TO (%L)',
                     format('learning_event_%s', to_char(m, 'YYYY_MM')),
                     (m::timestamp AT TIME ZONE 'UTC'),
                     ((m + interval '1 month')::timestamp AT TIME ZONE 'UTC'));
      created := created + 1;
    END IF;
  END LOOP;
  RETURN created;
END $$;

SELECT analytics_ensure_partitions(2);

-- Daily totals, kept after the raw events are gone (BACKEND_SPEC.md §12). Empty strings
-- instead of NULL in the key columns, so the key is a plain UNIQUE constraint.
CREATE TABLE daily_aggregate (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  day            date NOT NULL,                       -- in platform.analytics.zone (Asia/Baku)
  event_type     varchar(32) NOT NULL,
  owner_type     varchar(16) NOT NULL DEFAULT '',
  owner_slug     varchar(120) NOT NULL DEFAULT '',
  step_key       varchar(120) NOT NULL DEFAULT '',
  class_code     varchar(6) NOT NULL DEFAULT '',
  detail         varchar(150) NOT NULL DEFAULT '',
  count          bigint NOT NULL CHECK (count >= 0),
  sessions       bigint NOT NULL CHECK (sessions >= 0),   -- distinct sessions that day
  payload_stats  jsonb NOT NULL DEFAULT '{}',             -- {correct, wrong} for quizzes, {durationMsSum, durationMsCount}
  computed_at    timestamptz NOT NULL,
  CONSTRAINT daily_aggregate_key UNIQUE (day, event_type, owner_type, owner_slug, step_key, class_code, detail)
);
CREATE INDEX daily_aggregate_owner_idx ON daily_aggregate (owner_type, owner_slug, day);
CREATE INDEX daily_aggregate_class_idx ON daily_aggregate (class_code, day) WHERE class_code <> '';
CREATE INDEX daily_aggregate_type_idx ON daily_aggregate (event_type, day);

-- Drops the monthly partitions that end on or before `cutoff` (retention). Returns how many.
CREATE FUNCTION analytics_drop_partitions_before(cutoff timestamptz) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  part record;
  dropped int := 0;
BEGIN
  FOR part IN
    SELECT c.relname
    FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'learning_event' AND c.relname ~ '^learning_event_\d{4}_\d{2}$'
  LOOP
    IF (to_date(substr(part.relname, 16), 'YYYY_MM') + interval '1 month')::timestamp AT TIME ZONE 'UTC' <= cutoff THEN
      EXECUTE format('DROP TABLE %I', part.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  RETURN dropped;
END $$;
