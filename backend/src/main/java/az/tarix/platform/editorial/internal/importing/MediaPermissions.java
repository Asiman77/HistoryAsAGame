package az.tarix.platform.editorial.internal.importing;

import az.tarix.platform.editorial.internal.importing.DataFolder.Doc;
import az.tarix.platform.media.api.AssetType;
import az.tarix.platform.media.api.MediaRegistry.LinkedFile;
import az.tarix.platform.shared.domain.PermissionStatus;
import az.tarix.platform.shared.read.ApiImage;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The files the existing data links to, with the permission status each gets (ADR-0010).
 * Permission is never assumed: anything not clearly free is PENDING. The importer registers
 * them in the media registry as linked files (ADR-0017).
 */
public final class MediaPermissions {

    /**
     * One file the content refers to.
     *
     * @param rightsHolder the image's author or the recording's rights holder, or null
     * @param aiDisclosure the content's caption of an AI illustration, or the default label; null otherwise
     */
    public record MediaItem(String docType, String slug, String pointer, String file, AssetType type, String license,
                            String sourceUrl, String rightsHolder, PermissionStatus status, boolean aiGenerated,
                            JsonNode aiDisclosure) {

        /** Whether it can be registered: a file and a licence (the registry requires one). */
        public boolean registrable() {
            return file != null && !file.isBlank() && license != null && !license.isBlank();
        }

        public LinkedFile linked() {
            return new LinkedFile(file, type, license, sourceUrl, rightsHolder, status, aiGenerated, aiDisclosure);
        }
    }

    private static final JsonNode DEFAULT_DISCLOSURE = JsonMapper.shared().valueToTree(ApiImage.AI_DISCLOSURE);

    private MediaPermissions() {}

    /** ADR-0010, first matching rule wins ({@link PermissionStatus#fromLicense}). */
    public static PermissionStatus classify(String explicitStatus, String license, String backgroundArtKind) {
        return PermissionStatus.fromLicense(explicitStatus, license, backgroundArtKind);
    }

    /** Every image and recording with a file in the document. Portraits without {@code src} are placeholders, not media. */
    public static List<MediaItem> of(Doc doc) {
        List<MediaItem> out = new ArrayList<>();
        JsonNode c = doc.content();
        switch (doc.type()) {
            case PERSON -> {
                image(out, doc, "/person/portrait", c.path("person").path("portrait"));
                JsonNode portraits = c.path("person").path("portraits");
                for (int i = 0; i < portraits.size(); i++) image(out, doc, "/person/portraits/" + i, portraits.get(i));
            }
            case STATE -> image(out, doc, "/state/image", c.path("state").path("image"));
            case POLITY -> image(out, doc, "/polity/emblem", c.path("polity").path("emblem"));
            case RULER -> {
                JsonNode portraits = c.path("ruler").path("portraits");
                for (int i = 0; i < portraits.size(); i++) image(out, doc, "/ruler/portraits/" + i, portraits.get(i));
            }
            case HERO -> {
                JsonNode photo = c.path("hero").path("photo");
                if (photo.path("url").isString()) {
                    out.add(new MediaItem(doc.type().name(), doc.slug(), "/hero/photo", photo.path("url").asString(), AssetType.IMAGE,
                            str(photo, "license"), null, null, classify(null, str(photo, "license"), null), false, null));
                }
            }
            case THEME -> {
                JsonNode art = c.path("theme").path("backgroundArt");
                for (int i = 0; i < art.size(); i++) {
                    JsonNode a = art.get(i);
                    if (a.path("src").isString()) {
                        String kind = str(a, "kind");
                        boolean ai = "ai_illustration".equals(kind);
                        out.add(new MediaItem(doc.type().name(), doc.slug(), "/theme/backgroundArt/" + i, a.path("src").asString(),
                                AssetType.IMAGE, str(a, "license"), str(a, "sourceUrl"), null,
                                classify(null, str(a, "license"), kind), ai, ai ? DEFAULT_DISCLOSURE : null));
                    }
                }
            }
            case SOUNDTRACK_TRACK -> {
                JsonNode t = c.path("track");
                out.add(new MediaItem(doc.type().name(), doc.slug(), "/track", str(t, "file"), AssetType.AUDIO, str(t, "license"),
                        null, str(t, "rightsHolder"), classify(str(t, "permissionStatus"), str(t, "license"), null), false, null));
            }
            default -> { }
        }
        return out;
    }

    private static void image(List<MediaItem> out, Doc doc, String pointer, JsonNode image) {
        if (!image.path("src").isString()) return;
        boolean ai = "ai_illustration".equals(str(image, "kind"));
        JsonNode disclosure = ai ? (image.path("caption").isObject() ? image.path("caption") : DEFAULT_DISCLOSURE) : null;
        out.add(new MediaItem(doc.type().name(), doc.slug(), pointer, image.path("src").asString(), AssetType.IMAGE,
                str(image, "license"), str(image, "sourceUrl"), str(image, "author"), classify(null, str(image, "license"), null),
                ai, disclosure));
    }

    private static String str(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isString() ? v.asString() : null;
    }
}
