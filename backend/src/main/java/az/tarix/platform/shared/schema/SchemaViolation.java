package az.tarix.platform.shared.schema;

/**
 * One JSON Schema error in a content document.
 *
 * @param pointer JSON Pointer to the offending value (RFC 6901), e.g. {@code /events/3/title/az};
 *                the same format review comments use for {@code field_path}
 * @param keyword the failing schema keyword ({@code required}, {@code pattern}, {@code format}…)
 * @param message human-readable message from the validator
 */
public record SchemaViolation(String pointer, String keyword, String message) {}
