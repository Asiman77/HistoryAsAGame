package az.tarix.platform.shared.content;

import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.DataEnum;
import az.tarix.platform.shared.domain.HistoricalDate;
import az.tarix.platform.shared.jdbc.HistoricalDateColumns;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reading values out of content JSON for SQL parameters. Absent and {@code null} nodes become
 * SQL NULL. JSON values are passed as text and cast in SQL ({@code CAST(:x AS jsonb)}).
 */
public final class ContentValues {

    private ContentValues() {}

    /** The node as JSON text, or null when absent. */
    public static String json(JsonNode node) {
        return present(node) ? JsonMapper.shared().writeValueAsString(node) : null;
    }

    /** Like {@link #json} but an absent array becomes {@code []} (for NOT NULL DEFAULT '[]' columns). */
    public static String jsonArray(JsonNode node) {
        return present(node) ? json(node) : "[]";
    }

    public static String text(JsonNode node) {
        return node.isString() ? node.stringValue() : null;
    }

    public static Integer integer(JsonNode node) {
        return node.isIntegralNumber() && node.canConvertToInt() ? node.intValue() : null;
    }

    public static Double number(JsonNode node) {
        return node.isNumber() ? node.doubleValue() : null;
    }

    public static Boolean bool(JsonNode node) {
        return node.isBoolean() ? node.booleanValue() : null;
    }

    /** A document enum value as the database spells it: {@code middle-east} → {@code MIDDLE_EAST}. */
    public static String enumName(JsonNode node) {
        String v = text(node);
        return v == null ? null : v.replace('-', '_').toUpperCase(Locale.ROOT);
    }

    /** A string array as {@code text[]} (empty when absent). */
    public static String[] strings(JsonNode array) {
        List<String> out = new ArrayList<>();
        for (JsonNode n : array) if (n.isString()) out.add(n.stringValue());
        return out.toArray(String[]::new);
    }

    /** A content HistoricalDate ({@code year}, optional {@code month}/{@code day}, {@code certainty}); null when absent. */
    public static HistoricalDate date(JsonNode node) {
        if (!node.path("year").isIntegralNumber()) return null;
        Certainty certainty = node.path("certainty").isString()
                ? DataEnum.fromData(Certainty.class, node.path("certainty").stringValue())
                : Certainty.EXACT;
        return HistoricalDate.of(node.path("year").intValue(), integer(node.path("month")), integer(node.path("day")), certainty);
    }

    /**
     * SQL parameters of a HistoricalDate column group: {@code <prefix>_year … _certainty},
     * plus {@code _alternatives} and {@code _note} (jsonb) as written.
     */
    public static Map<String, Object> dateParams(String prefix, JsonNode node) {
        Map<String, Object> p = HistoricalDateColumns.params(prefix, date(node));
        p.put(prefix + "_alternatives", json(node.path("alternatives")));
        p.put(prefix + "_note", json(node.path("note")));
        return p;
    }

    public static boolean present(JsonNode node) {
        return node != null && !node.isMissingNode() && !node.isNull();
    }
}
