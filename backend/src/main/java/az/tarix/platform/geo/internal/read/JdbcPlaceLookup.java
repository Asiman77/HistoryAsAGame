package az.tarix.platform.geo.internal.read;

import az.tarix.platform.geo.api.PlaceLookup;
import az.tarix.platform.geo.api.PlaceSummary;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.domain.PlaceType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.EntityDirectory;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** {@link PlaceLookup} and the PLACE {@link EntityDirectory}, one query per call. */
@Component
class JdbcPlaceLookup implements PlaceLookup, EntityDirectory {

    static final String COLUMNS = """
            p.slug, p.historical_name, p.modern_name, p.place_type, ST_Y(p.location) AS lat, ST_X(p.location) AS lng,
            p.importance""";

    static final String BY_SLUGS = "SELECT " + COLUMNS + " FROM place p WHERE p.slug = ANY (CAST(:slugs AS text[]))";

    /**
     * Great-circle distance with R = 6371 km, the formula of the frontend's {@code distanceKm},
     * so a location on the 30 km boundary matches the same place on both sides. The geography
     * index narrows the candidates first (a slightly larger radius, the spheroid differs a little).
     */
    static final String NEAREST = """
            SELECT q.ord, m.*
            FROM unnest(CAST(:lats AS float8[]), CAST(:lngs AS float8[])) WITH ORDINALITY AS q(lat, lng, ord)
            LEFT JOIN LATERAL (
              SELECT %s, d.km
              FROM place p
              CROSS JOIN LATERAL (SELECT 2 * 6371 * asin(least(1, sqrt(
                  power(sin(radians(ST_Y(p.location) - q.lat) / 2), 2)
                  + cos(radians(q.lat)) * cos(radians(ST_Y(p.location))) * power(sin(radians(ST_X(p.location) - q.lng) / 2), 2)
                ))) AS km) d
              WHERE ST_DWithin(p.location::geography, ST_SetSRID(ST_MakePoint(q.lng, q.lat), 4326)::geography, :prefilterMeters)
                AND d.km < :km
              ORDER BY d.km, p.slug
              LIMIT 1) m ON true
            ORDER BY q.ord""".formatted(COLUMNS);

    static final String BY_NAME = """
            SELECT n.name AS matched_name, m.*
            FROM unnest(CAST(:names AS text[])) AS n(name)
            JOIN LATERAL (
              SELECT %s FROM place p
              WHERE split_part(p.historical_name ->> 'az', ' (', 1) = n.name
                 OR split_part(p.modern_name ->> 'az', ' (', 1) = n.name
              ORDER BY p.importance, p.slug
              LIMIT 1) m ON true""".formatted(COLUMNS);

    static final String NAMES = "SELECT slug, historical_name FROM place WHERE slug = ANY (CAST(:slugs AS text[]))";

    private final JdbcClient jdbc;

    JdbcPlaceLookup(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    static PlaceSummary summary(ResultSet rs) throws SQLException {
        String slug = rs.getString("slug");
        if (slug == null) return null;
        return new PlaceSummary(slug, JsonColumns.json(rs, "historical_name"), JsonColumns.json(rs, "modern_name"),
                PlaceType.valueOf(rs.getString("place_type")), rs.getDouble("lat"), rs.getDouble("lng"), rs.getInt("importance"));
    }

    @Override
    public Map<String, PlaceSummary> bySlugs(Collection<String> slugs) {
        if (slugs.isEmpty()) return Map.of();
        Map<String, PlaceSummary> out = new HashMap<>();
        jdbc.sql(BY_SLUGS).param("slugs", slugs.toArray(String[]::new)).query((rs, n) -> summary(rs)).list()
                .forEach(p -> out.put(p.slug(), p));
        return out;
    }

    @Override
    public List<PlaceSummary> nearest(List<Point> points) {
        if (points.isEmpty()) return List.of();
        Double[] lats = points.stream().map(Point::lat).toArray(Double[]::new);
        Double[] lngs = points.stream().map(Point::lng).toArray(Double[]::new);
        List<PlaceSummary> out = new ArrayList<>(points.size());
        jdbc.sql(NEAREST).param("lats", lats).param("lngs", lngs).param("km", MATCH_KM)
                .param("prefilterMeters", MATCH_KM * 1000 * 1.01)
                .query((rs, n) -> summary(rs)).list().forEach(out::add);
        return out;
    }

    @Override
    public Map<String, PlaceSummary> byName(Collection<String> names) {
        if (names.isEmpty()) return Map.of();
        Map<String, PlaceSummary> out = new LinkedHashMap<>();
        jdbc.sql(BY_NAME).param("names", names.toArray(String[]::new))
                .query((rs, n) -> Map.entry(rs.getString("matched_name"), summary(rs))).list()
                .forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }

    @Override
    public Set<EntityType> types() {
        return Set.of(EntityType.PLACE);
    }

    @Override
    public Map<String, JsonNode> names(EntityType type, Collection<String> slugs) {
        if (slugs.isEmpty()) return Map.of();
        Map<String, JsonNode> out = new HashMap<>();
        jdbc.sql(NAMES).param("slugs", slugs.toArray(String[]::new))
                .query((rs, n) -> Map.entry(rs.getString("slug"), JsonColumns.json(rs, "historical_name"))).list()
                .forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }
}
