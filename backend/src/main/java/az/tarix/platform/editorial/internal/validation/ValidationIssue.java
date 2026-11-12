package az.tarix.platform.editorial.internal.validation;

/**
 * One finding of the pre-publish check (BACKEND_SPEC.md §8.3).
 *
 * @param level   ERROR blocks publishing; WARNING and INFO do not
 * @param code    stable machine-readable rule id, e.g. {@code fact-without-source}
 * @param pointer JSON Pointer into the content ({@code /events/3/claims/0}); "/" = whole document
 * @param message for editors, in Azerbaijani
 */
public record ValidationIssue(Level level, String code, String pointer, String message) {

    public enum Level { ERROR, WARNING, INFO }
}
