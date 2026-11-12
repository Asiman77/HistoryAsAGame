package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.editorial.internal.validation.ValidationContext.Item;
import java.util.Comparator;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * Images and audio referenced inline by the content (there is no media registry yet; it comes
 * with the media module, ADR-0010): licence and source, no AI images of real modern people,
 * and no audio whose permission is not settled (BACKEND_SPEC.md §8.3).
 */
final class MediaRule implements ValidationRule {

    /** Latest birth year for which AI illustrations are allowed (frontend: AI_PORTRAIT_MAX_BIRTH_YEAR). */
    static final int AI_PORTRAIT_MAX_BIRTH_YEAR = 1850;

    @Override
    public void check(ValidationContext ctx) {
        switch (ctx.type()) {
            case PERSON -> person(ctx);
            case SOUNDTRACK_TRACK -> track(ctx, ctx.part("track"));
            case THEME -> backgroundArt(ctx, ctx.part("theme"));
            default -> { }
        }
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
                srcPrefix(ctx, p);
                if (!n.path("license").isString()) ctx.error("media-without-license", p.pointer(), "portret %s: şəkil var, lisenziya yoxdur".formatted(where));
                if (!n.path("source").isString() && !n.path("sourceUrl").isString()) {
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
        if (src != null && !src.startsWith("/") && !src.startsWith("http")) {
            ctx.error("media-src", image.at("src"), "src '/' və ya 'http' ilə başlamalıdır");
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
