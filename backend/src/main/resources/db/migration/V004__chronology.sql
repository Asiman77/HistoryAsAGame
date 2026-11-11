-- chronology module projection: eras, polities, rulers, reigns (docs/ARCHITECTURE.md §3).
-- Rows are owned by an editorial document (document_id) and rewritten on every publish.
-- Foreign keys only link rows of the same document; other documents are referenced by slug,
-- so republishing one document never blocks on or cascades into another.

CREATE TABLE era (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  slug          varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  name          jsonb NOT NULL CHECK (is_localized_text(name)),
  start_year    int NOT NULL,
  end_year      int NOT NULL,
  description   jsonb CHECK (is_localized_text(description)),
  theme_slug    varchar(120) CHECK (is_slug(theme_slug)),
  color         varchar(7) CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order    int NOT NULL DEFAULT 0,
  document_id   uuid NOT NULL,
  CONSTRAINT era_years_chk CHECK (end_year >= start_year)
);
CREATE INDEX era_years_idx ON era (start_year, end_year);
CREATE INDEX era_document_idx ON era (document_id);

CREATE TABLE polity (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  slug             varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  name             jsonb NOT NULL CHECK (is_localized_text(name)),
  short_name       jsonb CHECK (is_localized_text(short_name)),
  color            varchar(7) NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  emblem_media_id  uuid,
  start_year       int NOT NULL,          -- min of polity_period.from_year
  end_year         int NOT NULL,          -- max of polity_period.to_year
  state_slug       varchar(120) CHECK (is_slug(state_slug)),
  description      jsonb CHECK (is_localized_text(description)),
  document_id      uuid NOT NULL,
  CONSTRAINT polity_years_chk CHECK (end_year >= start_year)
);
CREATE INDEX polity_years_idx ON polity (start_year, end_year);
CREATE INDEX polity_document_idx ON polity (document_id);

CREATE TABLE polity_period (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  polity_id  uuid NOT NULL REFERENCES polity (id) ON DELETE CASCADE,
  from_year  int NOT NULL,
  to_year    int NOT NULL,
  CONSTRAINT polity_period_years_chk CHECK (to_year >= from_year)
);
CREATE INDEX polity_period_idx ON polity_period (polity_id, from_year, to_year);

CREATE TABLE polity_fact (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  polity_id    uuid NOT NULL REFERENCES polity (id) ON DELETE CASCADE,
  from_year    int NOT NULL,
  to_year      int NOT NULL,
  status       varchar(16) NOT NULL CHECK (status IN ('RISE', 'PEAK', 'STABLE', 'WAR', 'CRISIS', 'DECLINE')),
  status_note  jsonb NOT NULL CHECK (is_localized_text(status_note)),
  religion     jsonb CHECK (is_localized_text(religion)),
  languages    jsonb CHECK (is_localized_text(languages)),
  rivals       text[] NOT NULL DEFAULT '{}',
  allies       text[] NOT NULL DEFAULT '{}',
  sources      jsonb NOT NULL DEFAULT '[]',
  sort_order   int NOT NULL DEFAULT 0,
  CONSTRAINT polity_fact_years_chk CHECK (to_year >= from_year)
);
CREATE INDEX polity_fact_idx ON polity_fact (polity_id, from_year, to_year);

CREATE TABLE ruler (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  slug              varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  name              jsonb NOT NULL CHECK (is_localized_text(name)),
  titles            jsonb NOT NULL DEFAULT '[]',
  dynasty           jsonb CHECK (is_localized_text(dynasty)),
  birth_year        int,
  birth_month       smallint,
  birth_day         smallint,
  birth_precision   varchar(8),
  birth_certainty   varchar(16),
  birth_sort_key    bigint GENERATED ALWAYS AS (historical_sort_key(birth_year, birth_month, birth_day)) STORED,
  death_year        int,
  death_month       smallint,
  death_day         smallint,
  death_precision   varchar(8),
  death_certainty   varchar(16),
  death_sort_key    bigint GENERATED ALWAYS AS (historical_sort_key(death_year, death_month, death_day)) STORED,
  person_slug       varchar(120) CHECK (is_slug(person_slug)),
  related           jsonb NOT NULL DEFAULT '[]',
  sources           jsonb NOT NULL DEFAULT '[]',
  document_id       uuid NOT NULL,
  CONSTRAINT ruler_birth_chk CHECK (
    (birth_year IS NULL AND birth_month IS NULL AND birth_day IS NULL AND birth_precision IS NULL AND birth_certainty IS NULL)
    OR is_historical_date(birth_year, birth_month, birth_day, birth_precision, birth_certainty)),
  CONSTRAINT ruler_death_chk CHECK (
    (death_year IS NULL AND death_month IS NULL AND death_day IS NULL AND death_precision IS NULL AND death_certainty IS NULL)
    OR is_historical_date(death_year, death_month, death_day, death_precision, death_certainty))
);
CREATE INDEX ruler_name_trgm_idx ON ruler USING gin (az_fold(name ->> 'az') gin_trgm_ops);
CREATE INDEX ruler_person_idx ON ruler (person_slug);
CREATE INDEX ruler_document_idx ON ruler (document_id);

-- Who ruled which polity when. Overlaps are allowed on purpose (co-rulers, rival claimants).
-- Owned by the POLITY document; the ruler is referenced by slug (another document).
CREATE TABLE reign (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  polity_id    uuid NOT NULL REFERENCES polity (id) ON DELETE CASCADE,
  ruler_slug   varchar(120) NOT NULL CHECK (is_slug(ruler_slug)),
  start_year   int NOT NULL,
  start_month  smallint CHECK (start_month BETWEEN 1 AND 12),
  start_day    smallint CHECK (start_day BETWEEN 1 AND 31),
  end_year     int,                     -- NULL: still ruling / open-ended
  end_month    smallint CHECK (end_month BETWEEN 1 AND 12),
  end_day      smallint CHECK (end_day BETWEEN 1 AND 31),
  certainty    varchar(16) NOT NULL CHECK (certainty IN ('EXACT', 'APPROXIMATE', 'DISPUTED')),
  note         jsonb CHECK (is_localized_text(note)),
  sort_order   int NOT NULL DEFAULT 0,
  CONSTRAINT reign_years_chk CHECK (end_year IS NULL OR end_year >= start_year)
);
CREATE INDEX reign_polity_years_idx ON reign (polity_id, start_year, end_year);
CREATE INDEX reign_ruler_idx ON reign (ruler_slug);
