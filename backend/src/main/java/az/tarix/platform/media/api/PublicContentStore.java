package az.tarix.platform.media.api;

/**
 * The bucket of the static export ({@code public-content}, BACKEND_SPEC.md §15). Publishing
 * writes the exported files through this; the S3 details stay in the media module.
 */
public interface PublicContentStore {

    /** Writes one object (replacing it), e.g. {@code v42/data/places.json}. */
    void put(String key, byte[] body, String contentType, String cacheControl);

    /** The object's bytes, or null when there is none (the manifest of the last export). */
    byte[] get(String key);
}
