package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.DataEnum;
import az.tarix.platform.shared.domain.HistoricalDate;
import java.time.YearMonth;
import tools.jackson.databind.JsonNode;

/** Reading {@link HistoricalDate}s out of content JSON. */
final class Dates {

    private Dates() {}

    /** The date, or null when the node is not a valid HistoricalDate (the date rule reports why). */
    static HistoricalDate parse(JsonNode node) {
        if (!node.path("year").canConvertToInt() || !node.path("year").isIntegralNumber()) return null;
        try {
            Certainty certainty = node.path("certainty").isString()
                    ? DataEnum.fromData(Certainty.class, node.path("certainty").stringValue())
                    : Certainty.EXACT;
            return HistoricalDate.of(node.path("year").intValue(), optInt(node, "month"), optInt(node, "day"), certainty);
        } catch (IllegalArgumentException | java.time.DateTimeException e) {
            return null;
        }
    }

    /** Whether month/day exist in {@code year} (or in some year when {@code year} is null: 29 February is fine). */
    static boolean isRealDay(Integer year, int month, int day) {
        if (month < 1 || month > 12 || day < 1) return false;
        int length = year == null ? (month == 2 ? 29 : YearMonth.of(2001, month).lengthOfMonth())
                : YearMonth.of(year, month).lengthOfMonth();
        return day <= length;
    }

    static Integer optInt(JsonNode node, String field) {
        JsonNode n = node.path(field);
        return n.isIntegralNumber() && n.canConvertToInt() ? n.intValue() : null;
    }

    static String describe(JsonNode node) {
        Integer m = optInt(node, "month");
        Integer d = optInt(node, "day");
        return node.path("year").asString() + (m == null ? "" : "-%02d".formatted(m)) + (d == null ? "" : "-%02d".formatted(d));
    }
}
