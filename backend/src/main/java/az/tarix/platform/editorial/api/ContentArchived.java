package az.tarix.platform.editorial.api;

import java.util.UUID;

/**
 * A document was archived. If it had a public version, its projection rows must go
 * ({@code wasPublished}); otherwise there is nothing to remove.
 */
public record ContentArchived(UUID documentId, DocumentType docType, String slug, boolean wasPublished) {}
