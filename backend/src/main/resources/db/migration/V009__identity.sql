-- identity module: editor/admin accounts, roles and refresh tokens.
-- Students have no accounts (BACKEND_SPEC.md §22); teacher classes come with phase 10.

CREATE TABLE app_user (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  email          varchar(254) NOT NULL CHECK (email = lower(email) AND email LIKE '%_@_%'),
  password_hash  varchar(255),                -- NULL: cannot log in (e.g. the system-import user)
  display_name   varchar(120) NOT NULL CHECK (length(trim(display_name)) > 0),
  enabled        boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  version        bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX app_user_email_uq ON app_user (email);

CREATE TABLE user_role (
  user_id  uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  role     varchar(16) NOT NULL CHECK (role IN ('AUTHOR', 'REVIEWER', 'ADMIN', 'TEACHER')),
  PRIMARY KEY (user_id, role)
);

-- Opaque refresh tokens; only the SHA-256 of the token is stored. Every login starts a
-- family; each refresh revokes the used token and issues the next one in the same family.
-- Presenting a revoked token again (reuse) revokes the whole family.
CREATE TABLE refresh_token (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id      uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  family_id    uuid NOT NULL,
  token_hash   bytea NOT NULL CHECK (length(token_hash) = 32),
  created_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  replaced_by  uuid REFERENCES refresh_token (id),
  CONSTRAINT refresh_token_expiry_chk CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX refresh_token_hash_uq ON refresh_token (token_hash);
CREATE INDEX refresh_token_family_idx ON refresh_token (family_id);
CREATE INDEX refresh_token_user_idx ON refresh_token (user_id);
CREATE INDEX refresh_token_expires_idx ON refresh_token (expires_at);
