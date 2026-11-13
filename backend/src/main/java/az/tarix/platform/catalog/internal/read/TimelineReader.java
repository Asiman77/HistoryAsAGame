package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.HistoryIndex.IndexEvent;
import az.tarix.platform.chronology.api.Chronology;
import az.tarix.platform.chronology.api.Chronology.Era;
import az.tarix.platform.chronology.api.Chronology.ReignAt;
import az.tarix.platform.geo.api.PlaceLookup;
import az.tarix.platform.geo.api.PlaceSummary;
import az.tarix.platform.geo.api.Territories;
import az.tarix.platform.geo.api.Territories.Holder;
import az.tarix.platform.geo.api.Territories.SnapshotPick;
import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.EntityLinks;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import java.time.MonthDay;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** The global time slider and "Tarixdə bu gün" (BACKEND_SPEC.md §10.1: {@code /timeline}, {@code /on-this-day}). */
@Service
public class TimelineReader {

    /**
     * How much the platform knows about a year (BACKEND_SPEC.md §10.3).
     * {@code FULL}: a territory map covers it; {@code PARTIAL}: no map, but rulers, living persons
     * or events; {@code NONE}: nothing ("Bu dövr üçün məzmun hazırlanır").
     */
    public enum Coverage { FULL, PARTIAL, NONE }

    public record EraRef(String slug, JsonNode name, int startYear, int endYear, String themeSlug, String color) {}

    /** The map for the year; see {@code /territories} for its areas. */
    public record MapPick(String snapshot, Integer snapshotYear, boolean covered, Integer prevYear, Integer nextYear) {}

    /** A capital on the drawn map. */
    public record Capital(String polity, JsonNode polityName, String color, String place, JsonNode placeName, double lat, double lng) {}

    /** A reign running in the year; {@code ruler.available}: the ruler has a page. */
    public record RulerAtYear(String polity, JsonNode polityName, String polityColor, ApiLink ruler, int startYear,
                              Integer startMonth, Integer endYear, Integer endMonth, Certainty certainty) {}

    /**
     * A person alive in the year, where the steps last placed them.
     *
     * @param ageApproximate the birth year is not exact
     */
    public record PersonAtYear(String slug, JsonNode name, ApiImage portrait, int birthYear, Integer deathYear, int age,
                               boolean ageApproximate, Double lat, Double lng) {}

    /** For a year without events: the closest years before and after that have some. */
    public record NearestYears(Integer prev, Integer next) {}

    public record YearView(int year, Coverage coverage, EraRef era, String themeSlug, MapPick map, List<Capital> capitals,
                           List<RulerAtYear> rulers, List<PersonAtYear> persons, List<IndexEvent> events,
                           NearestYears nearestEventYears) {}

    /** {@code DAY}: events of that very day; {@code MONTH}: none that day, events of the month; {@code NONE}: neither. */
    public enum DayMode { DAY, MONTH, NONE }

    /** A date the platform marks specially (27 September, 8 November…). */
    public record Commemoration(String slug, String style, JsonNode title, JsonNode description, ApiLink ref) {}

    public record OnThisDay(int month, int day, DayMode mode, Commemoration commemoration, List<IndexEvent> events) {}

    /** Persons alive in the year and their position: the last step up to the year, else their first step. */
    static final String PERSONS = """
            SELECT p.slug, coalesce(p.short_name, p.name) AS name, p.portrait, p.birth_year, p.birth_certainty, p.death_year,
                   pos.lat, pos.lng
            FROM person p
            LEFT JOIN LATERAL (
              SELECT ST_Y(s.location_point) AS lat, ST_X(s.location_point) AS lng
              FROM simulation_step s
              WHERE s.owner_type = 'PERSON' AND s.owner_slug = p.slug
              ORDER BY (s.date_year <= :year) DESC, CASE WHEN s.date_year <= :year THEN -s.sequence ELSE s.sequence END
              LIMIT 1) pos ON true
            WHERE p.birth_year <= :year AND (p.death_year IS NULL OR p.death_year >= :year)
            ORDER BY p.birth_sort_key, p.slug""";

    static final String NEAREST_YEARS = """
            SELECT max(date_year) FILTER (WHERE date_year < :year) AS prev, min(date_year) FILTER (WHERE date_year > :year) AS next
            FROM simulation_step""";

    static final String COMMEMORATION = """
            SELECT slug, style, title, description, ref FROM commemoration WHERE month = :month AND day = :day
            ORDER BY slug LIMIT 1""";

    static final String IN_YEAR = "s.date_year = :year";
    static final String ON_DAY = "s.date_month = :month AND s.date_day = :day";
    static final String IN_MONTH = "s.date_month = :month";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final HistoryIndex index;
    private final Chronology chronology;
    private final Territories territories;
    private final PlaceLookup places;
    private final EntityLinks links;

    TimelineReader(JdbcClient jdbc, PublicCache cache, HistoryIndex index, Chronology chronology, Territories territories,
                   PlaceLookup places, EntityLinks links) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.index = index;
        this.chronology = chronology;
        this.territories = territories;
        this.places = places;
        this.links = links;
    }

    /** One year of the slider; a fixed number of queries. */
    public YearView year(ReadContext ctx, int year) {
        return cache.get(ctx, "timeline", year, () -> {
            Lang lang = ctx.lang();
            SnapshotPick pick = territories.pick(year);
            List<Capital> capitals = capitals(pick, lang);
            List<RulerAtYear> rulers = chronology.reignsIn(year).stream().map(r -> ruler(r, lang)).toList();
            List<PersonAtYear> persons = jdbc.sql(PERSONS).param("year", year).query((rs, n) -> {
                int born = rs.getInt("birth_year");
                return new PersonAtYear(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                        ApiImage.of(JsonColumns.json(rs, "portrait"), lang), born, JsonColumns.integer(rs, "death_year"),
                        year - born, !Certainty.EXACT.name().equals(rs.getString("birth_certainty")),
                        (Double) rs.getObject("lat"), (Double) rs.getObject("lng"));
            }).list();
            List<IndexEvent> events = index.where(IN_YEAR, Map.of("year", year), lang);
            NearestYears nearest = jdbc.sql(NEAREST_YEARS).param("year", year)
                    .query((rs, n) -> new NearestYears(JsonColumns.integer(rs, "prev"), JsonColumns.integer(rs, "next"))).single();
            Era era = Chronology.eraFor(chronology.eras(), year);
            Coverage coverage = pick.covered() ? Coverage.FULL
                    : rulers.isEmpty() && persons.isEmpty() && events.isEmpty() ? Coverage.NONE : Coverage.PARTIAL;
            return new YearView(year, coverage,
                    era == null ? null : new EraRef(era.slug(), lang.text(era.name()), era.startYear(), era.endYear(),
                            era.themeSlug(), era.color()),
                    era == null ? HistoryIndex.DEFAULT_THEME : era.themeSlug(),
                    new MapPick(pick.slug(), pick.year(), pick.covered(), pick.prevYear(), pick.nextYear()),
                    capitals, rulers, persons, events, nearest);
        });
    }

    /** Capitals of the drawn map (covered or the faded nearest one), with their catalogue place. */
    private List<Capital> capitals(SnapshotPick pick, Lang lang) {
        if (pick.slug() == null) return List.of();
        List<Holder> holders = territories.holders(pick.slug()).stream().filter(h -> h.capitalPlaceSlug() != null).toList();
        Map<String, PlaceSummary> placed = places.bySlugs(holders.stream().map(Holder::capitalPlaceSlug).distinct().toList());
        List<Capital> out = new ArrayList<>();
        for (Holder h : holders) {
            PlaceSummary p = placed.get(h.capitalPlaceSlug());
            if (p != null) {
                out.add(new Capital(h.politySlug(), lang.text(h.name()), h.color(), p.slug(), lang.text(p.historicalName()),
                        p.lat(), p.lng()));
            }
        }
        return out;
    }

    private static RulerAtYear ruler(ReignAt r, Lang lang) {
        boolean available = r.rulerName() != null;
        ApiLink link = new ApiLink(EntityType.RULER, r.rulerSlug(), null, "RULER",
                ApiLink.Direction.OUTGOING, available, available ? lang.text(r.rulerName()) : null, null, null, null, List.of());
        return new RulerAtYear(r.politySlug(), lang.text(r.polityName()), r.polityColor(), link, r.startYear(), r.startMonth(),
                r.endYear(), r.endMonth(), r.certainty());
    }

    private record DayKey(int month, int day) {}

    /**
     * Frontend {@code onThisDay}: steps dated to that very day (by year); when there are none,
     * the steps of the month, ordered by day (month-only dates last), then year.
     */
    public OnThisDay onThisDay(ReadContext ctx, Integer month, Integer day) {
        MonthDay date = monthDay(month, day);
        return cache.get(ctx, "on-this-day", new DayKey(date.getMonthValue(), date.getDayOfMonth()), () -> {
            Lang lang = ctx.lang();
            Map<String, Integer> params = Map.of("month", date.getMonthValue(), "day", date.getDayOfMonth());
            Commemoration commemoration = commemoration(params, lang);
            List<IndexEvent> sameDay = index.where(ON_DAY, params, lang).stream()
                    .sorted(Comparator.comparingInt(e -> e.date().year())).toList();
            if (!sameDay.isEmpty()) return new OnThisDay(date.getMonthValue(), date.getDayOfMonth(), DayMode.DAY, commemoration, sameDay);
            List<IndexEvent> sameMonth = index.where(IN_MONTH, Map.of("month", date.getMonthValue()), lang).stream()
                    .sorted(Comparator.<IndexEvent>comparingInt(e -> e.date().day() == null ? 99 : e.date().day())
                            .thenComparingInt(e -> e.date().year()))
                    .toList();
            return new OnThisDay(date.getMonthValue(), date.getDayOfMonth(), sameMonth.isEmpty() ? DayMode.NONE : DayMode.MONTH,
                    commemoration, sameMonth);
        });
    }

    private Commemoration commemoration(Map<String, Integer> params, Lang lang) {
        record Row(String slug, String style, JsonNode title, JsonNode description, JsonNode ref) {}
        Row row = jdbc.sql(COMMEMORATION).params(params).query((rs, n) -> new Row(rs.getString("slug"), rs.getString("style"),
                JsonColumns.json(rs, "title"), JsonColumns.json(rs, "description"), JsonColumns.json(rs, "ref"))).optional()
                .orElse(null);
        if (row == null) return null;
        ApiLink ref = null;
        if (row.ref() != null) ref = EntityLinks.link(row.ref(), "RELATED", null, links.resolveRefs(List.of(row.ref())), lang);
        return new Commemoration(row.slug(), row.style(), lang.text(row.title()), lang.text(row.description()), ref);
    }

    /** A real calendar day; 29 February is allowed (it is a day in leap years). */
    static MonthDay monthDay(Integer month, Integer day) {
        if (month == null) throw new InvalidParameterException("month", "məcburidir");
        if (day == null) throw new InvalidParameterException("day", "məcburidir");
        if (month < 1 || month > 12) throw new InvalidParameterException("month", "1–12 aralığında olmalıdır");
        if (day < 1 || day > java.time.Month.of(month).maxLength()) {
            throw new InvalidParameterException("day", "bu ayda belə gün yoxdur");
        }
        return MonthDay.of(month, day);
    }
}
