-- catalog module projection (docs/ARCHITECTURE.md §3, docs/adr/0007).
-- HistoricalDate columns: <x>_year/_month/_day/_precision/_certainty, <x>_sort_key (generated),
-- <x>_alternatives and <x>_note (jsonb). Cross-document links are slugs, see V004.

CREATE TABLE person (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  slug                   varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  name                   jsonb NOT NULL CHECK (is_localized_text(name)),
  short_name             jsonb CHECK (is_localized_text(short_name)),
  titles                 jsonb NOT NULL DEFAULT '[]',
  birth_year             int NOT NULL,
  birth_month            smallint,
  birth_day              smallint,
  birth_precision        varchar(8) NOT NULL,
  birth_certainty        varchar(16) NOT NULL,
  birth_sort_key         bigint GENERATED ALWAYS AS (historical_sort_key(birth_year, birth_month, birth_day)) STORED,
  birth_alternatives     jsonb,
  birth_note             jsonb CHECK (is_localized_text(birth_note)),
  death_year             int NOT NULL,
  death_month            smallint,
  death_day              smallint,
  death_precision        varchar(8) NOT NULL,
  death_certainty        varchar(16) NOT NULL,
  death_sort_key         bigint GENERATED ALWAYS AS (historical_sort_key(death_year, death_month, death_day)) STORED,
  death_alternatives     jsonb,
  death_note             jsonb CHECK (is_localized_text(death_note)),
  birth_location         jsonb NOT NULL,            -- Location as written (name, modernName, lat, lng)
  death_location         jsonb NOT NULL,
  birth_place_slug       varchar(120) CHECK (is_slug(birth_place_slug)),
  death_place_slug       varchar(120) CHECK (is_slug(death_place_slug)),
  short_bio              jsonb NOT NULL CHECK (is_localized_text(short_bio)),
  legacy                 jsonb NOT NULL CHECK (is_localized_text(legacy)),
  epigraph               jsonb,
  era_slugs              text[] NOT NULL,
  tags                   text[] NOT NULL DEFAULT '{}',
  theme_slug             varchar(120) CHECK (is_slug(theme_slug)),
  featured_order         int,
  document_id            uuid NOT NULL,
  CONSTRAINT person_birth_chk CHECK (is_historical_date(birth_year, birth_month, birth_day, birth_precision, birth_certainty)),
  CONSTRAINT person_death_chk CHECK (is_historical_date(death_year, death_month, death_day, death_precision, death_certainty)),
  CONSTRAINT person_lifespan_chk CHECK (death_sort_key >= birth_sort_key)
);
CREATE INDEX person_lifespan_idx ON person (birth_year, death_year);
CREATE INDEX person_eras_idx ON person USING gin (era_slugs);
CREATE INDEX person_name_trgm_idx ON person USING gin (az_fold(name ->> 'az') gin_trgm_ops);
CREATE INDEX person_document_idx ON person (document_id);

CREATE TABLE conflict (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  slug              varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  name              jsonb NOT NULL CHECK (is_localized_text(name)),
  display_title     jsonb CHECK (is_localized_text(display_title)),   -- "heading" in data
  years             varchar(40) NOT NULL,
  start_year        int,                                             -- from the first/last day, on publish
  start_month       smallint,
  start_day         smallint,
  start_precision   varchar(8),
  start_certainty   varchar(16),
  start_sort_key    bigint GENERATED ALWAYS AS (historical_sort_key(start_year, start_month, start_day)) STORED,
  end_year          int,
  end_month         smallint,
  end_day           smallint,
  end_precision     varchar(8),
  end_certainty     varchar(16),
  end_sort_key      bigint GENERATED ALWAYS AS (historical_sort_key(end_year, end_month, end_day)) STORED,
  summary           jsonb NOT NULL CHECK (is_localized_text(summary)),   -- "description" in data
  legacy            jsonb CHECK (is_localized_text(legacy)),
  intro_date        jsonb CHECK (is_localized_text(intro_date)),
  final_notes       jsonb NOT NULL DEFAULT '[]',
  era_slugs         text[] NOT NULL,
  theme_slug        varchar(120) CHECK (is_slug(theme_slug)),
  sources           jsonb NOT NULL DEFAULT '[]',
  document_id       uuid NOT NULL,
  CONSTRAINT conflict_start_chk CHECK (
    (start_year IS NULL AND start_month IS NULL AND start_day IS NULL AND start_precision IS NULL AND start_certainty IS NULL)
    OR is_historical_date(start_year, start_month, start_day, start_precision, start_certainty)),
  CONSTRAINT conflict_end_chk CHECK (
    (end_year IS NULL AND end_month IS NULL AND end_day IS NULL AND end_precision IS NULL AND end_certainty IS NULL)
    OR is_historical_date(end_year, end_month, end_day, end_precision, end_certainty))
);
CREATE INDEX conflict_name_trgm_idx ON conflict USING gin (az_fold(name ->> 'az') gin_trgm_ops);
CREATE INDEX conflict_document_idx ON conflict (document_id);

-- Settlements that changed hands in a war (owned by the CONFLICT document).
CREATE TABLE settlement (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  conflict_id  uuid NOT NULL REFERENCES conflict (id) ON DELETE CASCADE,
  slug         varchar(120) NOT NULL CHECK (is_slug(slug)),
  name         jsonb NOT NULL CHECK (is_localized_text(name)),
  district     jsonb NOT NULL CHECK (is_localized_text(district)),
  kind         varchar(16) NOT NULL CHECK (kind IN ('CITY', 'TOWN', 'VILLAGE', 'HEIGHT', 'DISTRICT')),
  location     geometry(Point, 4326),                          -- NULL: no reliable coordinate
  CONSTRAINT settlement_slug_uq UNIQUE (conflict_id, slug)
);
CREATE INDEX settlement_location_idx ON settlement USING gist (location);

CREATE TABLE commander (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  conflict_id  uuid NOT NULL REFERENCES conflict (id) ON DELETE CASCADE,
  slug         varchar(120) NOT NULL CHECK (is_slug(slug)),
  name         jsonb NOT NULL CHECK (is_localized_text(name)),
  position     jsonb NOT NULL CHECK (is_localized_text(position)),
  role         jsonb NOT NULL CHECK (is_localized_text(role)),
  step_keys    text[] NOT NULL DEFAULT '{}',
  sources      jsonb NOT NULL DEFAULT '[]',
  CONSTRAINT commander_slug_uq UNIQUE (conflict_id, slug)
);

CREATE TABLE battle (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  slug             varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  name             jsonb NOT NULL CHECK (is_localized_text(name)),
  conflict_slug    varchar(120) CHECK (is_slug(conflict_slug)),
  step_key         varchar(120) CHECK (is_slug(step_key)),      -- day of the conflict simulation
  dates            varchar(80),                                 -- as written, e.g. "4–8 noyabr 2020"
  date_year        int,
  date_month       smallint,
  date_day         smallint,
  date_precision   varchar(8),
  date_certainty   varchar(16),
  date_sort_key    bigint GENERATED ALWAYS AS (historical_sort_key(date_year, date_month, date_day)) STORED,
  place_slug       varchar(120) CHECK (is_slug(place_slug)),
  summary          jsonb NOT NULL CHECK (is_localized_text(summary)),
  sides            jsonb,
  commanders       jsonb,
  forces           jsonb,
  outcome          jsonb,
  significance     jsonb CHECK (is_localized_text(significance)),
  sources          jsonb NOT NULL DEFAULT '[]',
  document_id      uuid NOT NULL,
  CONSTRAINT battle_date_chk CHECK (
    (date_year IS NULL AND date_month IS NULL AND date_day IS NULL AND date_precision IS NULL AND date_certainty IS NULL)
    OR is_historical_date(date_year, date_month, date_day, date_precision, date_certainty))
);
CREATE INDEX battle_conflict_idx ON battle (conflict_slug);
CREATE INDEX battle_name_trgm_idx ON battle USING gin (az_fold(name ->> 'az') gin_trgm_ops);
CREATE INDEX battle_document_idx ON battle (document_id);

CREATE TABLE state_profile (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  slug          varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  polity_slug   varchar(120) NOT NULL CHECK (is_slug(polity_slug)),
  name          jsonb NOT NULL CHECK (is_localized_text(name)),
  years         varchar(40) NOT NULL,
  start_year    int,                                 -- from the steps, on publish
  end_year      int,
  summary       jsonb NOT NULL CHECK (is_localized_text(summary)),   -- "description" in data
  legacy        jsonb CHECK (is_localized_text(legacy)),
  image         jsonb,
  era_slugs     text[] NOT NULL,
  dynasty       text[] NOT NULL DEFAULT '{}',
  theme_slug    varchar(120) CHECK (is_slug(theme_slug)),
  sources       jsonb NOT NULL DEFAULT '[]',
  document_id   uuid NOT NULL,
  CONSTRAINT state_profile_years_chk CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year)
);
CREATE INDEX state_profile_name_trgm_idx ON state_profile USING gin (az_fold(name ->> 'az') gin_trgm_ops);
CREATE INDEX state_profile_document_idx ON state_profile (document_id);

CREATE TABLE hero (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  slug                   varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  conflict_slug          varchar(120) CHECK (is_slug(conflict_slug)),
  full_name              jsonb NOT NULL CHECK (is_localized_text(full_name)),
  rank                   jsonb NOT NULL CHECK (is_localized_text(rank)),
  posthumous             boolean NOT NULL,
  birth_place            jsonb CHECK (is_localized_text(birth_place)),
  birth_year             int,
  death_year             int,
  death_month            smallint,
  death_day              smallint,
  death_precision        varchar(8),
  death_certainty        varchar(16),
  death_sort_key         bigint GENERATED ALWAYS AS (historical_sort_key(death_year, death_month, death_day)) STORED,
  awards                 jsonb NOT NULL DEFAULT '[]',
  bio                    jsonb CHECK (is_localized_text(bio)),
  photo_media_id         uuid,
  is_real_modern_person  boolean NOT NULL DEFAULT true,
  sources                jsonb NOT NULL DEFAULT '[]',
  document_id            uuid NOT NULL,
  CONSTRAINT hero_death_chk CHECK (
    (death_year IS NULL AND death_month IS NULL AND death_day IS NULL AND death_precision IS NULL AND death_certainty IS NULL)
    OR is_historical_date(death_year, death_month, death_day, death_precision, death_certainty))
);
CREATE INDEX hero_conflict_idx ON hero (conflict_slug);
CREATE INDEX hero_name_trgm_idx ON hero USING gin (az_fold(full_name ->> 'az') gin_trgm_ops);
CREATE INDEX hero_document_idx ON hero (document_id);

-- Every step of every simulation: life events (PERSON), war days (CONFLICT), state stages (STATE).
CREATE TABLE simulation_step (
  id                            uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_type                    varchar(16) NOT NULL CHECK (owner_type IN ('PERSON', 'CONFLICT', 'STATE')),
  owner_slug                    varchar(120) NOT NULL CHECK (is_slug(owner_slug)),
  step_key                      varchar(120) NOT NULL CHECK (is_slug(step_key)),
  sequence                      int NOT NULL CHECK (sequence >= 0),
  step_kind                     varchar(16) NOT NULL CHECK (step_kind IN ('LIFE_EVENT', 'WAR_DAY', 'STATE_STEP')),
  date_year                     int NOT NULL,
  date_month                    smallint,
  date_day                      smallint,
  date_precision                varchar(8) NOT NULL,
  date_certainty                varchar(16) NOT NULL,
  date_sort_key                 bigint GENERATED ALWAYS AS (historical_sort_key(date_year, date_month, date_day)) STORED,
  date_alternatives             jsonb,
  date_note                     jsonb CHECK (is_localized_text(date_note)),
  title                         jsonb NOT NULL CHECK (is_localized_text(title)),
  factual_summary               jsonb CHECK (is_localized_text(factual_summary)),
  narrative                     jsonb CHECK (is_localized_text(narrative)),
  mood                          varchar(16) NOT NULL CHECK (mood IN
                                  ('BIRTH', 'CHILDHOOD', 'HARDSHIP', 'EXILE', 'JOURNEY', 'RISE', 'CORONATION', 'BATTLE',
                                   'VICTORY', 'DEFEAT', 'PEACE', 'DIPLOMACY', 'CULTURE', 'DECLINE', 'DEATH',
                                   'REMEMBRANCE', 'TRIUMPH')),
  claim_type                    varchar(16) NOT NULL DEFAULT 'FACT' CHECK (claim_type IN ('FACT', 'DISPUTED', 'LEGEND', 'LITERARY')),
  location_name                 jsonb NOT NULL CHECK (is_localized_text(location_name)),
  location_modern_name          jsonb CHECK (is_localized_text(location_modern_name)),
  location_point                geometry(Point, 4326) NOT NULL,
  location_approximate          boolean NOT NULL DEFAULT false,
  location_place_slug           varchar(120) CHECK (is_slug(location_place_slug)),   -- explicit placeId or nearest within 30 km
  from_location_name            jsonb CHECK (is_localized_text(from_location_name)),
  from_location_modern_name     jsonb CHECK (is_localized_text(from_location_modern_name)),
  from_location_point           geometry(Point, 4326),
  from_location_approximate     boolean,
  from_location_place_slug      varchar(120) CHECK (is_slug(from_location_place_slug)),
  route                         geometry(LineString, 4326),
  territory_snapshot_slug       varchar(120) CHECK (is_slug(territory_snapshot_slug)),
  theme_slug                    varchar(120) CHECK (is_slug(theme_slug)),
  age_at_event                  int CHECK (age_at_event >= 0),      -- PERSON steps only, on publish
  age_approximate               boolean,
  details                       jsonb NOT NULL DEFAULT '{}',        -- kind-specific: outcome, choice, quiz, liberated…
  document_id                   uuid NOT NULL,
  CONSTRAINT simulation_step_date_chk CHECK (is_historical_date(date_year, date_month, date_day, date_precision, date_certainty)),
  CONSTRAINT simulation_step_from_chk CHECK ((from_location_point IS NULL) = (from_location_name IS NULL)),
  CONSTRAINT simulation_step_key_uq UNIQUE (owner_type, owner_slug, step_key),
  CONSTRAINT simulation_step_sequence_uq UNIQUE (owner_type, owner_slug, sequence)
);
CREATE INDEX simulation_step_sort_idx ON simulation_step (date_sort_key);
CREATE INDEX simulation_step_on_this_day_idx ON simulation_step (date_month, date_day) WHERE date_precision = 'DAY';
CREATE INDEX simulation_step_place_idx ON simulation_step (location_place_slug);
CREATE INDEX simulation_step_from_place_idx ON simulation_step (from_location_place_slug);
CREATE INDEX simulation_step_location_idx ON simulation_step USING gist (location_point);
CREATE INDEX simulation_step_route_idx ON simulation_step USING gist (route);
CREATE INDEX simulation_step_title_trgm_idx ON simulation_step USING gin (az_fold(title ->> 'az') gin_trgm_ops);
CREATE INDEX simulation_step_document_idx ON simulation_step (document_id);

-- Individual statements of a step, classified as fact, disputed, legend or literary.
CREATE TABLE step_claim (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  step_id         uuid NOT NULL REFERENCES simulation_step (id) ON DELETE CASCADE,
  claim_key       varchar(120) NOT NULL CHECK (is_slug(claim_key)),
  claim_type      varchar(16) NOT NULL CHECK (claim_type IN ('FACT', 'DISPUTED', 'LEGEND', 'LITERARY')),
  text            jsonb NOT NULL CHECK (is_localized_text(text)),
  why             jsonb CHECK (is_localized_text(why)),
  versions        jsonb,
  first_recorded  jsonb,
  sort_order      int NOT NULL DEFAULT 0,
  CONSTRAINT step_claim_key_uq UNIQUE (step_id, claim_key)
);

-- Bibliographic sources, deduplicated across documents by content hash
-- (sha256 of title|author|url|type). Not owned by a document: unreferenced rows are
-- removed after each publish.
CREATE TABLE source (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  slug              varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  title             text NOT NULL,
  authors           text,
  publisher         text,
  year              int,
  url               text,
  source_type       varchar(16) NOT NULL CHECK (source_type IN ('BOOK', 'ARTICLE', 'ENCYCLOPEDIA', 'WEB', 'PRIMARY', 'DATASET')),
  reliability_note  jsonb CHECK (is_localized_text(reliability_note)),
  content_hash      bytea NOT NULL UNIQUE CHECK (length(content_hash) = 32)
);

CREATE TABLE step_source (
  step_id     uuid NOT NULL REFERENCES simulation_step (id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES source (id),
  locator     text,                        -- page, chapter or remark ("Source.note" in data)
  sort_order  int NOT NULL,
  PRIMARY KEY (step_id, sort_order)
);
CREATE INDEX step_source_source_idx ON step_source (source_id);

CREATE TABLE claim_source (
  claim_id    uuid NOT NULL REFERENCES step_claim (id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES source (id),
  locator     text,
  sort_order  int NOT NULL,
  PRIMARY KEY (claim_id, sort_order)
);
CREATE INDEX claim_source_source_idx ON claim_source (source_id);

-- Directed links between entities (and optionally their steps). The target may not exist yet.
CREATE TABLE entity_relation (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  source_type       varchar(16) NOT NULL CHECK (source_type IN
                      ('PERSON', 'CONFLICT', 'BATTLE', 'STATE', 'PLACE', 'POLITY', 'RULER', 'ERA', 'HERO')),
  source_slug       varchar(120) NOT NULL CHECK (is_slug(source_slug)),
  source_step_key   varchar(120) CHECK (is_slug(source_step_key)),
  target_type       varchar(16) NOT NULL CHECK (target_type IN
                      ('PERSON', 'CONFLICT', 'BATTLE', 'STATE', 'PLACE', 'POLITY', 'RULER', 'ERA', 'HERO')),
  target_slug       varchar(120) NOT NULL CHECK (is_slug(target_slug)),
  target_step_key   varchar(120) CHECK (is_slug(target_step_key)),
  relation_type     varchar(32) NOT NULL CHECK (relation_type IN
                      ('PARENT', 'GRANDPARENT', 'SPOUSE', 'SIBLING', 'ALLY', 'RIVAL', 'SUCCESSOR', 'CONTEMPORARY',
                       'PARTICIPATED_IN', 'RULED', 'LOCATED_IN', 'RELATED')),
  label             jsonb CHECK (is_localized_text(label)),
  note              jsonb CHECK (is_localized_text(note)),
  sources           jsonb NOT NULL DEFAULT '[]',
  sort_order        int NOT NULL DEFAULT 0,
  document_id       uuid NOT NULL
);
CREATE INDEX entity_relation_source_idx ON entity_relation (source_type, source_slug);
CREATE INDEX entity_relation_target_idx ON entity_relation (target_type, target_slug);
CREATE INDEX entity_relation_document_idx ON entity_relation (document_id);

CREATE TABLE glossary_entry (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  slug         varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  term         jsonb NOT NULL CHECK (is_localized_text(term)),
  definition   jsonb NOT NULL CHECK (is_localized_text(definition)),
  forms        text[] NOT NULL,
  sources      jsonb NOT NULL DEFAULT '[]',
  document_id  uuid NOT NULL
);
CREATE INDEX glossary_entry_term_trgm_idx ON glossary_entry USING gin (az_fold(term ->> 'az') gin_trgm_ops);
CREATE INDEX glossary_entry_document_idx ON glossary_entry (document_id);

-- Days with their own design in "Tarixdə bu gün".
CREATE TABLE commemoration (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  slug         varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  month        smallint NOT NULL,
  day          smallint NOT NULL,
  style        varchar(16) NOT NULL CHECK (style IN ('MEMORIAL', 'VICTORY', 'CELEBRATION')),
  title        jsonb NOT NULL CHECK (is_localized_text(title)),
  description  jsonb NOT NULL CHECK (is_localized_text(description)),
  ref          jsonb,
  sources      jsonb NOT NULL DEFAULT '[]',
  document_id  uuid NOT NULL,
  CONSTRAINT commemoration_day_chk CHECK (is_calendar_day(month, day))
);
CREATE INDEX commemoration_day_idx ON commemoration (month, day);
CREATE INDEX commemoration_document_idx ON commemoration (document_id);

-- "Meanwhile in the world".
CREATE TABLE world_event (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  slug         varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  year         int NOT NULL,
  end_year     int,
  region       varchar(16) NOT NULL CHECK (region IN ('EUROPE', 'MIDDLE_EAST', 'ASIA', 'AFRICA', 'AMERICAS')),
  title        jsonb NOT NULL CHECK (is_localized_text(title)),
  description  jsonb NOT NULL CHECK (is_localized_text(description)),
  sources      jsonb NOT NULL DEFAULT '[]',
  document_id  uuid NOT NULL,
  CONSTRAINT world_event_years_chk CHECK (end_year IS NULL OR end_year >= year)
);
CREATE INDEX world_event_years_idx ON world_event (year, end_year);
CREATE INDEX world_event_document_idx ON world_event (document_id);

-- Entities announced before their content exists ("tezliklə" cards and passive chips).
CREATE TABLE planned_entity (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  entity_type  varchar(16) NOT NULL CHECK (entity_type IN
                 ('PERSON', 'CONFLICT', 'BATTLE', 'STATE', 'PLACE', 'POLITY', 'RULER', 'ERA', 'HERO')),
  slug         varchar(120) NOT NULL CHECK (is_slug(slug)),
  title        jsonb NOT NULL CHECK (is_localized_text(title)),
  description  jsonb CHECK (is_localized_text(description)),
  years        varchar(40),
  document_id  uuid NOT NULL,
  CONSTRAINT planned_entity_uq UNIQUE (entity_type, slug)
);
CREATE INDEX planned_entity_document_idx ON planned_entity (document_id);
