-- editorial module: the write side (ADR-0001). Every unit of content is a document with
-- immutable JSONB revisions; reviews, transitions and slug redirects hang off it.
-- Content layout per document type: docs/adr/0011-editorial-content-layout.md.

CREATE TABLE editorial_document (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  doc_type               varchar(32) NOT NULL CHECK (doc_type IN (
                           'PERSON', 'CONFLICT', 'BATTLE', 'STATE', 'PLACE', 'POLITY', 'RULER', 'ERA', 'THEME',
                           'TERRITORY_SNAPSHOT', 'HERO', 'SOURCE', 'GLOSSARY_ENTRY', 'COMMEMORATION', 'WORLD_EVENT',
                           'PLANNED_ENTITY', 'SOUNDTRACK_TRACK', 'TERRITORY_REGISTRY')),
  slug                   varchar(120) NOT NULL CHECK (is_slug(slug)),
  -- Azerbaijani title of the current revision, for lists and search (derived, never edited).
  title                  varchar(500),
  status                 varchar(32) NOT NULL CHECK (status IN (
                           'DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED', 'ARCHIVED')),
  current_revision_id    uuid,
  published_revision_id  uuid,
  created_by             uuid NOT NULL REFERENCES app_user (id),
  created_at             timestamptz NOT NULL,
  updated_at             timestamptz NOT NULL,
  version                bigint NOT NULL DEFAULT 0,      -- optimistic locking (If-Match)
  CONSTRAINT editorial_document_type_slug_uq UNIQUE (doc_type, slug)
);
CREATE INDEX editorial_document_status_idx ON editorial_document (status, doc_type);
CREATE INDEX editorial_document_created_by_idx ON editorial_document (created_by);
CREATE INDEX editorial_document_title_trgm_idx ON editorial_document USING gin (az_fold(title) gin_trgm_ops);

-- Revisions are never updated or deleted; a revert writes a new revision.
CREATE TABLE editorial_revision (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  document_id     uuid NOT NULL REFERENCES editorial_document (id),
  revision_no     int NOT NULL CHECK (revision_no >= 1),
  schema_version  int NOT NULL CHECK (schema_version >= 1),
  content         jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  -- SHA-256 of the canonical JSON (keys sorted): unchanged content does not make a new revision.
  content_hash    bytea NOT NULL CHECK (length(content_hash) = 32),
  author_id       uuid NOT NULL REFERENCES app_user (id),
  change_note     text,
  created_at      timestamptz NOT NULL,
  CONSTRAINT editorial_revision_no_uq UNIQUE (document_id, revision_no)
);

-- Pointers from a document to its revisions. Deferred: a document and its first revision are
-- inserted in one transaction, in either order.
ALTER TABLE editorial_document
  ADD CONSTRAINT editorial_document_current_fk FOREIGN KEY (current_revision_id)
    REFERENCES editorial_revision (id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT editorial_document_published_fk FOREIGN KEY (published_revision_id)
    REFERENCES editorial_revision (id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE review_comment (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  revision_id  uuid NOT NULL REFERENCES editorial_revision (id),
  field_path   varchar(500) CHECK (field_path IS NULL OR field_path = '' OR field_path LIKE '/%'),  -- JSON Pointer
  body         text NOT NULL CHECK (length(trim(body)) > 0),
  author_id    uuid NOT NULL REFERENCES app_user (id),
  resolved     boolean NOT NULL DEFAULT false,
  resolved_by  uuid REFERENCES app_user (id),
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL,
  updated_at   timestamptz NOT NULL,
  version      bigint NOT NULL DEFAULT 0,
  CONSTRAINT review_comment_resolved_chk CHECK (resolved = (resolved_at IS NOT NULL))
);
CREATE INDEX review_comment_revision_idx ON review_comment (revision_id);

-- Audit trail of every status change (and of edits that send a reviewed document back to DRAFT).
CREATE TABLE status_transition_log (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  document_id  uuid NOT NULL REFERENCES editorial_document (id),
  revision_id  uuid REFERENCES editorial_revision (id),     -- current revision at the time
  action       varchar(32) NOT NULL,
  from_status  varchar(32),
  to_status    varchar(32) NOT NULL,
  actor_id     uuid NOT NULL REFERENCES app_user (id),
  comment      text,
  created_at   timestamptz NOT NULL
);
CREATE INDEX status_transition_log_document_idx ON status_transition_log (document_id, created_at);

CREATE TABLE slug_redirect (
  doc_type    varchar(32) NOT NULL,
  old_slug    varchar(120) NOT NULL CHECK (is_slug(old_slug)),
  new_slug    varchar(120) NOT NULL CHECK (is_slug(new_slug)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_type, old_slug),
  CONSTRAINT slug_redirect_not_self_chk CHECK (old_slug <> new_slug)
);

-- Why a GeoJSON geometry is unusable for PostGIS, or NULL when it is valid. Used by the
-- pre-publish validation. Never raises (malformed input comes back as the error text), so a
-- check inside the publish transaction cannot abort it.
CREATE FUNCTION geojson_problem(input text) RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE
  g geometry;
BEGIN
  g := ST_GeomFromGeoJSON(input);
  IF ST_IsValid(g) THEN
    RETURN NULL;
  END IF;
  RETURN ST_IsValidReason(g);
EXCEPTION WHEN others THEN
  RETURN SQLERRM;
END
$$;

-- One row; bumped by every publish (phase 6) and used for ETags of the public API.
CREATE TABLE content_version (
  id     smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  value  bigint NOT NULL CHECK (value >= 0)
);
INSERT INTO content_version (id, value) VALUES (1, 0);
