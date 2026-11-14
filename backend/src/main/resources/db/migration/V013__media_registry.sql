-- Media registry (phase 11, docs/adr/0017-media-registry.md). Nothing wrote media_asset before
-- this migration, so the new NOT NULL columns need no backfill.

-- UPLOAD: a file in the platform's bucket, uploaded through a presigned URL (storage_key = object key).
-- LINKED: a file outside the bucket that the content refers to as written: a path under the
--         frontend's public/ folder or an absolute URL (storage_key = that path or URL).
ALTER TABLE media_asset ADD COLUMN origin varchar(8) NOT NULL DEFAULT 'UPLOAD'
    CHECK (origin IN ('UPLOAD', 'LINKED'));
ALTER TABLE media_asset ALTER COLUMN origin DROP DEFAULT;
ALTER TABLE media_asset ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE media_asset ALTER COLUMN updated_at DROP DEFAULT;

-- An uploaded file was checked when it was registered: its type, size and checksum are known.
ALTER TABLE media_asset ADD CONSTRAINT media_asset_upload_chk CHECK (
    origin <> 'UPLOAD'
    OR (storage_key LIKE 'uploads/%' AND mime_type IS NOT NULL AND size_bytes IS NOT NULL AND checksum IS NOT NULL));
-- A linked file is referenced by its path under public/ or an absolute URL.
ALTER TABLE media_asset ADD CONSTRAINT media_asset_linked_chk CHECK (
    origin <> 'LINKED' OR storage_key LIKE '/%' OR storage_key LIKE 'http://%' OR storage_key LIKE 'https://%');

CREATE INDEX media_asset_created_idx ON media_asset (created_at DESC);

COMMENT ON COLUMN media_asset.origin IS 'UPLOAD = object in the media bucket; LINKED = path under public/ or absolute URL (ADR-0017)';
COMMENT ON COLUMN media_asset.storage_key IS 'UPLOAD: object key (uploads/…); LINKED: the path or URL as written in the content';
