package az.tarix.platform.editorial.internal.domain;

/** The action does not fit the document's current state (HTTP 409). */
public class WorkflowViolationException extends RuntimeException {

    private final String code;

    public WorkflowViolationException(String code, String message) {
        super(message);
        this.code = code;
    }

    /** Short machine-readable reason, e.g. {@code invalid-transition}, {@code archived}. */
    public String code() {
        return code;
    }
}
