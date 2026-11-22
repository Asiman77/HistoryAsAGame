package az.tarix.platform.shared.read;

import az.tarix.platform.shared.content.DocumentType;
import java.util.Map;

/**
 * Editorial preview (BACKEND_SPEC.md §11 {@code GET /documents/{id}/preview}): a module renders a
 * document it has just projected in the public API format. The publishing module projects the
 * revision in a transaction it rolls back, calls every source and joins their parts, so it
 * needs no access to the modules' readers. {@code ctx} is a preview context: nothing is cached.
 */
public interface PreviewSource {

    /**
     * The public representations of the document this module serves, keyed by a short name
     * (e.g. {@code profile}, {@code steps}); empty when the type is not this module's.
     */
    Map<String, Object> preview(DocumentType type, String slug, ReadContext ctx);
}
