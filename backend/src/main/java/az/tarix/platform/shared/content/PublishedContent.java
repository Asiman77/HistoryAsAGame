package az.tarix.platform.shared.content;

import java.util.UUID;
import tools.jackson.databind.JsonNode;

/**
 * The public revision of a document, as handed to the projection writers. {@code content}
 * follows the layout of {@link DocumentType} (docs/adr/0011-editorial-content-layout.md).
 */
public record PublishedContent(UUID documentId, DocumentType type, String slug, UUID revisionId, int revisionNo,
                               JsonNode content) {

    /** One part of the content, e.g. {@code part("events")}; a missing node when absent. */
    public JsonNode part(String key) {
        return content.path(key);
    }
}
