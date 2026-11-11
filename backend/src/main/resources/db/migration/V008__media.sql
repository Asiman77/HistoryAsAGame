-- media module. media_asset is a write model (registered uploads, licence and permission);
-- portrait and soundtrack_track are projections owned by editorial documents.

CREATE TABLE media_asset (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  storage_key          text NOT NULL UNIQUE,
  media_type           varchar(16) NOT NULL CHECK (media_type IN ('IMAGE', 'AUDIO', 'GEOJSON')),
  mime_type            varchar(100),
  size_bytes           bigint CHECK (size_bytes >= 0),
  width                int CHECK (width > 0),
  height               int CHECK (height > 0),
  duration_ms          int CHECK (duration_ms >= 0),
  checksum             bytea,
  title                jsonb CHECK (is_localized_text(title)),
  caption              jsonb CHECK (is_localized_text(caption)),
  license              varchar(300) NOT NULL CHECK (length(trim(license)) > 0),
  source_url           text,
  rights_holder        text,
  permission_status    varchar(16) NOT NULL CHECK (permission_status IN ('PENDING', 'GRANTED', 'NOT_REQUIRED', 'DENIED')),
  is_ai_generated      boolean NOT NULL DEFAULT false,
  ai_disclosure_label  jsonb CHECK (is_localized_text(ai_disclosure_label)),
  uploaded_by          uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  version              bigint NOT NULL DEFAULT 0,
  CONSTRAINT media_asset_ai_label_chk CHECK (NOT is_ai_generated OR ai_disclosure_label IS NOT NULL)
);
CREATE INDEX media_asset_permission_idx ON media_asset (permission_status);

-- Portraits by age. age_from/age_to NULL = the main card image of the owner.
-- media_id NULL = a placeholder until the file exists (shown respectfully in the UI).
CREATE TABLE portrait (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_type   varchar(16) NOT NULL CHECK (owner_type IN ('PERSON', 'RULER', 'HERO', 'STATE', 'POLITY')),
  owner_slug   varchar(120) NOT NULL CHECK (is_slug(owner_slug)),
  age_from     int CHECK (age_from >= 0),
  age_to       int CHECK (age_to >= 0),
  media_id     uuid REFERENCES media_asset (id),
  kind         varchar(16) NOT NULL CHECK (kind IN ('HISTORICAL', 'ARTWORK', 'AI_ILLUSTRATION', 'PHOTO')),
  alt          jsonb NOT NULL CHECK (is_localized_text(alt)),
  caption      jsonb CHECK (is_localized_text(caption)),
  prompt_id    varchar(120) CHECK (is_slug(prompt_id)),
  sort_order   int NOT NULL DEFAULT 0,
  document_id  uuid NOT NULL,
  CONSTRAINT portrait_ages_chk CHECK ((age_from IS NULL) = (age_to IS NULL) AND (age_to IS NULL OR age_to >= age_from))
);
CREATE INDEX portrait_owner_idx ON portrait (owner_type, owner_slug);
CREATE INDEX portrait_media_idx ON portrait (media_id);
CREATE INDEX portrait_document_idx ON portrait (document_id);

CREATE TABLE soundtrack_track (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  slug               varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  conflict_slug      varchar(120) CHECK (is_slug(conflict_slug)),
  title              jsonb NOT NULL CHECK (is_localized_text(title)),
  performer          text NOT NULL,
  media_id           uuid REFERENCES media_asset (id),
  moods              text[] NOT NULL,
  license            varchar(300) NOT NULL,
  permission_status  varchar(16) NOT NULL CHECK (permission_status IN ('PENDING', 'GRANTED', 'NOT_REQUIRED', 'DENIED')),
  rights_holder      text NOT NULL,
  document_id        uuid NOT NULL
);
CREATE INDEX soundtrack_track_moods_idx ON soundtrack_track USING gin (moods);
CREATE INDEX soundtrack_track_media_idx ON soundtrack_track (media_id);
CREATE INDEX soundtrack_track_document_idx ON soundtrack_track (document_id);
