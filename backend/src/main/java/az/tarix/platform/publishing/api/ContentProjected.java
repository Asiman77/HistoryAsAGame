package az.tarix.platform.publishing.api;

import java.util.UUID;

/**
 * The read model changed: one document was projected (or removed), or everything was
 * rebuilt ({@code documentId} null). {@code contentVersion} is the new value of
 * {@code content_version}, used for ETags; caches and the static export listen to this.
 */
public record ContentProjected(UUID documentId, long contentVersion) {

    public boolean rebuild() {
        return documentId == null;
    }
}
