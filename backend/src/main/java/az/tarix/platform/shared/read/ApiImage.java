package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.PermissionStatus;
import az.tarix.platform.shared.read.MediaIndex.MediaFile;
import java.util.Locale;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/**
 * An image in the public API (BACKEND_SPEC.md §10: only {@code GRANTED} and
 * {@code NOT_REQUIRED} media). The content refers to a file by {@code media:<id>} or by a path
 * or URL; a registered file's licence and permission come from the registry, an unregistered
 * path's from its inline licence (ADR-0010, ADR-0017). Anything else is never returned.
 *
 * @param url        path under the site root ({@code /portraits/…}) or an absolute URL
 * @param kind       portrait or art kind ({@code HISTORICAL}, {@code AI_ILLUSTRATION}, …), or null
 * @param disclosure label shown with AI illustrations ("Rəssam təsəvvürü (AI illüstrasiya)"), or null
 */
public record ApiImage(String url, JsonNode alt, JsonNode caption, String kind, JsonNode disclosure, String license,
                       String author, String source, String sourceUrl) {

    /** The label of AI illustrations when the content has no caption of its own (ADR-0010). */
    public static final Map<String, String> AI_DISCLOSURE = Map.of("az", "Rəssam təsəvvürü (AI illüstrasiya)");

    /**
     * The file behind a content reference, when it may be shown.
     *
     * @param registered the registry entry, or null for an unregistered path
     */
    public record Resolved(String url, String license, String sourceUrl, String rightsHolder, MediaFile registered) {}

    /**
     * Resolves {@code node.<fileField>} against the registry: a registered file by its status, an
     * unregistered {@code media:} reference never, an unregistered path by its inline licence.
     * Null when there is no file or it may not be shown.
     */
    public static Resolved resolve(JsonNode node, String fileField, MediaIndex media) {
        if (node == null) return null;
        String ref = str(node.path(fileField));
        if (ref == null) return null;
        MediaFile file = media.find(ref);
        if (file != null) {
            return file.isPublic() ? new Resolved(file.url(), file.license(), file.sourceUrl(), file.rightsHolder(), file) : null;
        }
        if (MediaIndex.isRegistryRef(ref)) return null;
        PermissionStatus status = PermissionStatus.fromLicense(str(node.path("permissionStatus")), str(node.path("license")),
                str(node.path("kind")));
        return status.isPublic() ? new Resolved(ref, str(node.path("license")), str(node.path("sourceUrl")), null, null) : null;
    }

    /**
     * An {@code ImageAsset}, {@code AgePortrait} or {@code BackgroundArt}: null when it has no
     * file or the file is not public.
     */
    public static ApiImage of(JsonNode image, Lang lang, MediaIndex media) {
        Resolved file = resolve(image, "src", media);
        if (file == null) return null;
        String kind = str(image.path("kind"));
        boolean ai = "ai_illustration".equals(kind) || (file.registered() != null && file.registered().aiGenerated());
        JsonNode caption = image.has("caption") ? image.path("caption") : image.path("title");
        return new ApiImage(file.url(), lang.text(image.path("alt")), lang.text(caption),
                kind == null ? null : kind.toUpperCase(Locale.ROOT), ai ? disclosure(image, file, lang) : null,
                file.license() != null ? file.license() : str(image.path("license")),
                str(image.path("author")) != null ? str(image.path("author")) : file.rightsHolder(),
                str(image.path("source")), file.sourceUrl() != null ? file.sourceUrl() : str(image.path("sourceUrl")));
    }

    /** A hero photo ({@code {url, source, license, permissionNote}}): null when not public. */
    public static ApiImage ofPhoto(JsonNode photo, MediaIndex media) {
        Resolved file = resolve(photo, "url", media);
        if (file == null) return null;
        return new ApiImage(file.url(), null, null, "PHOTO", null,
                file.license() != null ? file.license() : str(photo.path("license")), file.rightsHolder(),
                str(photo.path("source")), file.sourceUrl());
    }

    /** The content's caption, else the registry's label, else the default label. */
    private static JsonNode disclosure(JsonNode image, Resolved file, Lang lang) {
        if (image.has("caption")) return lang.text(image.path("caption"));
        if (file.registered() != null && file.registered().aiDisclosure() != null) return lang.text(file.registered().aiDisclosure());
        return lang.text(AI_DISCLOSURE);
    }

    private static String str(JsonNode node) {
        return node != null && node.isString() ? node.stringValue() : null;
    }
}
