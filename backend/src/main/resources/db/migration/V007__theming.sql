-- theming module projection. A theme variant ("extends") is stored both as written (raw)
-- and merged over its parent (the other columns), so the API never has to resolve chains.

CREATE TABLE theme (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  slug               varchar(120) NOT NULL UNIQUE CHECK (is_slug(slug)),
  name               jsonb NOT NULL CHECK (is_localized_text(name)),
  extends_slug       varchar(120) CHECK (is_slug(extends_slug)),
  raw                jsonb NOT NULL,
  palette            jsonb NOT NULL,
  fonts              jsonb NOT NULL,
  textures           jsonb NOT NULL,
  ornaments          jsonb NOT NULL,
  background_art     jsonb NOT NULL DEFAULT '[]',
  mood_overrides     jsonb NOT NULL DEFAULT '{}',
  ambient_effect     varchar(16) NOT NULL CHECK (ambient_effect IN ('NONE', 'DUST', 'CANDLE', 'EMBERS', 'MIST')),
  map_style_variant  varchar(16) NOT NULL CHECK (map_style_variant IN ('MANUSCRIPT', 'MINIATURE', 'MILITARY', 'MODERN')),
  music_theme_slug   varchar(120) NOT NULL CHECK (is_slug(music_theme_slug)),
  document_id        uuid NOT NULL
);
CREATE INDEX theme_extends_idx ON theme (extends_slug);
CREATE INDEX theme_document_idx ON theme (document_id);
