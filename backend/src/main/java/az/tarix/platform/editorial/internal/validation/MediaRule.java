package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.editorial.internal.validation.ValidationContext.Item;
import az.tarix.platform.media.api.AssetType;
import az.tarix.platform.media.api.MediaRegistry.RegisteredMedia;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.PermissionStatus;
import az.tarix.platform.shared.read.MediaIndex;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/**
 * Images and audio the content refers to (BACKEND_SPEC.md §8.3, ADR-0010, ADR-0017): licence
 * and source, no AI images of real modern people, no file whose permission is not settled.
 * A registered file ({@code media:<id>} or a linked path) is judged by the registry; an
 * unregistered path by its inline licence.
 */
final class MediaRule implements ValidationRule {

    /** Latest birth year for which AI illustrations are allowed (frontend: AI_PORTRAIT_MAX_BIRTH_YEAR). */
    static final int AI_PORTRAIT_MAX_BIRTH_YEAR = 1850;

    /**
     * A file reference in the content.
     *
     * @param pointer where the reference is (the {@code src}/{@code url}/{@code file} field)
     * @param owner   the object holding it (its licence, kind…)
     */
    record FileRef(String pointer, String ref, Item owner, AssetType expected) {}

    @Override
    public void check(ValidationContext ctx) {
        registry(ctx);
        switch (ctx.type()) {
            case PERSON -> person(ctx);
            case SOUNDTRACK_TRACK -> track(ctx, ctx.part("track"));
            case THEME -> backgroundArt(ctx, ctx.part("theme"));
            default -> { }
        }
    }

    /** Every file reference of the document, where the content model has one. */
    static List<FileRef> files(ValidationContext ctx) {
        List<FileRef> out = new ArrayList<>();
        switch (ctx.type()) {
            case PERSON -> {
                Item person = ctx.part("person");
                file(out, ValidationContext.child(person, "portrait"), "src", AssetType.IMAGE);
                for (Item p : ValidationContext.items(ValidationContext.child(person, "portraits"))) file(out, p, "src", AssetType.IMAGE);
            }
            case STATE -> file(out, ValidationContext.child(ctx.part("state"), "image"), "src", AssetType.IMAGE);
            case POLITY -> file(out, ValidationContext.child(ctx.part("polity"), "emblem"), "src", AssetType.IMAGE);
            case RULER -> {
                for (Item p : ValidationContext.items(ValidationContext.child(ctx.part("ruler"), "portraits"))) {
                    file(out, p, "src", AssetType.IMAGE);
                }
            }
            case HERO -> file(out, ValidationContext.child(ctx.part("hero"), "photo"), "url", AssetType.IMAGE);
            case THEME -> {
                for (Item a : ValidationContext.items(ValidationContext.child(ctx.part("theme"), "backgroundArt"))) {
                    file(out, a, "src", AssetType.IMAGE);
                }
            }
            case SOUNDTRACK_TRACK -> file(out, ctx.part("track"), "file", AssetType.AUDIO);
            default -> { }
        }
        return out;
    }

    private static void file(List<FileRef> out, Item owner, String field, AssetType expected) {
        String ref = owner.text(field);
        if (ref != null) out.add(new FileRef(owner.at(field), ref, owner, expected));
    }

    private static void registry(ValidationContext ctx) {
        List<FileRef> refs = files(ctx);
        if (refs.isEmpty()) return;
        Map<String, RegisteredMedia> found = ctx.media().find(refs.stream().map(FileRef::ref).toList());
        for (FileRef f : refs) {
            RegisteredMedia m = found.get(f.ref());
            String inlineLicense = f.owner().text("license");
            if (m == null) {
                if (MediaIndex.isRegistryRef(f.ref())) {
                    ctx.error("media-not-found", f.pointer(), "'%s' media reyestrində yoxdur".formatted(f.ref()));
                } else if (f.expected() == AssetType.IMAGE && inlineLicense != null
                        && !PermissionStatus.fromLicense(null, inlineLicense, f.owner().text("kind")).isPublic()) {
                    // Tracks state their permission explicitly; track() checks it.
                    ctx.error("media-permission", f.pointer(),
                            "lisenziya '%s' icazə tələb edir: faylı reyestrdə qeyd edin və icazəni təsdiqləyin".formatted(inlineLicense));
                }
                continue;
            }
            if (!m.status().isPublic()) {
                ctx.error("media-permission", f.pointer(),
                        "'%s' faylının icazə statusu %s: belə media dərc oluna bilməz".formatted(f.ref(), m.status()));
            }
            if (m.type() != f.expected()) {
                ctx.error("media-type", f.pointer(), "'%s' %s faylıdır, burada %s gözlənilir".formatted(f.ref(), m.type(), f.expected()));
            }
            if (inlineLicense != null && !inlineLicense.equals(m.license())) {
                ctx.warning("media-license-mismatch", f.owner().at("license"),
                        "reyestrdəki lisenziya ('%s') göstəriləcək, bu mətn yox".formatted(m.license()));
            }
            if (m.aiGenerated() && modernPerson(ctx)) {
                ctx.error("ai-portrait-of-modern-person", f.pointer(), "müasir real şəxslər üçün AI şəkli olmaz");
            }
        }
    }

    /** A hero, or a person born after {@link #AI_PORTRAIT_MAX_BIRTH_YEAR}. */
    private static boolean modernPerson(ValidationContext ctx) {
        if (ctx.type() == DocumentType.HERO) return true;
        if (ctx.type() != DocumentType.PERSON) return false;
        JsonNode birth = ctx.part("person").node().path("birth").path("date").path("year");
        return birth.isIntegralNumber() && birth.intValue() > AI_PORTRAIT_MAX_BIRTH_YEAR;
    }

    private static void person(ValidationContext ctx) {
        Item person = ctx.part("person");
        Item portrait = ValidationContext.child(person, "portrait");
        if (portrait.node().isObject()) srcPrefix(ctx, portrait);

        JsonNode birth = person.node().path("birth").path("date").path("year");
        JsonNode death = person.node().path("death").path("date").path("year");
        Integer lifespan = birth.isIntegralNumber() && death.isIntegralNumber() ? death.intValue() - birth.intValue() : null;
        List<Item> portraits = ValidationContext.items(ValidationContext.child(person, "portraits")).stream()
                .sorted(Comparator.comparingInt(p -> p.node().path("ageFrom").asInt()))
                .toList();
        Item previous = null;
        for (Item p : portraits) {
            JsonNode n = p.node();
            int from = n.path("ageFrom").asInt();
            int to = n.path("ageTo").asInt();
            String where = "%d–%d".formatted(from, to);
            if (from > to) ctx.error("portrait-ages", p.pointer(), "portret %s: ageFrom ageTo-dan böyük ola bilməz".formatted(where));
            if (lifespan != null && to > lifespan + 1) {
                ctx.error("portrait-ages", p.at("ageTo"), "portret %s: ömür müddətindən (%d) uzundur".formatted(where, lifespan));
            }
            if (previous != null && from <= previous.node().path("ageTo").asInt()) {
                ctx.error("portrait-ages", p.pointer(), "portret %s: %d–%d ilə üst-üstə düşür".formatted(where,
                        previous.node().path("ageFrom").asInt(), previous.node().path("ageTo").asInt()));
            }
            previous = p;
            boolean hasImage = n.path("src").isString();
            if (hasImage) {
                // A registered upload carries its licence in the registry (registry() checks it).
                boolean registered = MediaIndex.isRegistryRef(n.path("src").stringValue());
                srcPrefix(ctx, p);
                if (!registered && !n.path("license").isString()) ctx.error("media-without-license", p.pointer(), "portret %s: şəkil var, lisenziya yoxdur".formatted(where));
                if (!registered && !n.path("source").isString() && !n.path("sourceUrl").isString()) {
                    ctx.error("media-without-source", p.pointer(), "portret %s: şəkil var, mənbə yoxdur".formatted(where));
                }
            }
            if ("ai_illustration".equals(p.text("kind"))) {
                if (birth.isIntegralNumber() && birth.intValue() > AI_PORTRAIT_MAX_BIRTH_YEAR) {
                    ctx.error("ai-portrait-of-modern-person", p.at("kind"), "portret %s: müasir real şəxslər üçün AI şəkli olmaz".formatted(where));
                }
                if (!n.path("promptId").isString()) {
                    ctx.error("ai-portrait-without-prompt", p.pointer(), "portret %s: AI illüstrasiyası üçün promptId tələb olunur".formatted(where));
                }
            }
        }
    }

    private static void srcPrefix(ValidationContext ctx, Item image) {
        String src = image.text("src");
        if (src != null && !src.startsWith("/") && !src.startsWith("http") && !MediaIndex.isRegistryRef(src)) {
            ctx.error("media-src", image.at("src"), "src '/', 'http' və ya 'media:' ilə başlamalıdır");
        }
    }

    private static void track(ValidationContext ctx, Item track) {
        String status = track.text("permissionStatus");
        boolean hasFile = track.node().path("file").isString();
        if ("pending".equals(status) || "denied".equals(status)) {
            ctx.error("media-permission", track.at("permissionStatus"),
                    "icazə statusu '%s': belə media dərc oluna bilməz".formatted(status));
        }
        if ("granted".equals(status) && !hasFile) ctx.error("media-permission", track.pointer(), "icazə var, amma fayl göstərilməyib");
        if ("pending".equals(status) && hasFile) ctx.error("media-permission", track.at("file"), "icazə gözlənilir, fayl əlavə edilməməlidir");
    }

    private static void backgroundArt(ValidationContext ctx, Item theme) {
        for (Item art : ValidationContext.items(ValidationContext.child(theme, "backgroundArt"))) {
            boolean src = art.node().path("src").isString();
            boolean procedural = art.node().path("procedural").isString();
            if ("placeholder".equals(art.text("kind"))) {
                if (!art.node().path("promptId").isString()) ctx.error("background-art", art.pointer(), "yer tutucu üçün promptId tələb olunur");
            } else if (src == procedural) {
                ctx.error("background-art", art.pointer(), "şəkildə ya src, ya da procedural olmalıdır");
            }
        }
    }
}
