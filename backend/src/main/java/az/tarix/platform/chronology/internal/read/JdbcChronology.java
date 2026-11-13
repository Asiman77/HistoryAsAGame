package az.tarix.platform.chronology.internal.read;

import az.tarix.platform.chronology.api.Chronology;
import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.jdbc.JsonColumns;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** {@link Chronology}, one query per call. */
@Component
class JdbcChronology implements Chronology {

    static final String REIGNS_IN = """
            SELECT p.slug AS polity_slug, p.name AS polity_name, p.color AS polity_color, g.ruler_slug, r.name AS ruler_name,
                   g.start_year, g.start_month, g.end_year, g.end_month, g.certainty
            FROM reign g JOIN polity p ON p.id = g.polity_id LEFT JOIN ruler r ON r.slug = g.ruler_slug
            WHERE g.start_year <= :year AND (g.end_year IS NULL OR g.end_year >= :year)
            ORDER BY p.slug, g.start_year, g.start_month NULLS FIRST, g.sort_order""";

    private final JdbcClient jdbc;

    JdbcChronology(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Era> eras() {
        return jdbc.sql(ChronologyReader.ERAS).query((rs, n) -> new Era(rs.getString("slug"), JsonColumns.json(rs, "name"),
                rs.getInt("start_year"), rs.getInt("end_year"), rs.getString("theme_slug"), rs.getString("color"))).list();
    }

    @Override
    public List<ReignAt> reignsIn(int year) {
        return jdbc.sql(REIGNS_IN).param("year", year).query((rs, n) -> new ReignAt(rs.getString("polity_slug"),
                JsonColumns.json(rs, "polity_name"), rs.getString("polity_color"), rs.getString("ruler_slug"),
                JsonColumns.json(rs, "ruler_name"), rs.getInt("start_year"), JsonColumns.integer(rs, "start_month"),
                JsonColumns.integer(rs, "end_year"), JsonColumns.integer(rs, "end_month"),
                Certainty.valueOf(rs.getString("certainty")))).list();
    }
}
