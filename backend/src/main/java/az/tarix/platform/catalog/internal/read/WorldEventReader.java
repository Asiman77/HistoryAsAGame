package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * "Meanwhile in the world" ({@code world_event}): the events the frontend shows next to a step
 * of a person or a state. Either every event in a span of years, or the frontend's own pick
 * for one year ({@code pickWorldEvents}, src/lib/worldContext.ts).
 */
@Component
public class WorldEventReader {

    /** Events further than this from the year are not "meanwhile" (frontend WINDOW_YEARS). */
    static final int WINDOW_YEARS = 12;

    public record WorldEventView(String slug, int year, Integer endYear, String region, JsonNode title, JsonNode description,
                                 List<ApiSource> sources) {}

    /** {@code year}: the pick mode; {@code from}/{@code to}: the span mode. */
    public record WorldEvents(Integer year, Integer from, Integer to, List<WorldEventView> items) {}

    static final String SPAN = """
            SELECT slug, year, end_year, region, title, description, sources FROM world_event
            WHERE year <= :to AND COALESCE(end_year, year) >= :from
            ORDER BY year, slug""";

    private final JdbcClient jdbc;
    private final PublicCache cache;

    WorldEventReader(JdbcClient jdbc, PublicCache cache) {
        this.jdbc = jdbc;
        this.cache = cache;
    }

    private record SpanKey(int from, int to) {}

    private record PickKey(int year, int limit) {}

    /** Every event that overlaps {@code [from, to]}, chronological. */
    public WorldEvents span(ReadContext ctx, int from, int to) {
        return cache.get(ctx, "world-events", new SpanKey(from, to),
                () -> new WorldEvents(null, from, to, query(from, to, ctx.lang())));
    }

    /** Up to {@code limit} events closest to the year (±12), different regions first, then chronological. */
    public WorldEvents around(ReadContext ctx, int year, int limit) {
        return cache.get(ctx, "world-events-around", new PickKey(year, limit),
                () -> new WorldEvents(year, null, null, pick(year, query(year - WINDOW_YEARS, year + WINDOW_YEARS, ctx.lang()), limit)));
    }

    private List<WorldEventView> query(int from, int to, Lang lang) {
        return jdbc.sql(SPAN).param("from", from).param("to", to).query((rs, n) -> new WorldEventView(rs.getString("slug"),
                rs.getInt("year"), JsonColumns.integer(rs, "end_year"), rs.getString("region"), lang.text(JsonColumns.json(rs, "title")),
                lang.text(JsonColumns.json(rs, "description")), ApiSource.all(JsonColumns.json(rs, "sources")))).list();
    }

    /** Years between {@code year} and the event's span (0 inside it). */
    static int gap(WorldEventView e, int year) {
        int end = e.endYear() != null ? e.endYear() : e.year();
        if (year < e.year()) return e.year() - year;
        if (year > end) return year - end;
        return 0;
    }

    /** The frontend's {@code pickWorldEvents}: nearest first, one per region before any region twice. */
    static List<WorldEventView> pick(int year, List<WorldEventView> events, int limit) {
        Comparator<WorldEventView> chronological = Comparator.comparingInt(WorldEventView::year).thenComparing(WorldEventView::slug);
        List<WorldEventView> near = events.stream().filter(e -> gap(e, year) <= WINDOW_YEARS)
                .sorted(Comparator.<WorldEventView>comparingInt(e -> gap(e, year)).thenComparing(chronological)).toList();
        List<WorldEventView> picked = new ArrayList<>();
        Set<String> regions = new HashSet<>();
        for (WorldEventView e : near) {
            if (picked.size() >= limit) break;
            if (regions.add(e.region())) picked.add(e);
        }
        for (WorldEventView e : near) {
            if (picked.size() >= limit) break;
            if (!picked.contains(e)) picked.add(e);
        }
        picked.sort(chronological);
        return List.copyOf(picked);
    }
}
