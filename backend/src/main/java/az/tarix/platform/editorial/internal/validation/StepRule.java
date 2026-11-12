package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.editorial.internal.validation.ValidationContext.Item;
import az.tarix.platform.shared.domain.HistoricalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/**
 * Simulation steps (life events, war days, state steps): order, chronology, fact and legend
 * labelling, and the interactive parts. Mirrors the {@code .refine()} rules of the Zod schema
 * and the cross-record checks of {@code scripts/validate-data.ts}; anything the frontend
 * rejects is an ERROR here, otherwise an export could not be built.
 */
final class StepRule implements ValidationRule {

    @Override
    public void check(ValidationContext ctx) {
        List<Item> steps = ctx.steps();
        checkOrder(ctx, steps);
        for (Item step : steps) {
            checkClaims(ctx, step);
            checkQuizAndChoice(ctx, step);
            checkNarration(ctx, step);
        }
    }

    private static void checkOrder(ValidationContext ctx, List<Item> steps) {
        Map<Integer, String> orders = new HashMap<>();
        List<Item> ordered = new ArrayList<>();
        for (Item step : steps) {
            Integer order = Dates.optInt(step.node(), "order");
            if (order == null) continue;
            String previous = orders.putIfAbsent(order, step.text("id"));
            if (previous != null) {
                ctx.error("duplicate-order", step.at("order"), "təkrarlanan order: %d (%s)".formatted(order, previous));
            } else {
                ordered.add(step);
            }
        }
        ordered.sort(Comparator.comparingInt(s -> s.node().path("order").intValue()));
        // State steps are compared by year only (as validate-data does); the others at common precision.
        boolean yearsOnly = ctx.type() == DocumentType.STATE;
        for (int i = 1; i < ordered.size(); i++) {
            Item prev = ordered.get(i - 1);
            Item cur = ordered.get(i);
            HistoricalDate a = Dates.parse(prev.node().path("date"));
            HistoricalDate b = Dates.parse(cur.node().path("date"));
            if (a == null || b == null) continue;
            int cmp = yearsOnly ? Integer.compare(b.year(), a.year()) : b.compareAtCommonPrecision(a);
            if (cmp < 0) {
                ctx.error("chronology", cur.at("date"), "xronologiya pozulub: %s (%d) → %s (%d)"
                        .formatted(prev.text("id"), a.year(), cur.text("id"), b.year()));
            }
        }
    }

    private static void checkClaims(ValidationContext ctx, Item step) {
        String stepType = step.node().path("claimType").isString() ? step.text("claimType") : "fact";
        List<Item> claims = ValidationContext.items(ValidationContext.child(step, "claims"));
        if ("literary".equals(stepType)) {
            ctx.error("literary-step", step.at("claimType"),
                    "mərhələ bütövlükdə 'literary' ola bilməz (bədii mətn narrative-dədir)");
        }
        if (("legend".equals(stepType) || "disputed".equals(stepType))
                && claims.stream().noneMatch(c -> stepType.equals(c.text("claimType")))) {
            ctx.error("claim-type-unexplained", step.at("claimType"),
                    "'%s' kimi işarələnib, amma eyni növdən izahlı iddia (claims) yoxdur".formatted(stepType));
        }
        if ("fact".equals(stepType) && isEmptyArray(step.node().path("sources"))) {
            ctx.error("fact-without-source", step.at("sources"), "fakt kimi verilən addımda mənbə yoxdur");
        }
        for (Item claim : claims) {
            String type = claim.text("claimType");
            if (type == null) continue;
            switch (type) {
                case "fact" -> {
                    if (isEmptyArray(claim.node().path("sources"))) {
                        ctx.error("fact-without-source", claim.at("sources"), "fakt mənbəsiz ola bilməz");
                    }
                }
                case "legend" -> {
                    if (!claim.node().path("firstRecorded").isObject()) {
                        ctx.error("legend-without-origin", claim.pointer(), "rəvayət üçün ilk qeyd (firstRecorded) lazımdır");
                    }
                }
                case "disputed" -> {
                    if (claim.node().path("versions").size() < 2) {
                        ctx.error("disputed-without-versions", claim.at("versions"),
                                "mübahisəli iddia üçün ən azı iki versiya lazımdır");
                    }
                }
                default -> { }
            }
            if (("disputed".equals(type) || "legend".equals(type)) && !claim.node().path("why").isObject()) {
                ctx.error("claim-without-why", claim.pointer(), "mübahisəli və rəvayət iddiası üçün 'why' izahı lazımdır");
            }
        }
    }

    private static void checkQuizAndChoice(ValidationContext ctx, Item step) {
        for (Item q : ValidationContext.items(ValidationContext.child(step, "quiz"))) {
            Integer correct = Dates.optInt(q.node(), "correctIndex");
            if (correct != null && correct >= q.node().path("options").size()) {
                ctx.error("quiz-index", q.at("correctIndex"), "correctIndex variantların sayından kiçik olmalıdır");
            }
        }
        JsonNode choice = step.node().path("choice");
        if (choice.isObject()) {
            Integer historical = Dates.optInt(choice, "historicalOptionIndex");
            if (historical != null && historical >= choice.path("options").size()) {
                ctx.error("choice-index", step.at("choice") + "/historicalOptionIndex",
                        "historicalOptionIndex variantların sayından kiçik olmalıdır");
            }
        }
    }

    private static void checkNarration(ValidationContext ctx, Item step) {
        List<Item> cues = ValidationContext.items(new Item(step.at("narrationAudio") + "/cues",
                step.node().path("narrationAudio").path("cues")));
        double previousEnd = Double.NEGATIVE_INFINITY;
        for (Item cue : cues) {
            double start = cue.node().path("start").asDouble(0);
            double end = cue.node().path("end").asDouble(0);
            if (end <= start) ctx.error("narration-cue", cue.pointer(), "cue-nun sonu başlanğıcından sonra olmalıdır");
            if (start < previousEnd) ctx.error("narration-cue", cue.pointer(), "narration cue-ları üst-üstə düşür");
            previousEnd = end;
        }
    }

    private static boolean isEmptyArray(JsonNode node) {
        return !node.isArray() || node.isEmpty();
    }
}
