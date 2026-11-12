package az.tarix.platform.editorial.internal.validation;

import java.util.Map;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/**
 * Checks that apply wherever the value occurs in the content:
 * <ul>
 *   <li>LocalizedText: {@code az} must not be blank (ERROR); missing {@code en}/{@code ru}
 *       translations are counted per document (INFO)</li>
 *   <li>dates ({@code year} with optional {@code month}/{@code day}): a day needs a month and
 *       must exist in that month and year, e.g. no 31 February (ERROR); a {@code disputed}
 *       {@code date} needs {@code alternatives} (ERROR — the frontend's data check rejects it too)</li>
 * </ul>
 */
final class TextAndDateRule implements ValidationRule {

    private static final Pattern LANGUAGE = Pattern.compile("[a-z]{2}");
    private static final String[] TRANSLATIONS = {"en", "ru"};

    @Override
    public void check(ValidationContext ctx) {
        int[] missing = new int[TRANSLATIONS.length];
        String[] firstMissing = new String[TRANSLATIONS.length];
        ctx.walk((pointer, node) -> {
            if (isLocalizedText(node)) {
                if (node.get("az").stringValue().isBlank()) ctx.error("empty-az", pointer + "/az", "az dilində mətn boşdur");
                for (int i = 0; i < TRANSLATIONS.length; i++) {
                    if (!node.has(TRANSLATIONS[i])) {
                        if (missing[i]++ == 0) firstMissing[i] = pointer;
                    }
                }
            }
            if (node.isObject() && node.path("year").isIntegralNumber()) checkDate(ctx, pointer, node);
        });
        for (int i = 0; i < TRANSLATIONS.length; i++) {
            if (missing[i] > 0) {
                ctx.info("missing-translation", firstMissing[i],
                        "%d mətndə %s tərcüməsi yoxdur".formatted(missing[i], TRANSLATIONS[i]));
            }
        }
    }

    static boolean isLocalizedText(JsonNode node) {
        if (!node.isObject() || !node.path("az").isString()) return false;
        for (Map.Entry<String, JsonNode> e : node.properties()) {
            if (!LANGUAGE.matcher(e.getKey()).matches() || !e.getValue().isString()) return false;
        }
        return true;
    }

    private static void checkDate(ValidationContext ctx, String pointer, JsonNode node) {
        Integer month = Dates.optInt(node, "month");
        Integer day = Dates.optInt(node, "day");
        if (day != null && month == null) {
            ctx.error("day-without-month", pointer, "gün göstərilibsə, ay da göstərilməlidir");
        } else if (day != null && node.path("year").canConvertToInt()
                && !Dates.isRealDay(node.path("year").intValue(), month, day)) {
            ctx.error("invalid-date", pointer, "belə tarix yoxdur: " + Dates.describe(node));
        }
        // Only real dates: elsewhere (a territory snapshot) "certainty" is about something else.
        boolean isDate = pointer.endsWith("/date");
        if (isDate && node.path("certainty").isString() && "disputed".equals(node.get("certainty").stringValue())) {
            JsonNode alternatives = node.path("alternatives");
            if (!alternatives.isArray() || alternatives.isEmpty()) {
                ctx.error("disputed-without-alternatives", pointer, "'disputed' tarix üçün alternatives tələb olunur");
            }
        }
    }
}
