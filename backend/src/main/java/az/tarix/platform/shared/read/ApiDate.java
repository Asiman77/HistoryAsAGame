package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.DatePrecision;
import az.tarix.platform.shared.domain.HistoricalDate;
import az.tarix.platform.shared.jdbc.HistoricalDateColumns;
import az.tarix.platform.shared.jdbc.JsonColumns;
import java.sql.ResultSet;
import java.sql.SQLException;
import tools.jackson.databind.JsonNode;

/**
 * A {@link HistoricalDate} in the public API (BACKEND_SPEC.md §10.2), with the variants
 * historians give and a note when the content has them.
 *
 * @param alternatives other dates given by sources ({@code [{year, month?, day?, note, source?}]}), or null
 * @param note         remark on the date, or null
 */
public record ApiDate(int year, Integer month, Integer day, DatePrecision precision, Certainty certainty,
                      JsonNode alternatives, JsonNode note) {

    public static ApiDate of(HistoricalDate date) {
        return date == null ? null
                : new ApiDate(date.year(), date.month(), date.day(), date.precision(), date.certainty(), null, null);
    }

    /** The column group {@code <prefix>_year … _certainty}; null when the year is NULL. */
    public static ApiDate read(ResultSet rs, String prefix) throws SQLException {
        return of(HistoricalDateColumns.read(rs, prefix));
    }

    /** Like {@link #read} plus {@code <prefix>_alternatives} and {@code <prefix>_note}. */
    public static ApiDate readWithNotes(ResultSet rs, String prefix, Lang lang) throws SQLException {
        HistoricalDate date = HistoricalDateColumns.read(rs, prefix);
        if (date == null) return null;
        return new ApiDate(date.year(), date.month(), date.day(), date.precision(), date.certainty(),
                lang.localize(JsonColumns.json(rs, prefix + "_alternatives")), lang.text(JsonColumns.json(rs, prefix + "_note")));
    }
}
