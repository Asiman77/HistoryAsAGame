package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.editorial.internal.validation.ValidationContext.Item;
import java.util.List;
import java.util.Locale;
import tools.jackson.databind.JsonNode;

/** Per-type consistency checks that JSON Schema cannot express (year ranges, real days, enums kept elsewhere). */
final class ConsistencyRule implements ValidationRule {

    @Override
    public void check(ValidationContext ctx) {
        switch (ctx.type()) {
            case ERA -> {
                Item era = ctx.part("era");
                if (era.node().path("startYear").asInt() > era.node().path("endYear").asInt()) {
                    ctx.error("year-range", era.at("startYear"), "startYear endYear-dən böyük ola bilməz");
                }
            }
            case PLACE -> ranges(ctx, ValidationContext.child(ctx.part("place"), "periods"), "period");
            case POLITY -> polity(ctx);
            case WORLD_EVENT -> {
                Item e = ctx.part("event");
                if (e.node().path("endYear").isIntegralNumber() && e.node().path("endYear").asInt() < e.node().path("year").asInt()) {
                    ctx.error("year-range", e.at("endYear"), "endYear year-dən kiçik ola bilməz");
                }
            }
            case GLOSSARY_ENTRY -> {
                Item g = ctx.part("entry");
                JsonNode forms = g.node().path("forms");
                for (int i = 0; i < forms.size(); i++) {
                    String f = forms.get(i).asString("");
                    if (!f.equals(f.toLowerCase(Locale.ROOT))) ctx.error("glossary-form", g.at("forms") + "/" + i, "forms kiçik hərflə olmalıdır");
                }
            }
            case COMMEMORATION -> {
                Item c = ctx.part("commemoration");
                Integer month = Dates.optInt(c.node(), "month");
                Integer day = Dates.optInt(c.node(), "day");
                if (month != null && day != null && !Dates.isRealDay(null, month, day)) {
                    ctx.error("invalid-date", c.at("day"), "belə gün yoxdur: %02d-%02d".formatted(month, day));
                }
            }
            case THEME -> {
                Item t = ctx.part("theme");
                String music = t.text("musicThemeId");
                if (music != null && !ctx.musicThemes().contains(music)) {
                    ctx.error("unknown-music-theme", t.at("musicThemeId"), "naməlum musicThemeId: " + music);
                }
            }
            case TERRITORY_SNAPSHOT -> {
                for (Item p : ValidationContext.items(ValidationContext.child(ctx.part("snapshot"), "polities"))) {
                    if (p.node().has("regions") == p.node().has("iso")) {
                        ctx.error("territory-shape", p.pointer(), "%s: regions və iso-dan yalnız biri olmalıdır".formatted(p.text("polityId")));
                    }
                }
            }
            default -> { }
        }
    }

    private static void polity(ValidationContext ctx) {
        Item polity = ctx.part("polity");
        ranges(ctx, ValidationContext.child(polity, "periods"), "period");
        ranges(ctx, ValidationContext.child(polity, "facts"), "facts");
        List<Item> periods = ValidationContext.items(ValidationContext.child(polity, "periods"));
        for (Item r : ctx.list("reigns")) {
            JsonNode start = r.node().path("start");
            JsonNode end = r.node().path("end");
            int sy = start.path("year").asInt();
            int ey = end.path("year").asInt();
            if (sy > ey || (sy == ey && start.path("month").asInt(0) > end.path("month").asInt(13))) {
                ctx.error("year-range", r.at("start"), "%s: hakimiyyətin başlanğıcı sonundan sonradır".formatted(r.text("rulerId")));
            }
            boolean inside = periods.isEmpty() || periods.stream().anyMatch(p ->
                    sy >= p.node().path("from").asInt() - 1 && ey <= p.node().path("to").asInt() + 1);
            if (!inside) {
                ctx.error("reign-outside-polity", r.pointer(), "%s: hakimiyyət dövlətin mövcud olduğu illərdən kənardadır".formatted(r.text("rulerId")));
            }
        }
    }

    private static void ranges(ValidationContext ctx, Item list, String what) {
        for (Item item : ValidationContext.items(list)) {
            if (item.node().path("from").asInt() > item.node().path("to").asInt()) {
                ctx.error("year-range", item.pointer(), "%s %d–%d: from to-dan böyük ola bilməz".formatted(what,
                        item.node().path("from").asInt(), item.node().path("to").asInt()));
            }
        }
    }
}
