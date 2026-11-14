package az.tarix.platform.publishing.internal.export;

import az.tarix.platform.shared.content.PublishedContent;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.ApiImage.Resolved;
import az.tarix.platform.shared.read.MediaIndex;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Media in the export follow the same rule as the public API (BACKEND_SPEC.md §10, ADR-0017):
 * only GRANTED and NOT_REQUIRED files go out. A file whose permission was withdrawn after
 * publishing is removed in the way the frontend schema allows (an age portrait becomes a
 * placeholder, an optional image disappears, a track is left out). A {@code media:<id>}
 * reference becomes the file's public URL, with the registry's licence.
 */
final class ExportMedia {

    private ExportMedia() {}

    /** A cleaned copy of the document; null when the whole document must stay out (a track that may not be played). */
    static PublishedContent clean(PublishedContent d, MediaIndex media) {
        ObjectNode c = (ObjectNode) d.content().deepCopy();
        switch (d.type()) {
            case PERSON -> {
                ObjectNode person = obj(c, "person");
                if (person != null) {
                    optionalImage(person, "portrait", "src", media);
                    if (person.path("portraits").isArray()) {
                        for (JsonNode p : person.path("portraits")) placeholderIfHidden((ObjectNode) p, media);
                    }
                }
            }
            case STATE -> optionalImage(obj(c, "state"), "image", "src", media);
            case POLITY -> optionalImage(obj(c, "polity"), "emblem", "src", media);
            case RULER -> keepPublic(obj(c, "ruler"), "portraits", "src", media);
            case HERO -> optionalImage(obj(c, "hero"), "photo", "url", media);
            case THEME -> keepPublic(obj(c, "theme"), "backgroundArt", "src", media);
            case SOUNDTRACK_TRACK -> {
                ObjectNode track = obj(c, "track");
                if (track == null) return null;
                Resolved r = ApiImage.resolve(track, "file", media);
                if (r == null) return null;
                rewrite(track, "file", r);
            }
            default -> { }
        }
        return new PublishedContent(d.documentId(), d.type(), d.slug(), d.revisionId(), d.revisionNo(), c);
    }

    /** An optional image object: removed when its file may not be shown. */
    private static void optionalImage(ObjectNode owner, String field, String fileField, MediaIndex media) {
        if (owner == null || !owner.path(field).isObject()) return;
        ObjectNode image = (ObjectNode) owner.get(field);
        Resolved r = ApiImage.resolve(image, fileField, media);
        if (r == null) owner.remove(field);
        else rewrite(image, fileField, r);
    }

    /** An age portrait: without a showable file it stays as a placeholder (no {@code src}). */
    private static void placeholderIfHidden(ObjectNode portrait, MediaIndex media) {
        if (!portrait.path("src").isString()) return;
        Resolved r = ApiImage.resolve(portrait, "src", media);
        if (r == null) {
            portrait.remove("src");
        } else {
            rewrite(portrait, "src", r);
        }
    }

    /** A list of images: only those that may be shown stay. Items without a file (procedural art) stay. */
    private static void keepPublic(ObjectNode owner, String field, String fileField, MediaIndex media) {
        if (owner == null || !owner.path(field).isArray()) return;
        ArrayNode list = (ArrayNode) owner.get(field);
        for (int i = list.size() - 1; i >= 0; i--) {
            ObjectNode item = (ObjectNode) list.get(i);
            if (!item.path(fileField).isString()) continue;
            Resolved r = ApiImage.resolve(item, fileField, media);
            if (r == null) list.remove(i);
            else rewrite(item, fileField, r);
        }
    }

    /** Only a registry reference changes: its URL and the registry's licence replace the content's. */
    private static void rewrite(ObjectNode node, String fileField, Resolved r) {
        if (!MediaIndex.isRegistryRef(node.path(fileField).asString(null))) return;
        node.put(fileField, r.url());
        if (r.license() != null && node.has("license")) node.put("license", r.license());
    }

    private static ObjectNode obj(ObjectNode c, String key) {
        return c.path(key) instanceof ObjectNode o ? o : null;
    }
}
