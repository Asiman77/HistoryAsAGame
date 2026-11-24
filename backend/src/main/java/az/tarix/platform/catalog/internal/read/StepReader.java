package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.geo.api.PlaceSummary;
import az.tarix.platform.media.api.ApiPortrait;
import az.tarix.platform.media.api.Portraits;
import az.tarix.platform.shared.domain.ClaimType;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.domain.Mood;
import az.tarix.platform.shared.domain.PlaceType;
import az.tarix.platform.shared.domain.StepKind;
import az.tarix.platform.shared.domain.StepTemplate;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiDate;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.ApiLink.Direction;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.EntityLinks;
import az.tarix.platform.shared.read.EntityLinks.Target;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.ReadContext;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Simulation steps of one owner (person, conflict or state) in the public API format
 * (BACKEND_SPEC.md §10.2), with claims, sources, links, the catalogue place of each location
 * and, for persons, the portrait for the age at the event. A fixed number of queries whatever
 * the number of steps (no N+1).
 */
@Component
public class StepReader {

    /** Where a step happens. {@code slug}/{@code type}: the catalogue place it belongs to, if any. */
    public record StepLocation(String slug, JsonNode name, JsonNode modernName, double lat, double lng, boolean approximate,
                        PlaceType type) {}

    /** A version of a disputed or legendary statement. */
    public record ClaimVersion(JsonNode text, List<ApiSource> sources) {}

    /** Where a legend was first written down. */
    public record FirstRecorded(ApiSource source, JsonNode note) {}

    public record ClaimView(String claimKey, ClaimType claimType, JsonNode text, JsonNode why, List<ClaimVersion> versions,
                     FirstRecorded firstRecorded, List<ApiSource> sources) {}

    /**
     * @param ageAtEvent     age of the person at the event (persons only)
     * @param ageApproximate whether that age is only approximate
     * @param route          GeoJSON LineString from {@code fromLocation} through the waypoints to {@code location}, or null
     * @param template       how the map shows the step (FRONTEND_SPEC §5.2); null when the content leaves it to the client
     * @param details        kind-specific fields (outcome, choice, quiz, liberated settlements, …)
     */
    public record StepView(String stepKey, int sequence, StepKind kind, ApiDate date, Integer ageAtEvent, Boolean ageApproximate,
                    JsonNode title, JsonNode factualSummary, JsonNode narrative, Mood mood, StepTemplate template,
                    ClaimType claimType,
                    List<ClaimView> claims, StepLocation location, StepLocation fromLocation, JsonNode route,
                    String territorySnapshot, String themeSlug, ApiPortrait portrait, List<ApiSource> sources,
                    List<ApiLink> related, JsonNode details) {}

    static final String FILTER = """
            s.owner_type = :ownerType AND s.owner_slug = :ownerSlug AND (CAST(:stepKey AS text) IS NULL OR s.step_key = :stepKey)""";

    static final String STEPS = """
            SELECT s.id, s.step_key, s.sequence, s.step_kind,
                   s.date_year, s.date_month, s.date_day, s.date_precision, s.date_certainty, s.date_alternatives, s.date_note,
                   s.title, s.factual_summary, s.narrative, s.mood, s.claim_type,
                   s.location_name, s.location_modern_name, ST_Y(s.location_point) AS location_lat,
                   ST_X(s.location_point) AS location_lng, s.location_approximate, s.location_place_slug,
                   s.from_location_name, s.from_location_modern_name, ST_Y(s.from_location_point) AS from_location_lat,
                   ST_X(s.from_location_point) AS from_location_lng, s.from_location_approximate, s.from_location_place_slug,
                   ST_AsGeoJSON(s.route) AS route, s.territory_snapshot_slug, s.theme_slug, s.age_at_event, s.age_approximate,
                   s.template, s.details
            FROM simulation_step s
            WHERE %s
            ORDER BY s.sequence""".formatted(FILTER);

    static final String CLAIMS = """
            SELECT c.id, c.step_id, c.claim_key, c.claim_type, c.text, c.why, c.versions, c.first_recorded
            FROM step_claim c JOIN simulation_step s ON s.id = c.step_id
            WHERE %s
            ORDER BY s.sequence, c.sort_order""".formatted(FILTER);

    static final String STEP_SOURCES = """
            SELECT x.step_id AS owner_id, x.locator, src.slug, src.title, src.authors, src.url, src.source_type
            FROM step_source x JOIN source src ON src.id = x.source_id JOIN simulation_step s ON s.id = x.step_id
            WHERE %s
            ORDER BY x.step_id, x.sort_order""".formatted(FILTER);

    static final String CLAIM_SOURCES = """
            SELECT x.claim_id AS owner_id, x.locator, src.slug, src.title, src.authors, src.url, src.source_type
            FROM claim_source x JOIN source src ON src.id = x.source_id
                 JOIN step_claim c ON c.id = x.claim_id JOIN simulation_step s ON s.id = c.step_id
            WHERE %s
            ORDER BY x.claim_id, x.sort_order""".formatted(FILTER);

    static final String RELATIONS = """
            SELECT r.source_step_key, r.target_type, r.target_slug, r.target_step_key, r.relation_type, r.label, r.note, r.sources
            FROM entity_relation r
            WHERE r.source_type = :ownerType AND r.source_slug = :ownerSlug AND r.source_step_key IS NOT NULL
              AND (CAST(:stepKey AS text) IS NULL OR r.source_step_key = :stepKey)
            ORDER BY r.sort_order, r.id""";

    private final JdbcClient jdbc;
    private final EntityLinks links;
    private final PlaceMatcher places;
    private final Portraits portraits;

    StepReader(JdbcClient jdbc, EntityLinks links, PlaceMatcher places, Portraits portraits) {
        this.jdbc = jdbc;
        this.links = links;
        this.portraits = portraits;
        this.places = places;
    }

    /** Raw step row, before places, links and portraits are attached. */
    private record Row(UUID id, String key, int sequence, StepKind kind, ApiDate date, Integer age, Boolean ageApproximate,
                       JsonNode title, JsonNode summary, JsonNode narrative, Mood mood, StepTemplate template, ClaimType claimType,
                       RawLocation location, RawLocation from, JsonNode route, String snapshot, String theme, JsonNode details) {}

    private record RawLocation(JsonNode name, JsonNode modernName, double lat, double lng, boolean approximate, String placeSlug) {}

    /** All steps of the owner in order, or only {@code stepKey} (empty when it does not exist). */
    List<StepView> of(EntityType ownerType, String ownerSlug, String stepKey, ReadContext ctx) {
        Lang lang = ctx.lang();
        Map<String, Object> filter = new HashMap<>();
        filter.put("ownerType", ownerType.name());
        filter.put("ownerSlug", ownerSlug);
        filter.put("stepKey", stepKey);

        List<Row> rows = jdbc.sql(STEPS).params(filter).query((rs, n) -> row(rs, lang)).list();
        if (rows.isEmpty()) return List.of();

        Map<UUID, List<ApiSource>> stepSources = sources(STEP_SOURCES, filter);
        Map<UUID, List<ApiSource>> claimSources = sources(CLAIM_SOURCES, filter);
        Map<UUID, List<ClaimView>> claims = new HashMap<>();
        jdbc.sql(CLAIMS).params(filter).query((rs, n) -> {
            UUID id = rs.getObject("id", UUID.class);
            claims.computeIfAbsent(rs.getObject("step_id", UUID.class), k -> new ArrayList<>()).add(new ClaimView(
                    rs.getString("claim_key"), ClaimType.valueOf(rs.getString("claim_type")), lang.text(JsonColumns.json(rs, "text")),
                    lang.text(JsonColumns.json(rs, "why")), versions(JsonColumns.json(rs, "versions"), lang),
                    firstRecorded(JsonColumns.json(rs, "first_recorded"), lang), claimSources.getOrDefault(id, List.of())));
            return id;
        }).list();

        Map<String, List<ApiLink>> related = related(filter, lang);
        Map<RawLocation, PlaceSummary> matched = matchPlaces(rows);
        List<ApiPortrait> agePortraits = ownerType == EntityType.PERSON ? portraits.of("PERSON", ownerSlug, ctx) : List.of();

        List<StepView> out = new ArrayList<>(rows.size());
        for (Row r : rows) {
            ApiPortrait portrait = r.age() == null ? null : ApiPortrait.pick(agePortraits, r.age());
            out.add(new StepView(r.key(), r.sequence(), r.kind(), r.date(), r.age(), r.ageApproximate(), r.title(), r.summary(),
                    r.narrative(), r.mood(), r.template(), r.claimType(), claims.getOrDefault(r.id(), List.of()),
                    location(r.location(), matched, lang), location(r.from(), matched, lang), r.route(), r.snapshot(), r.theme(),
                    portrait, stepSources.getOrDefault(r.id(), List.of()), related.getOrDefault(r.key(), List.of()), r.details()));
        }
        return out;
    }

    private static Row row(ResultSet rs, Lang lang) throws SQLException {
        String route = rs.getString("route");
        return new Row(rs.getObject("id", UUID.class), rs.getString("step_key"), rs.getInt("sequence"),
                StepKind.valueOf(rs.getString("step_kind")), ApiDate.readWithNotes(rs, "date", lang),
                JsonColumns.integer(rs, "age_at_event"), JsonColumns.bool(rs, "age_approximate"),
                lang.text(JsonColumns.json(rs, "title")), lang.text(JsonColumns.json(rs, "factual_summary")),
                lang.text(JsonColumns.json(rs, "narrative")), Mood.valueOf(rs.getString("mood")),
                rs.getString("template") == null ? null : StepTemplate.valueOf(rs.getString("template")),
                ClaimType.valueOf(rs.getString("claim_type")), rawLocation(rs, "location"), rawLocation(rs, "from_location"),
                route == null ? null : JsonMapper.shared().readTree(route), rs.getString("territory_snapshot_slug"),
                rs.getString("theme_slug"), lang.localize(JsonColumns.json(rs, "details")));
    }

    private static RawLocation rawLocation(ResultSet rs, String prefix) throws SQLException {
        JsonNode name = JsonColumns.json(rs, prefix + "_name");
        if (name == null) return null;
        return new RawLocation(name, JsonColumns.json(rs, prefix + "_modern_name"), rs.getDouble(prefix + "_lat"),
                rs.getDouble(prefix + "_lng"), Boolean.TRUE.equals(JsonColumns.bool(rs, prefix + "_approximate")),
                rs.getString(prefix + "_place_slug"));
    }

    /** The catalogue place of every location (ADR-0012), see {@link PlaceMatcher}. */
    private Map<RawLocation, PlaceSummary> matchPlaces(List<Row> rows) {
        record Item(RawLocation location, boolean warDay) {}
        List<Item> items = new ArrayList<>();
        for (Row r : rows) {
            for (RawLocation l : new RawLocation[] {r.location(), r.from()}) {
                if (l != null) items.add(new Item(l, r.kind() == StepKind.WAR_DAY));
            }
        }
        Map<RawLocation, PlaceSummary> out = new HashMap<>();
        places.match(items, i -> new PlaceMatcher.Query(i.location().placeSlug(), i.location().name().path("az").asString(""),
                i.location().lat(), i.location().lng(), i.warDay())).forEach((i, p) -> out.put(i.location(), p));
        return out;
    }

    private static StepLocation location(RawLocation l, Map<RawLocation, PlaceSummary> matched, Lang lang) {
        if (l == null) return null;
        PlaceSummary p = matched.get(l);
        return new StepLocation(p != null ? p.slug() : l.placeSlug(), lang.text(l.name()), lang.text(l.modernName()), l.lat(),
                l.lng(), l.approximate(), p == null ? null : p.type());
    }

    private Map<UUID, List<ApiSource>> sources(String sql, Map<String, Object> filter) {
        Map<UUID, List<ApiSource>> out = new HashMap<>();
        jdbc.sql(sql).params(filter).query((rs, n) -> {
            out.computeIfAbsent(rs.getObject("owner_id", UUID.class), k -> new ArrayList<>()).add(new ApiSource(rs.getString("slug"),
                    rs.getString("title"), rs.getString("authors"), rs.getString("url"), rs.getString("source_type"),
                    rs.getString("locator")));
            return 0;
        }).list();
        return out;
    }

    private Map<String, List<ApiLink>> related(Map<String, Object> filter, Lang lang) {
        List<RelationReader.Row> rows = jdbc.sql(RELATIONS).params(filter)
                .query((rs, n) -> new RelationReader.Row(Direction.OUTGOING, EntityType.valueOf(rs.getString("target_type")),
                        rs.getString("target_slug"), rs.getString("target_step_key"), rs.getString("source_step_key"),
                        rs.getString("relation_type"), JsonColumns.json(rs, "label"), JsonColumns.json(rs, "note"),
                        JsonColumns.json(rs, "sources")))
                .list();
        if (rows.isEmpty()) return Map.of();
        EntityLinks.Resolved resolved = links.resolve(rows.stream().map(r -> new Target(r.otherType(), r.otherSlug())).toList());
        Map<String, List<ApiLink>> out = new LinkedHashMap<>();
        for (RelationReader.Row r : rows) {
            out.computeIfAbsent(r.ownStep(), k -> new ArrayList<>()).add(RelationReader.toLink(r, resolved, lang));
        }
        return out;
    }

    private static List<ClaimVersion> versions(JsonNode versions, Lang lang) {
        if (versions == null || !versions.isArray()) return List.of();
        List<ClaimVersion> out = new ArrayList<>();
        for (JsonNode v : versions) out.add(new ClaimVersion(lang.text(v.path("text")), ApiSource.all(v.path("sources"))));
        return out;
    }

    private static FirstRecorded firstRecorded(JsonNode node, Lang lang) {
        if (node == null || !node.isObject()) return null;
        return new FirstRecorded(node.path("source").isObject() ? ApiSource.of(node.path("source")) : null,
                lang.text(node.path("note")));
    }
}
