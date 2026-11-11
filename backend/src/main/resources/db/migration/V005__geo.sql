-- geo module projection: places and political territory snapshots (docs/ARCHITECTURE.md §3).
-- All geometries are WGS 84 (SRID 4326), coordinates as (lng, lat).

CREATE TABLE place (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  slug             varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  historical_name  jsonb NOT NULL CHECK (is_localized_text(historical_name)),
  modern_name      jsonb CHECK (is_localized_text(modern_name)),
  place_type       varchar(16) NOT NULL CHECK (place_type IN
                     ('CAPITAL', 'CITY', 'FORTRESS', 'SHRINE', 'BATTLEFIELD', 'PORT', 'VILLAGE', 'REGION')),
  location         geometry(Point, 4326) NOT NULL,
  importance       smallint NOT NULL CHECK (importance BETWEEN 1 AND 3),   -- 1 = always visible
  description      jsonb CHECK (is_localized_text(description)),
  sources          jsonb NOT NULL DEFAULT '[]',
  document_id      uuid NOT NULL
);
CREATE INDEX place_location_idx ON place USING gist (location);
CREATE INDEX place_importance_idx ON place (importance);
CREATE INDEX place_historical_name_trgm_idx ON place USING gin (az_fold(historical_name ->> 'az') gin_trgm_ops);
CREATE INDEX place_modern_name_trgm_idx ON place USING gin (az_fold(modern_name ->> 'az') gin_trgm_ops);
CREATE INDEX place_document_idx ON place (document_id);

-- Years in which the place is shown on the map, optionally with the name used then.
CREATE TABLE place_period (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  place_id   uuid NOT NULL REFERENCES place (id) ON DELETE CASCADE,
  from_year  int NOT NULL,
  to_year    int NOT NULL,
  name       jsonb CHECK (is_localized_text(name)),
  CONSTRAINT place_period_years_chk CHECK (to_year >= from_year)
);
CREATE INDEX place_period_idx ON place_period (place_id, from_year, to_year);

-- Announced chapters of a place's history that have no simulation yet ("tezliklə").
CREATE TABLE place_upcoming (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  place_id    uuid NOT NULL REFERENCES place (id) ON DELETE CASCADE,
  year        int NOT NULL,
  title       jsonb NOT NULL CHECK (is_localized_text(title)),
  ref         jsonb,
  sources     jsonb NOT NULL DEFAULT '[]',
  sort_order  int NOT NULL DEFAULT 0
);
CREATE INDEX place_upcoming_idx ON place_upcoming (place_id);

-- Political map of one year. valid_to_year is computed on publish (next snapshot year - 1);
-- NULL means open-ended (the latest snapshot).
CREATE TABLE territory_snapshot (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  slug             varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  year             int NOT NULL,
  valid_from_year  int NOT NULL,
  valid_to_year    int,
  title            jsonb NOT NULL CHECK (is_localized_text(title)),
  certainty        varchar(16) NOT NULL CHECK (certainty IN ('EXACT', 'APPROXIMATE', 'DISPUTED')),
  note             jsonb CHECK (is_localized_text(note)),
  sources          jsonb NOT NULL DEFAULT '[]',
  document_id      uuid NOT NULL,
  CONSTRAINT territory_snapshot_validity_chk CHECK (valid_to_year IS NULL OR valid_to_year >= valid_from_year)
);
CREATE INDEX territory_snapshot_validity_idx ON territory_snapshot (valid_from_year, valid_to_year);
CREATE INDEX territory_snapshot_document_idx ON territory_snapshot (document_id);

-- One polity's area in a snapshot. Several rows may cover the same point (disputed areas).
CREATE TABLE polity_territory (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  snapshot_id          uuid NOT NULL REFERENCES territory_snapshot (id) ON DELETE CASCADE,
  polity_slug          varchar(120) NOT NULL CHECK (is_slug(polity_slug)),
  name                 jsonb NOT NULL CHECK (is_localized_text(name)),
  color                varchar(7) NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  geometry             geometry(MultiPolygon, 4326) NOT NULL CHECK (ST_IsValid(geometry)),
  -- Small-zoom version (ST_SimplifyPreserveTopology on publish); the API serves it by default.
  geometry_simplified  geometry(MultiPolygon, 4326) CHECK (geometry_simplified IS NULL OR ST_IsValid(geometry_simplified)),
  capital_place_slug   varchar(120) CHECK (is_slug(capital_place_slug)),
  vassal_of_slug       varchar(120) CHECK (is_slug(vassal_of_slug)),
  label_at             geometry(Point, 4326) NOT NULL,
  area_km2             double precision,
  certainty            varchar(16) CHECK (certainty IN ('EXACT', 'APPROXIMATE', 'DISPUTED')),
  sort_order           int NOT NULL DEFAULT 0
);
CREATE INDEX polity_territory_geometry_idx ON polity_territory USING gist (geometry);
CREATE INDEX polity_territory_geometry_simplified_idx ON polity_territory USING gist (geometry_simplified);
CREATE INDEX polity_territory_snapshot_idx ON polity_territory (snapshot_id);
CREATE INDEX polity_territory_polity_idx ON polity_territory (polity_slug);
