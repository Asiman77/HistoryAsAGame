package az.tarix.platform.editorial.api;

/** Workflow states of an editorial document (BACKEND_SPEC.md §8.1). */
public enum DocumentStatus {
    DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED, PUBLISHED, ARCHIVED
}
