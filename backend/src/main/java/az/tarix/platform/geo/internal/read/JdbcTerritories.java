package az.tarix.platform.geo.internal.read;

import az.tarix.platform.geo.api.PlaceLookup.Point;
import az.tarix.platform.geo.api.Territories;
import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.jdbc.JsonColumns;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** {@link Territories}: one query per call; the year rules are plain Java (unit-tested). */
@Component
class JdbcTerritories implements Territories {

    /** The latest snapshot not after the year and the first one after it. */
    static final String AROUND = """
            (SELECT 'B' AS side, slug, year FROM territory_snapshot WHERE year <= :year ORDER BY year DESC, slug DESC LIMIT 1)
            UNION ALL
            (SELECT 'A' AS side, slug, year FROM territory_snapshot WHERE year > :year ORDER BY year, slug LIMIT 1)""";

    static final String HOLDER_COLUMNS = """
            t.polity_slug, t.name, t.color, t.capital_place_slug, t.vassal_of_slug, coalesce(t.certainty, s.certainty) AS certainty""";

    static final String AT = """
            SELECT %s
            FROM territory_snapshot s JOIN polity_territory t ON t.snapshot_id = s.id
            WHERE s.id = (SELECT id FROM territory_snapshot WHERE year <= :year ORDER BY year DESC, slug DESC LIMIT 1)
              AND :year - s.year <= :reach
              AND ST_Intersects(t.geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
            ORDER BY t.sort_order""".formatted(HOLDER_COLUMNS);

    static final String HOLDERS = """
            SELECT %s
            FROM territory_snapshot s JOIN polity_territory t ON t.snapshot_id = s.id
            WHERE s.slug = :slug
            ORDER BY t.sort_order""".formatted(HOLDER_COLUMNS);

    /**
     * One row per snapshot with the first area (authored order) containing the place, plus the
     * years the place existed; a single row with a NULL snapshot when there are no snapshots.
     */
    static final String MEMBERSHIP = """
            SELECT p.slug AS place_slug,
                   (SELECT min(from_year) FROM place_period WHERE place_id = p.id) AS lived_from,
                   (SELECT max(to_year) FROM place_period WHERE place_id = p.id) AS lived_to,
                   s.year, s.certainty, o.polity_slug, o.name, o.color, o.capital_place_slug, o.vassal_of_slug
            FROM place p
            LEFT JOIN territory_snapshot s ON true
            LEFT JOIN LATERAL (
              SELECT t.* FROM polity_territory t
              WHERE t.snapshot_id = s.id AND ST_Intersects(t.geometry, p.location)
              ORDER BY t.sort_order LIMIT 1) o ON true
            WHERE p.slug = :slug
            ORDER BY s.year, s.slug""";

    private final JdbcClient jdbc;

    JdbcTerritories(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    record Snapshot(String slug, int year) {}

    /** Frontend {@code snapshotForYear}. */
    static SnapshotPick choose(int year, Snapshot before, Snapshot after) {
        boolean covered = before != null && year - before.year() <= REACH_YEARS;
        if (covered) return new SnapshotPick(before.slug(), before.year(), true, null, null);
        Snapshot nearest = before == null ? after
                : after == null ? before
                : Math.abs(after.year() - year) < Math.abs(before.year() - year) ? after : before;
        if (nearest == null) return SnapshotPick.NONE;
        return new SnapshotPick(nearest.slug(), nearest.year(), false,
                before == null ? null : Math.min(before.year() + REACH_YEARS, year - 1), after == null ? null : after.year());
    }

    @Override
    public SnapshotPick pick(int year) {
        Snapshot[] around = new Snapshot[2];
        jdbc.sql(AROUND).param("year", year).query((rs, n) -> {
            around["B".equals(rs.getString("side")) ? 0 : 1] = new Snapshot(rs.getString("slug"), rs.getInt("year"));
            return n;
        }).list();
        return choose(year, around[0], around[1]);
    }

    @Override
    public List<Holder> at(Point point, int year) {
        return jdbc.sql(AT).param("year", year).param("reach", REACH_YEARS).param("lat", point.lat()).param("lng", point.lng())
                .query((rs, n) -> holder(rs)).list();
    }

    @Override
    public List<Holder> holders(String snapshotSlug) {
        return jdbc.sql(HOLDERS).param("slug", snapshotSlug).query((rs, n) -> holder(rs)).list();
    }

    private static Holder holder(ResultSet rs) throws SQLException {
        return new Holder(rs.getString("polity_slug"), JsonColumns.json(rs, "name"), rs.getString("color"),
                rs.getString("capital_place_slug"), rs.getString("vassal_of_slug"), Certainty.valueOf(rs.getString("certainty")));
    }

    /** One snapshot as seen from a place: who held it (null owner = outside every drawn area). */
    record Seen(int year, Certainty certainty, String politySlug, JsonNode name, String color, String capitalPlaceSlug,
                String vassalOf) {}

    @Override
    public Optional<List<MembershipSpan>> membership(String placeSlug) {
        record Row(Integer livedFrom, Integer livedTo, Seen seen) {}
        List<Row> rows = jdbc.sql(MEMBERSHIP).param("slug", placeSlug).query((rs, n) -> {
            Integer year = JsonColumns.integer(rs, "year");
            Seen seen = year == null ? null : new Seen(year, Certainty.valueOf(rs.getString("certainty")),
                    rs.getString("polity_slug"), JsonColumns.json(rs, "name"), rs.getString("color"),
                    rs.getString("capital_place_slug"), rs.getString("vassal_of_slug"));
            return new Row(JsonColumns.integer(rs, "lived_from"), JsonColumns.integer(rs, "lived_to"), seen);
        }).list();
        if (rows.isEmpty()) return Optional.empty();
        List<Seen> seen = rows.stream().map(Row::seen).filter(s -> s != null).toList();
        Row first = rows.getFirst();
        if (first.livedFrom() == null) return Optional.of(List.of());
        return Optional.of(clip(spans(placeSlug, seen), first.livedFrom(), first.livedTo()));
    }

    /** Frontend {@code placeMembership}: {@code seen} is in year order. */
    static List<MembershipSpan> spans(String placeSlug, List<Seen> seen) {
        List<MembershipSpan> out = new ArrayList<>();
        for (int i = 0; i < seen.size(); i++) {
            Seen s = seen.get(i);
            Seen next = i + 1 < seen.size() ? seen.get(i + 1) : null;
            int reach = Math.min(next != null ? next.year() - 1 : s.year(), s.year() + REACH_YEARS);
            if (s.politySlug() != null) {
                boolean capital = placeSlug.equals(s.capitalPlaceSlug());
                MembershipSpan last = out.isEmpty() ? null : out.getLast();
                if (last != null && last.kind() == MembershipSpan.Kind.POLITY && last.politySlug().equals(s.politySlug())
                        && last.capital() == capital && last.toYear() >= s.year() - 1) {
                    out.set(out.size() - 1, new MembershipSpan(last.kind(), last.fromYear(), reach, last.politySlug(), last.name(),
                            last.color(), last.capital(), last.vassalOf(), last.certainty()));
                } else {
                    out.add(new MembershipSpan(MembershipSpan.Kind.POLITY, s.year(), reach, s.politySlug(), s.name(), s.color(),
                            capital, s.vassalOf(), s.certainty()));
                }
            }
            if (next != null && reach < next.year() - 1) {
                out.add(new MembershipSpan(MembershipSpan.Kind.GAP, reach + 1, next.year() - 1, null, null, null, false, null, null));
            }
        }
        return out;
    }

    /** Frontend {@code clipToLifetime}: only the years the place existed, without gaps at either end. */
    static List<MembershipSpan> clip(List<MembershipSpan> spans, int from, int to) {
        List<MembershipSpan> clipped = spans.stream().filter(s -> s.toYear() >= from && s.fromYear() <= to)
                .map(s -> new MembershipSpan(s.kind(), Math.max(s.fromYear(), from), Math.min(s.toYear(), to), s.politySlug(),
                        s.name(), s.color(), s.capital(), s.vassalOf(), s.certainty()))
                .toList();
        List<MembershipSpan> out = new ArrayList<>();
        for (int i = 0; i < clipped.size(); i++) {
            boolean edge = i == 0 || i == clipped.size() - 1;
            if (!(clipped.get(i).kind() == MembershipSpan.Kind.GAP && edge)) out.add(clipped.get(i));
        }
        return out;
    }
}
