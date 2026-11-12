package az.tarix.platform.editorial.api;

import java.util.UUID;

/**
 * A revision became the public version of its document. The publishing module projects it
 * into the read model (ADR-0001). Stored in the event publication registry, so it is retried
 * until a listener completes it.
 */
public record ContentPublished(UUID documentId, DocumentType docType, String slug, UUID revisionId, int revisionNo) {}
