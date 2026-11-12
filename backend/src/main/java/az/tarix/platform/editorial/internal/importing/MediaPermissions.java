package az.tarix.platform.editorial.internal.importing;

import az.tarix.platform.editorial.internal.importing.DataFolder.Doc;
import az.tarix.platform.shared.domain.PermissionStatus;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import tools.jackson.databind.JsonNode;

/**
 * The permission status an imported image or recording gets (ADR-0010). Permission is never
 * assumed: anything not clearly free is PENDING. Until the media registry exists (phase 11)
 * the result is only reported; phase 11 stores it on {@code media_asset}.
 */
public final class MediaPermissions {

    /** One file the content refers to. */
    public record MediaItem(String docType, String slug, String pointer, String file, String license, PermissionStatus status) {}

    private MediaPermissions() {}

    /** ADR-0010, first matching rule wins. */
    public static PermissionStatus classify(String explicitStatus, String license, String backgroundArtKind) {
        if (explicitStatus != null && !explicitStatus.isBlank()) return PermissionStatus.valueOf(explicitStatus.toUpperCase(Locale.ROOT));
        String l = license == null ? "" : license.strip().toLowerCase(Locale.ROOT);
        if (l.startsWith("public domain") || l.startsWith("cc0")) return PermissionStatus.NOT_REQUIRED;
        if (l.startsWith("layihə lisenziyası") || "own".equals(backgroundArtKind)) return PermissionStatus.NOT_REQUIRED;
        if (l.startsWith("cc by")) return PermissionStatus.NOT_REQUIRED;
        return PermissionStatus.PENDING;
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
                    out.add(item(doc, "/hero/photo", photo.path("url").asString(), photo.path("license").asString(null), null, null));
                }
            }
            case THEME -> {
                JsonNode art = c.path("theme").path("backgroundArt");
                for (int i = 0; i < art.size(); i++) {
                    JsonNode a = art.get(i);
                    if (a.path("src").isString()) {
                        out.add(item(doc, "/theme/backgroundArt/" + i, a.path("src").asString(), a.path("license").asString(null),
                                null, a.path("kind").asString(null)));
                    }
                }
            }
            case SOUNDTRACK_TRACK -> {
                JsonNode t = c.path("track");
                out.add(item(doc, "/track", t.path("file").asString(null), t.path("license").asString(null),
                        t.path("permissionStatus").asString(null), null));
            }
            default -> { }
        }
        return out;
    }

    private static void image(List<MediaItem> out, Doc doc, String pointer, JsonNode image) {
        if (image.path("src").isString()) {
            out.add(item(doc, pointer, image.path("src").asString(), image.path("license").asString(null), null, null));
        }
    }

    private static MediaItem item(Doc doc, String pointer, String file, String license, String status, String artKind) {
        return new MediaItem(doc.type().name(), doc.slug(), pointer, file, license, classify(status, license, artKind));
    }
}
