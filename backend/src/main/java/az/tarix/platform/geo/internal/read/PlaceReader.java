package az.tarix.platform.geo.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.PlaceType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.EntityLinks;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import az.tarix.platform.shared.read.ResultPage;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** Places of the public API (BACKEND_SPEC.md §10.1: {@code /places}, {@code /places/{slug}}). */
@Service
public class PlaceReader {

    /** A place on the map or in a list. */
    public record PlaceCard(String slug, JsonNode historicalName, JsonNode modernName, PlaceType type, double lat, double lng,
                            int importance) {}

    /** The name a place had in a span of years (e.g. Konstantinopol before 1453). */
    public record NamePeriod(int fromYear, int toYear, JsonNode name) {}

    /** Content about this place that is announced but not written yet. */
    public record Upcoming(int year, JsonNode title, ApiLink ref, List<ApiSource> sources) {}

    public record PlaceDetail(String slug, JsonNode historicalName, JsonNode modernName, PlaceType type, double lat, double lng,
                              int importance, JsonNode description, List<NamePeriod> periods, List<Upcoming> upcoming,
                              List<ApiSource> sources) {}

    /** {@code minLng,minLat,maxLng,maxLat} of the visible map. */
    public record BoundingBox(double minLng, double minLat, double maxLng, double maxLat) {

        public static BoundingBox parse(String text) {
            if (text == null || text.isBlank()) return null;
            String[] parts = text.split(",");
            if (parts.length != 4) throw new InvalidParameterException("bbox", "minLng,minLat,maxLng,maxLat gözlənilir");
            double[] v = new double[4];
            for (int i = 0; i < 4; i++) {
                try {
                    v[i] = Double.parseDouble(parts[i].strip());
                } catch (NumberFormatException e) {
                    throw new InvalidParameterException("bbox", "rəqəm deyil: " + parts[i]);
                }
                if (!Double.isFinite(v[i])) throw new InvalidParameterException("bbox", "rəqəm deyil: " + parts[i]);
            }
            if (v[0] < -180 || v[2] > 180 || v[1] < -90 || v[3] > 90) throw new InvalidParameterException("bbox", "koordinat aralıqdan kənardır");
            if (v[0] > v[2] || v[1] > v[3]) throw new InvalidParameterException("bbox", "min dəyəri max-dan böyükdür");
            return new BoundingBox(v[0], v[1], v[2], v[3]);
        }
    }

    static final String LIST = """
            SELECT p.slug, p.historical_name, p.modern_name, p.place_type, ST_Y(p.location) AS lat, ST_X(p.location) AS lng,
                   p.importance, count(*) OVER () AS total
            FROM place p
            WHERE (CAST(:minLng AS float8) IS NULL
                   OR p.location && ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))
              AND (CAST(:minImportance AS int) IS NULL OR p.importance <= :minImportance)
            ORDER BY p.importance, p.slug
            LIMIT :limit OFFSET :offset""";

    static final String COUNT = """
            SELECT count(*) FROM place p
            WHERE (CAST(:minLng AS float8) IS NULL
                   OR p.location && ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))
              AND (CAST(:minImportance AS int) IS NULL OR p.importance <= :minImportance)""";

    static final String ONE = """
            SELECT p.id, p.slug, p.historical_name, p.modern_name, p.place_type, ST_Y(p.location) AS lat,
                   ST_X(p.location) AS lng, p.importance, p.description, p.sources
            FROM place p WHERE p.slug = :slug""";

    static final String PERIODS = "SELECT from_year, to_year, name FROM place_period WHERE place_id = :id ORDER BY from_year, to_year";

    static final String UPCOMING = "SELECT year, title, ref, sources FROM place_upcoming WHERE place_id = :id ORDER BY sort_order";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final EntityLinks links;

    PlaceReader(JdbcClient jdbc, PublicCache cache, EntityLinks links) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.links = links;
    }

    private record ListKey(BoundingBox box, Integer minImportance, ResultPage.Request page) {}

    /**
     * Places inside {@code box} (all when null), at least as important as {@code minImportance}
     * (1 = only the most important; null = all), most important first.
     */
    public ResultPage<PlaceCard> list(ReadContext ctx, BoundingBox box, Integer minImportance, ResultPage.Request page) {
        if (minImportance != null && (minImportance < 1 || minImportance > 3)) {
            throw new InvalidParameterException("minImportance", "1–3 aralığında olmalıdır");
        }
        return cache.get(ctx, "places", new ListKey(box, minImportance, page), () -> {
            Lang lang = ctx.lang();
            long[] total = {0};
            List<PlaceCard> items = jdbc.sql(LIST)
                    .param("minLng", box == null ? null : box.minLng()).param("minLat", box == null ? null : box.minLat())
                    .param("maxLng", box == null ? null : box.maxLng()).param("maxLat", box == null ? null : box.maxLat())
                    .param("minImportance", minImportance).param("limit", page.size()).param("offset", page.offset())
                    .query((rs, n) -> {
                        total[0] = rs.getLong("total");
                        return card(rs, lang);
                    }).list();
            if (items.isEmpty() && page.page() > 0) {
                total[0] = jdbc.sql(COUNT)
                        .param("minLng", box == null ? null : box.minLng()).param("minLat", box == null ? null : box.minLat())
                        .param("maxLng", box == null ? null : box.maxLng()).param("maxLat", box == null ? null : box.maxLat())
                        .param("minImportance", minImportance).query(Long.class).single();
            }
            return ResultPage.of(items, page, total[0]);
        });
    }

    public PlaceDetail detail(ReadContext ctx, String slug) {
        return cache.get(ctx, "place", slug, () -> {
            Lang lang = ctx.lang();
            record Row(UUID id, PlaceCard card, JsonNode description, JsonNode sources) {}
            Row row = jdbc.sql(ONE).param("slug", slug)
                    .query((rs, n) -> new Row(rs.getObject("id", UUID.class), card(rs, lang), JsonColumns.json(rs, "description"),
                            JsonColumns.json(rs, "sources")))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.PLACE, slug));
            List<NamePeriod> periods = jdbc.sql(PERIODS).param("id", row.id())
                    .query((rs, n) -> new NamePeriod(rs.getInt("from_year"), rs.getInt("to_year"), lang.text(JsonColumns.json(rs, "name"))))
                    .list();
            record UpcomingRow(int year, JsonNode title, JsonNode ref, JsonNode sources) {}
            List<UpcomingRow> upcoming = jdbc.sql(UPCOMING).param("id", row.id())
                    .query((rs, n) -> new UpcomingRow(rs.getInt("year"), JsonColumns.json(rs, "title"), JsonColumns.json(rs, "ref"),
                            JsonColumns.json(rs, "sources")))
                    .list();
            EntityLinks.Resolved resolved = links.resolveRefs(upcoming.stream().map(UpcomingRow::ref).filter(r -> r != null).toList());
            PlaceCard c = row.card();
            return new PlaceDetail(c.slug(), c.historicalName(), c.modernName(), c.type(), c.lat(), c.lng(), c.importance(),
                    lang.text(row.description()), periods,
                    upcoming.stream().map(u -> new Upcoming(u.year(), lang.text(u.title()),
                            u.ref() == null ? null : EntityLinks.link(u.ref(), "RELATED", null, resolved, lang),
                            ApiSource.all(u.sources()))).toList(),
                    ApiSource.all(row.sources()));
        });
    }

    static PlaceCard card(ResultSet rs, Lang lang) throws SQLException {
        return new PlaceCard(rs.getString("slug"), lang.text(JsonColumns.json(rs, "historical_name")),
                lang.text(JsonColumns.json(rs, "modern_name")), PlaceType.valueOf(rs.getString("place_type")),
                rs.getDouble("lat"), rs.getDouble("lng"), rs.getInt("importance"));
    }
}
