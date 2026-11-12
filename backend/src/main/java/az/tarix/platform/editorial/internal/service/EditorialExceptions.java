package az.tarix.platform.editorial.internal.service;

import az.tarix.platform.editorial.internal.validation.ValidationReport;

/** Failures of editorial requests; the web layer turns each into a Problem Details response. */
public final class EditorialExceptions {

    private EditorialExceptions() {}

    /** 404: no such document, revision or comment. */
    public static class NotFound extends RuntimeException {
        public NotFound(String message) {
            super(message);
        }
    }

    /** 428 when {@code If-Match} is missing, 412 when it names another version. */
    public static class PreconditionFailed extends RuntimeException {
        private final boolean missing;
        private final long currentVersion;

        public PreconditionFailed(boolean missing, long currentVersion, String message) {
            super(message);
            this.missing = missing;
            this.currentVersion = currentVersion;
        }

        public boolean missing() {
            return missing;
        }

        public long currentVersion() {
            return currentVersion;
        }
    }

    /** 413: content above {@link DocumentService#MAX_CONTENT_CHARS}. */
    public static class ContentTooLarge extends RuntimeException {
        public ContentTooLarge(String message) {
            super(message);
        }
    }

    /** 422: publish refused because the validation report has errors. */
    public static class PublishBlocked extends RuntimeException {
        private final ValidationReport report;

        public PublishBlocked(ValidationReport report) {
            super("Validasiya xətaları dərci bloklayır (%d xəta).".formatted(report.errors().size()));
            this.report = report;
        }

        public ValidationReport report() {
            return report;
        }
    }
}
