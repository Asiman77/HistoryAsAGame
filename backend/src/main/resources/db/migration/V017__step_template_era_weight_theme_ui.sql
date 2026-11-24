-- Frontend redesign, package B1 (docs/FRONTEND_PLAN.md §11, ADR-0022).
-- All three are optional in content: existing rows keep their meaning without a republish.

-- How the simulation shows a step on the map (FRONTEND_SPEC §5.2). NULL: the frontend derives it.
ALTER TABLE simulation_step ADD COLUMN template varchar(16) CHECK (template IN
  ('LOCATION', 'JOURNEY', 'BATTLE', 'TERRITORY', 'LIBERATION', 'INFOGRAPHIC', 'MONUMENT', 'ARTIFACT', 'MIGRATION', 'TREATY'));

-- Non-linear timeline: share of width per year relative to other eras. School subject of the era.
ALTER TABLE era
  ADD COLUMN weight numeric(6, 3) NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 100),
  ADD COLUMN subject varchar(120) NOT NULL DEFAULT 'azerbaijan-history' CHECK (is_slug(subject));
CREATE INDEX era_subject_idx ON era (subject, start_year);

-- Dark palette of the new design (ThemeUi). A variant's ui replaces the parent's, like background art.
ALTER TABLE theme ADD COLUMN ui jsonb CHECK (ui IS NULL OR jsonb_typeof(ui) = 'object');
