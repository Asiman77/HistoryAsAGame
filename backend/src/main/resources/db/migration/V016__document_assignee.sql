-- Review assignment (BACKEND_SPEC.md §11 GET /documents?assignedToMe=): the reviewer or admin
-- who is expected to review the document. Null: nobody in particular.
ALTER TABLE editorial_document ADD COLUMN assignee_id uuid REFERENCES app_user (id);
CREATE INDEX editorial_document_assignee_idx ON editorial_document (assignee_id) WHERE assignee_id IS NOT NULL;
