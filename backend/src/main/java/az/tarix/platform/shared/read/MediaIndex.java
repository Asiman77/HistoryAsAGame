package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.PermissionStatus;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/**
 * The media registry as the public API sees it (ADR-0017): content references
 * ({@code media:<id>}, or a path / URL registered as a linked file) → the registered file.
 * Immutable; one per content version.
 */
public record MediaIndex(Map<String, MediaFile> byRef) {

    public static final MediaIndex EMPTY = new MediaIndex(Map.of());

    /** Prefix of a reference to a registered asset by id, e.g. {@code media:0193…}. */
    public static final String REF_PREFIX = "media:";

    public MediaIndex {
        byRef = Map.copyOf(byRef);
    }

    /** The registered file for a reference as written in the content, or null. */
    public MediaFile find(String ref) {
        return ref == null ? null : byRef.get(ref);
    }

    /** Whether the reference names a registry asset by id (and so is never a usable path by itself). */
    public static boolean isRegistryRef(String ref) {
        return ref != null && ref.startsWith(REF_PREFIX);
    }

    /**
     * A registered file.
     *
     * @param url          where browsers load it: the linked path or URL as written, or the
     *                     uploaded object's public URL (null when no public base URL is known)
     * @param aiDisclosure LocalizedText, or null
     */
    public record MediaFile(String url, PermissionStatus status, String license, String rightsHolder, String sourceUrl,
                            boolean aiGenerated, JsonNode aiDisclosure) {

        /** Whether it may be given out: public status and a URL. */
        public boolean isPublic() {
            return status.isPublic() && url != null;
        }
    }
}
