-- Static export (phase 13, docs/adr/0019-static-export.md). Documents that share one data file
-- (places.json, rulers.json, heroes.json…) are written back in the authored order, which jsonb
-- and the document table do not keep. NULL: after the positioned ones, oldest first.
ALTER TABLE editorial_document ADD COLUMN position int CHECK (position >= 0);
COMMENT ON COLUMN editorial_document.position IS 'order inside the shared data file it is exported to (ADR-0019)';
