package az.tarix.platform.geo.internal.read;

import az.tarix.platform.geo.api.PlaceLookup.Point;
import az.tarix.platform.geo.api.Territories;
import az.tarix.platform.geo.api.Territories.Holder;
import az.tarix.platform.geo.api.Territories.SnapshotPick;
import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.EntityLinks;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The political map of a year (BACKEND_SPEC.md §10.1: {@code /territories}, {@code /polities/at}). */
@Service
public class TerritoryReader {

    /** The snapshot a map shows. {@code validToYear} null: the latest snapshot, open-ended. */
    public record SnapshotInfo(String slug, int year, int validFromYear, Integer validToYear, JsonNode title, Certainty certainty,
                               JsonNode note, List<ApiSource> sources) {}

    /**
     * @param labelAt where to write the name, {@code [lng, lat]}
     * @param capital catalogue place of the capital, or null
     */
    public record FeatureProperties(String polity, JsonNode name, String color, String capital, String vassalOf,
                                    Certainty certainty, double[] labelAt, Double areaKm2) {}

    public record Feature(String type, String id, JsonNode geometry, FeatureProperties properties) {}

    /**
     * A GeoJSON FeatureCollection with foreign members describing the year (RFC 7946 §6.1).
     *
     * @param covered  whether {@code snapshot} really describes {@code year}; in a gap it is the
     *                 nearest snapshot, to be drawn faded
     * @param prevYear in a gap, the last covered year before it
     * @param nextYear in a gap, the year of the next snapshot
     */
    public record TerritoryMap(String type, int year, boolean covered, Integer prevYear, Integer nextYear, SnapshotInfo snapshot,
                               List<Feature> features) {}

    /** A polity at a point; {@code available}: it has its own page ({@code /polities/{slug}}). */
    public record PolityAtPoint(String slug, JsonNode name, String color, String capital, String vassalOf, Certainty certainty,
                                boolean available) {}

    public record PolitiesAt(int year, double lat, double lng, boolean covered, String snapshot, Integer snapshotYear,
                             List<PolityAtPoint> polities) {}

    static final String SNAPSHOT = """
            SELECT slug, year, valid_from_year, valid_to_year, title, certainty, note, sources
            FROM territory_snapshot WHERE slug = :slug""";

    /** Coordinates rounded to 5 decimals (≈ 1 m), plenty for a map and a third smaller. */
    static final String FEATURES = """
            SELECT t.polity_slug, t.name, t.color, t.capital_place_slug, t.vassal_of_slug,
                   coalesce(t.certainty, s.certainty) AS certainty,
                   ST_AsGeoJSON(CASE WHEN :simplified THEN coalesce(t.geometry_simplified, t.geometry) ELSE t.geometry END, 5)
                       AS geometry,
                   ST_X(t.label_at) AS label_lng, ST_Y(t.label_at) AS label_lat, t.area_km2
            FROM polity_territory t JOIN territory_snapshot s ON s.id = t.snapshot_id
            WHERE s.slug = :slug
            ORDER BY t.sort_order""";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final Territories territories;
    private final EntityLinks links;

    TerritoryReader(JdbcClient jdbc, PublicCache cache, Territories territories, EntityLinks links) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.territories = territories;
        this.links = links;
    }

    private record MapKey(int year, boolean simplified) {}

    /** Three queries: the pick, the snapshot, its areas. */
    public TerritoryMap map(ReadContext ctx, int year, boolean simplified) {
        return cache.get(ctx, "territories", new MapKey(year, simplified), () -> {
            Lang lang = ctx.lang();
            SnapshotPick pick = territories.pick(year);
            if (pick.slug() == null) return new TerritoryMap("FeatureCollection", year, false, null, null, null, List.of());
            SnapshotInfo info = jdbc.sql(SNAPSHOT).param("slug", pick.slug())
                    .query((rs, n) -> new SnapshotInfo(rs.getString("slug"), rs.getInt("year"), rs.getInt("valid_from_year"),
                            JsonColumns.integer(rs, "valid_to_year"), lang.text(JsonColumns.json(rs, "title")),
                            Certainty.valueOf(rs.getString("certainty")), lang.text(JsonColumns.json(rs, "note")),
                            ApiSource.all(JsonColumns.json(rs, "sources"))))
                    .single();
            List<Feature> features = jdbc.sql(FEATURES).param("slug", pick.slug()).param("simplified", simplified)
                    .query((rs, n) -> new Feature("Feature", rs.getString("polity_slug"),
                            JsonMapper.shared().readTree(rs.getString("geometry")),
                            new FeatureProperties(rs.getString("polity_slug"), lang.text(JsonColumns.json(rs, "name")),
                                    rs.getString("color"), rs.getString("capital_place_slug"), rs.getString("vassal_of_slug"),
                                    Certainty.valueOf(rs.getString("certainty")),
                                    new double[] {rs.getDouble("label_lng"), rs.getDouble("label_lat")},
                                    (Double) rs.getObject("area_km2"))))
                    .list();
            return new TerritoryMap("FeatureCollection", year, pick.covered(), pick.prevYear(), pick.nextYear(), info, features);
        });
    }

    private record AtKey(double lat, double lng, int year) {}

    /** Every polity whose area contains the point in that year (BACKEND_SPEC.md §10.3): several for disputed lands. */
    public PolitiesAt politiesAt(ReadContext ctx, double lat, double lng, int year) {
        return cache.get(ctx, "polities-at", new AtKey(lat, lng, year), () -> {
            Lang lang = ctx.lang();
            SnapshotPick pick = territories.pick(year);
            List<Holder> holders = pick.covered() ? territories.at(new Point(lat, lng), year) : List.of();
            EntityLinks.Resolved resolved = links.resolve(holders.stream()
                    .map(h -> new EntityLinks.Target(EntityType.POLITY, h.politySlug())).toList());
            List<PolityAtPoint> polities = holders.stream().map(h -> new PolityAtPoint(h.politySlug(), lang.text(h.name()), h.color(),
                    h.capitalPlaceSlug(), h.vassalOf(), h.certainty(),
                    resolved.available(new EntityLinks.Target(EntityType.POLITY, h.politySlug())))).toList();
            return new PolitiesAt(year, lat, lng, pick.covered(), pick.covered() ? pick.slug() : null,
                    pick.covered() ? pick.year() : null, polities);
        });
    }
}
