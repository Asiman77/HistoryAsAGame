-- Teacher classes (BACKEND_SPEC.md §7.3 identity, §12). Students have no accounts: they type the
-- class code into the site, and analytics events carry it (phase 12). A teacher sees only the
-- aggregated results of their own classes.
--
-- Codes: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L), upper case:
-- 31^6 ≈ 887 million codes, easy to read out in a classroom.

CREATE TABLE class_group (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  code        varchar(6) NOT NULL CHECK (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  name        varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
  teacher_id  uuid NOT NULL REFERENCES app_user (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  version     bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX class_group_code_uq ON class_group (code);
CREATE INDEX class_group_teacher_idx ON class_group (teacher_id);
