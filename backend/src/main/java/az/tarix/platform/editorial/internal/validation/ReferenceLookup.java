package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.shared.content.DocumentType;

/**
 * Whether another document exists. References are slugs (EntityRef rule), so the target is
 * looked up among editorial documents: that works before anything is projected, and it is
 * where every target lives anyway.
 */
public interface ReferenceLookup {

    enum Target {
        /** No document, or only an archived one. */
        MISSING,
        /** A {@code PLANNED_ENTITY} announces it (future content). */
        PLANNED,
        /** Exists but has never been published: the link will not work publicly yet. */
        UNPUBLISHED,
        PUBLISHED
    }

    Target find(DocumentType type, String slug);
}
