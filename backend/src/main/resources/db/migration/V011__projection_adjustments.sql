-- Projection adjustments for phase 6 (docs/adr/0012-projection.md).

-- Images and audio are inline in today's content (no media registry until phase 11). Keep
-- them as written, so nothing is lost; phase 11 turns them into media_asset rows.
ALTER TABLE person ADD COLUMN portrait jsonb;                   -- main card image (ImageAsset)
ALTER TABLE hero ADD COLUMN photo jsonb;                        -- {url, source, license, permissionNote}
ALTER TABLE polity ADD COLUMN emblem jsonb;                     -- ImageAsset
ALTER TABLE ruler ADD COLUMN portraits jsonb NOT NULL DEFAULT '[]';
ALTER TABLE portrait ADD COLUMN image jsonb;                    -- {src, license, author, source, sourceUrl}
ALTER TABLE soundtrack_track ADD COLUMN file_path text;

-- Only an explicit placeId is stored. "Nearest place within 30 km" (frontend matchPlace) is
-- resolved when querying: at publish time it would depend on the order documents arrive in.
COMMENT ON COLUMN simulation_step.location_place_slug IS 'explicit placeId only; nearest place is resolved at query time (ADR-0012)';
COMMENT ON COLUMN simulation_step.from_location_place_slug IS 'explicit placeId only (ADR-0012)';
