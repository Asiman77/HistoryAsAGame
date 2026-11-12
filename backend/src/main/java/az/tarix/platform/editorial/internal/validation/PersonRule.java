package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.editorial.internal.validation.ValidationContext.Item;
import az.tarix.platform.shared.domain.HistoricalDate;
import java.util.Comparator;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * A person's life ({@code checkPerson} and {@code checkEventReferences} in the frontend's
 * integrity.ts): exactly one birth and one death, at the ends and matching the person card;
 * no step before birth or after death; battle outcomes only on battles; and a few
 * consistency checks of the event itself.
 */
final class PersonRule implements ValidationRule {

    /** Maneuver arrows further than this from the battle (in degrees) are a data error. */
    static final double MANEUVER_MAX_DEGREES = 2.0;

    @Override
    public void check(ValidationContext ctx) {
        if (ctx.type() != DocumentType.PERSON) return;
        JsonNode person = ctx.part("person").node();
        List<Item> events = ctx.list("events");
        HistoricalDate birth = Dates.parse(person.path("birth").path("date"));
        HistoricalDate death = Dates.parse(person.path("death").path("date"));

        List<Item> births = events.stream().filter(e -> "birth".equals(e.text("type"))).toList();
        List<Item> deaths = events.stream().filter(e -> "death".equals(e.text("type"))).toList();
        if (births.size() != 1) ctx.error("life-bounds", "/events", "tam bir 'birth' hadisəsi olmalıdır (tapıldı: %d)".formatted(births.size()));
        if (deaths.size() != 1) ctx.error("life-bounds", "/events", "tam bir 'death' hadisəsi olmalıdır (tapıldı: %d)".formatted(deaths.size()));
        List<Item> ordered = events.stream().filter(e -> e.node().path("order").isIntegralNumber())
                .sorted(Comparator.comparingInt(e -> e.node().path("order").intValue())).toList();
        if (!ordered.isEmpty() && !"birth".equals(ordered.getFirst().text("type"))) {
            ctx.error("life-bounds", ordered.getFirst().pointer(), "ilk hadisə 'birth' olmalıdır");
        }
        if (!ordered.isEmpty() && !"death".equals(ordered.getLast().text("type"))) {
            ctx.error("life-bounds", ordered.getLast().pointer(), "son hadisə 'death' olmalıdır");
        }
        if (births.size() == 1 && birth != null && births.getFirst().node().path("date").path("year").asInt() != birth.year()) {
            ctx.error("life-bounds", births.getFirst().at("date"), "birth hadisəsinin ili person.birth ilə uyğun gəlmir");
        }
        if (deaths.size() == 1 && death != null && deaths.getFirst().node().path("date").path("year").asInt() != death.year()) {
            ctx.error("life-bounds", deaths.getFirst().at("date"), "death hadisəsinin ili person.death ilə uyğun gəlmir");
        }

        for (Item e : events) {
            HistoricalDate date = Dates.parse(e.node().path("date"));
            if (date != null && birth != null && date.compareAtCommonPrecision(birth) < 0) {
                ctx.error("outside-lifetime", e.at("date"), "%s: tarix doğumdan əvvəldir".formatted(e.text("id")));
            }
            if (date != null && death != null && date.compareAtCommonPrecision(death) > 0) {
                ctx.error("outside-lifetime", e.at("date"), "%s: tarix ölümdən sonradır".formatted(e.text("id")));
            }
            checkEvent(ctx, e);
        }
    }

    private static void checkEvent(ValidationContext ctx, Item e) {
        JsonNode n = e.node();
        boolean battle = "battle".equals(e.text("type"));
        JsonNode outcome = n.path("outcome");
        if (battle && !outcome.isObject()) ctx.error("battle-outcome", e.pointer(), "döyüş hadisəsində outcome tələb olunur");
        if (!battle && outcome.isObject()) ctx.error("battle-outcome", e.at("outcome"), "outcome yalnız döyüş üçündür");
        if (n.has("route") && !n.path("fromLocation").isObject()) {
            ctx.error("route-without-from", e.at("route"), "route var, fromLocation yoxdur");
        }
        String narrative = n.path("narrative").path("az").asString("");
        String summary = n.path("factualSummary").path("az").asString("");
        if (!narrative.isBlank() && narrative.strip().equals(summary.strip())) {
            ctx.error("narrative-equals-summary", e.at("narrative"), "narrative və factualSummary eynidir");
        }
        double lng = n.path("location").path("lng").asDouble(Double.NaN);
        double lat = n.path("location").path("lat").asDouble(Double.NaN);
        JsonNode maneuvers = outcome.path("maneuvers");
        for (int i = 0; i < maneuvers.size(); i++) {
            for (JsonNode point : maneuvers.get(i).path("path")) {
                if (Math.abs(point.path(0).asDouble() - lng) > MANEUVER_MAX_DEGREES
                        || Math.abs(point.path(1).asDouble() - lat) > MANEUVER_MAX_DEGREES) {
                    ctx.error("maneuver-too-far", e.at("outcome") + "/maneuvers/" + i,
                            "manevr döyüş yerindən %.0f°-dən uzaqdadır".formatted(MANEUVER_MAX_DEGREES));
                    break;
                }
            }
        }
    }
}
