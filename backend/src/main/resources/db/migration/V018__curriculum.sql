-- Frontend redesign, package B2 (docs/FRONTEND_PLAN.md §11, docs/ARCHITECTURE.md §24):
-- the school curriculum. subject → grade → section → topic → the simulation steps the topic tells.
-- One editorial document per grade (CURRICULUM_GRADE); rows are rewritten on every publish.

ALTER TABLE editorial_document DROP CONSTRAINT editorial_document_doc_type_check;
ALTER TABLE editorial_document ADD CONSTRAINT editorial_document_doc_type_check CHECK (doc_type IN (
  'PERSON', 'CONFLICT', 'BATTLE', 'STATE', 'PLACE', 'POLITY', 'RULER', 'ERA', 'THEME',
  'TERRITORY_SNAPSHOT', 'HERO', 'SOURCE', 'GLOSSARY_ENTRY', 'COMMEMORATION', 'WORLD_EVENT',
  'PLANNED_ENTITY', 'SOUNDTRACK_TRACK', 'TERRITORY_REGISTRY', 'CURRICULUM_GRADE'));

CREATE TABLE curriculum_grade (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  slug         varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  subject      varchar(120) NOT NULL CHECK (is_slug(subject)),
  grade        smallint NOT NULL CHECK (grade BETWEEN 1 AND 11),
  title        jsonb NOT NULL CHECK (is_localized_text(title)),
  -- The approved textbook it follows: title, authors, year, publisher, url (reference only).
  textbook     jsonb,
  sample       boolean NOT NULL DEFAULT false,
  document_id  uuid NOT NULL,
  CONSTRAINT curriculum_grade_uq UNIQUE (subject, grade)
);
CREATE INDEX curriculum_grade_document_idx ON curriculum_grade (document_id);

CREATE TABLE curriculum_section (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  grade_id    uuid NOT NULL REFERENCES curriculum_grade (id) ON DELETE CASCADE,
  slug        varchar(120) NOT NULL CHECK (is_slug(slug)),
  title       jsonb NOT NULL CHECK (is_localized_text(title)),
  sort_order  int NOT NULL,
  CONSTRAINT curriculum_section_uq UNIQUE (grade_id, slug)
);

-- Topic slugs are addresses (/curriculum/topics/{slug}): unique across all grades.
CREATE TABLE curriculum_topic (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  section_id  uuid NOT NULL REFERENCES curriculum_section (id) ON DELETE CASCADE,
  slug        varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  title       jsonb NOT NULL CHECK (is_localized_text(title)),
  paragraph   varchar(20),
  summary     jsonb CHECK (is_localized_text(summary)),
  minutes     int CHECK (minutes > 0),
  sort_order  int NOT NULL
);
CREATE INDEX curriculum_topic_section_idx ON curriculum_topic (section_id, sort_order);

-- Steps by key, like cross-links: republishing a simulation never cascades into the curriculum.
CREATE TABLE curriculum_topic_step (
  topic_id    uuid NOT NULL REFERENCES curriculum_topic (id) ON DELETE CASCADE,
  sort_order  int NOT NULL,
  owner_type  varchar(16) NOT NULL CHECK (owner_type IN ('PERSON', 'CONFLICT', 'STATE')),
  owner_slug  varchar(120) NOT NULL CHECK (is_slug(owner_slug)),
  step_key    varchar(120) NOT NULL CHECK (is_slug(step_key)),
  PRIMARY KEY (topic_id, sort_order)
);
CREATE INDEX curriculum_topic_step_step_idx ON curriculum_topic_step (owner_type, owner_slug, step_key);
