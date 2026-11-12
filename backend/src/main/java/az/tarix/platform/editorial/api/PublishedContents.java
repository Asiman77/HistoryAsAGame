package az.tarix.platform.editorial.api;

import az.tarix.platform.shared.content.PublishedContent;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Read access to the public revisions, for the publishing module. */
public interface PublishedContents {

    /** The public revision of a document; empty when it has none or the document is archived. */
    Optional<PublishedContent> of(UUID documentId);

    /** Every document that has a public revision and is not archived (for a rebuild). */
    List<UUID> publishedDocumentIds();
}
