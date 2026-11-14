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

    /**
     * Every public revision with its document's order (for the static export, ADR-0019), in one
     * query: sorted by position (unpositioned last), then creation time, then slug.
     */
    List<Positioned> allPublished();

    /** A public revision and where its document goes inside a shared data file (null: after the positioned ones). */
    record Positioned(PublishedContent content, Integer position) {}
}
