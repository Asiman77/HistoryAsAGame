package az.tarix.platform.shared.read;

import az.tarix.platform.shared.content.DocumentType;

/**
 * No published entity with this slug (404). When the slug was renamed, the public API answers
 * with a redirect to the new one instead ({@code slug_redirect}, BACKEND_SPEC.md §5.5).
 *
 * @param type    the document type that owns the slug space
 * @param slug    the slug that was asked for
 * @param stepKey a step inside the entity that was not found, or null when the entity itself is missing
 */
public class ResourceNotFoundException extends RuntimeException {

    private final DocumentType type;
    private final String slug;
    private final String stepKey;

    public ResourceNotFoundException(DocumentType type, String slug) {
        this(type, slug, null);
    }

    public ResourceNotFoundException(DocumentType type, String slug, String stepKey) {
        super(stepKey == null
                ? "%s '%s' tapılmadı".formatted(type.name(), slug)
                : "%s '%s' daxilində '%s' addımı tapılmadı".formatted(type.name(), slug, stepKey));
        this.type = type;
        this.slug = slug;
        this.stepKey = stepKey;
    }

    public DocumentType type() {
        return type;
    }

    public String slug() {
        return slug;
    }

    public String stepKey() {
        return stepKey;
    }
}
