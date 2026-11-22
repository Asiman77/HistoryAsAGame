package az.tarix.platform.editorial.internal.domain;

import java.util.Locale;

/**
 * What can happen to a document. The first five are requested through
 * {@code POST /documents/{id}/transitions}; CREATE and EDIT are logged by the document service,
 * IMPORT by the data importer.
 */
public enum Action {
    SUBMIT, APPROVE, REQUEST_CHANGES, PUBLISH, ARCHIVE,
    /** First revision. */
    CREATE,
    /** A new revision (edit or revert) that sent a reviewed or published document back to DRAFT. */
    EDIT,
    /** Published by the data importer without review (ADR-0013); the actor is the admin who ran the import. */
    IMPORT,
    /** The reviewer assignment changed (status unchanged); the comment names the new assignee. */
    ASSIGN;

    /** The spelling used in the API: {@code request_changes}. */
    public String apiName() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** Parses an API action; only the five workflow actions are accepted. */
    public static Action fromApi(String value) {
        for (Action a : new Action[] {SUBMIT, APPROVE, REQUEST_CHANGES, PUBLISH, ARCHIVE}) {
            if (a.apiName().equals(value)) return a;
        }
        throw new IllegalArgumentException("unknown action: " + value);
    }
}
