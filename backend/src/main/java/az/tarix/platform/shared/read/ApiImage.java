package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.PermissionStatus;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/**
 * An image in the public API. Until the media registry exists (phase 11) images are inline in
 * the content; only those whose licence makes them public (ADR-0010) are ever returned
 * (BACKEND_SPEC.md §10: only {@code GRANTED} and {@code NOT_REQUIRED} media).
 *
 * @param url        path under the site root ({@code /portraits/…}) or an absolute URL
 * @param kind       portrait or art kind ({@code HISTORICAL}, {@code AI_ILLUSTRATION}, …), or null
 * @param disclosure label shown with AI illustrations ("Rəssam təsəvvürü (AI illüstrasiya)"), or null
 */
public record ApiImage(String url, JsonNode alt, JsonNode caption, String kind, JsonNode disclosure, String license,
                       String author, String source, String sourceUrl) {

    /** The label of AI illustrations when the content has no caption of its own (ADR-0010). */
    public static final Map<String, String> AI_DISCLOSURE = Map.of("az", "Rəssam təsəvvürü (AI illüstrasiya)");

    /** Whether a file with this licence may be shown publicly. */
    public static boolean isPublic(JsonNode image, String fileField) {
        if (!image.path(fileField).isString()) return false;
        String explicit = image.path("permissionStatus").isString() ? image.path("permissionStatus").stringValue() : null;
        String kind = image.path("kind").isString() ? image.path("kind").stringValue() : null;
        String license = image.path("license").isString() ? image.path("license").stringValue() : null;
        return PermissionStatus.fromLicense(explicit, license, kind).isPublic();
    }

    /**
     * An {@code ImageAsset}, {@code AgePortrait} or {@code BackgroundArt}: null when it has no
     * file or the file is not public.
     */
    public static ApiImage of(JsonNode image, Lang lang) {
        if (image == null || !isPublic(image, "src")) return null;
        String kind = str(image.path("kind"));
        boolean ai = "ai_illustration".equals(kind);
        JsonNode caption = image.has("caption") ? image.path("caption") : image.path("title");
        return new ApiImage(str(image.path("src")), lang.text(image.path("alt")), lang.text(caption),
                kind == null ? null : kind.toUpperCase(java.util.Locale.ROOT),
                ai ? (image.has("caption") ? lang.text(image.path("caption")) : lang.text(AI_DISCLOSURE)) : null,
                str(image.path("license")), str(image.path("author")), str(image.path("source")), str(image.path("sourceUrl")));
    }

    /** A hero photo ({@code {url, source, license, permissionNote}}): null when not public. */
    public static ApiImage ofPhoto(JsonNode photo) {
        if (photo == null || !isPublic(photo, "url")) return null;
        return new ApiImage(str(photo.path("url")), null, null, "PHOTO", null, str(photo.path("license")), null,
                str(photo.path("source")), null);
    }

    private static String str(JsonNode node) {
        return node.isString() ? node.stringValue() : null;
    }
}
