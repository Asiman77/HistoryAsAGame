package az.tarix.platform.shared.jdbc;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Reading {@code jsonb} and {@code text[]} columns in row mappers. */
public final class JsonColumns {

    private JsonColumns() {}

    /** The column parsed as JSON, or null when SQL NULL. */
    public static JsonNode json(ResultSet rs, String column) throws SQLException {
        String value = rs.getString(column);
        return value == null ? null : JsonMapper.shared().readTree(value);
    }

    /** A {@code text[]} column; empty when SQL NULL. */
    public static List<String> strings(ResultSet rs, String column) throws SQLException {
        Array array = rs.getArray(column);
        if (array == null) return List.of();
        try {
            return Arrays.stream((Object[]) array.getArray()).map(String.class::cast).toList();
        } finally {
            array.free();
        }
    }

    /** An int column that may be NULL. */
    public static Integer integer(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    /** A boolean column that may be NULL. */
    public static Boolean bool(ResultSet rs, String column) throws SQLException {
        boolean value = rs.getBoolean(column);
        return rs.wasNull() ? null : value;
    }
}
