package az.tarix.platform.catalog.internal.projection;

import static az.tarix.platform.shared.content.ContentValues.bool;
import static az.tarix.platform.shared.content.ContentValues.enumName;
import static az.tarix.platform.shared.content.ContentValues.json;
import static az.tarix.platform.shared.content.ContentValues.jsonArray;
import static az.tarix.platform.shared.content.ContentValues.number;
import static az.tarix.platform.shared.content.ContentValues.present;
import static az.tarix.platform.shared.content.ContentValues.text;

import az.tarix.platform.shared.content.ContentValues;
import az.tarix.platform.shared.domain.HistoricalDate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Simulation steps (life events, war days, state steps) with their claims, sources and
 * cross-links (V006, ADR-0007). Sources are deduplicated across documents by content hash.
 */
@Component
class StepWriter {

    /** Step fields that have columns or rows of their own; everything else goes to {@code details}. */
    static final Set<String> MAPPED = Set.of("id", "order", "date", "title", "factualSummary", "summary", "narrative", "mood",
            "claimType", "claims", "sources", "location", "fromLocation", "route", "territorySnapshotId", "themeId",
            "personId", "related");

    static final String INSERT_STEP = """
            INSERT INTO simulation_step (
              owner_type, owner_slug, step_key, sequence, step_kind,
              date_year, date_month, date_day, date_precision, date_certainty, date_alternatives, date_note,
              title, factual_summary, narrative, mood, claim_type,
              location_name, location_modern_name, location_point, location_approximate, location_place_slug,
              from_location_name, from_location_modern_name, from_location_point, from_location_approximate,
              from_location_place_slug, route, territory_snapshot_slug, theme_slug, age_at_event, age_approximate,
              details, document_id)
            VALUES (
              :ownerType, :owner, :key, :sequence, :kind,
              :date_year, :date_month, :date_day, :date_precision, :date_certainty,
              CAST(:date_alternatives AS jsonb), CAST(:date_note AS jsonb),
              CAST(:title AS jsonb), CAST(:summary AS jsonb), CAST(:narrative AS jsonb), :mood, :claimType,
              CAST(:locName AS jsonb), CAST(:locModern AS jsonb), ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
              coalesce(CAST(:locApprox AS boolean), false), :locPlace,
              CAST(:fromName AS jsonb), CAST(:fromModern AS jsonb),
              CASE WHEN CAST(:fromLng AS double precision) IS NULL THEN NULL
                   ELSE ST_SetSRID(ST_MakePoint(CAST(:fromLng AS double precision), CAST(:fromLat AS double precision)), 4326) END,
              CAST(:fromApprox AS boolean), :fromPlace,
              ST_SetSRID(ST_GeomFromGeoJSON(CAST(:route AS text)), 4326), :snapshot, :theme, :age, :ageApprox,
              CAST(:details AS jsonb), :doc)
            RETURNING id""";

    static final String INSERT_CLAIM = """
            INSERT INTO step_claim (step_id, claim_key, claim_type, text, why, versions, first_recorded, sort_order)
            VALUES (:step, :key, :type, CAST(:text AS jsonb), CAST(:why AS jsonb), CAST(:versions AS jsonb),
                    CAST(:firstRecorded AS jsonb), :sort)
            RETURNING id""";

    /** DO UPDATE (a no-op change) so that RETURNING gives the id of an existing row too. */
    static final String UPSERT_SOURCE = """
            INSERT INTO source (slug, title, authors, url, source_type, content_hash)
            VALUES (:slug, :title, :authors, :url, :type, :hash)
            ON CONFLICT (content_hash) DO UPDATE SET title = EXCLUDED.title
            RETURNING id""";

    static final String INSERT_STEP_SOURCE = """
            INSERT INTO step_source (step_id, source_id, locator, sort_order) VALUES (:owner, :source, :locator, :sort)""";

    static final String INSERT_CLAIM_SOURCE = """
            INSERT INTO claim_source (claim_id, source_id, locator, sort_order) VALUES (:owner, :source, :locator, :sort)""";

    static final String INSERT_RELATION = """
            INSERT INTO entity_relation (source_type, source_slug, source_step_key, target_type, target_slug, target_step_key,
                                         relation_type, label, note, sources, sort_order, document_id)
            VALUES (:sourceType, :sourceSlug, :sourceStep, :targetType, :targetSlug, :targetStep, :relation,
                    CAST(:label AS jsonb), CAST(:note AS jsonb), CAST(:sources AS jsonb), :sort, :doc)""";

    /** Sources no step or claim refers to any more. */
    static final String DELETE_UNUSED_SOURCES = """
            DELETE FROM source s
            WHERE NOT EXISTS (SELECT 1 FROM step_source x WHERE x.source_id = s.id)
              AND NOT EXISTS (SELECT 1 FROM claim_source x WHERE x.source_id = s.id)""";

    private final JdbcClient jdbc;

    StepWriter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Where a step belongs and how it is shown. */
    record Owner(String type, String slug, String kind, UUID documentId, HistoricalDate birth) {}

    void write(Owner owner, JsonNode step, int relationSort) {
        UUID stepId = insertStep(owner, step);
        int sort = 0;
        for (JsonNode s : step.path("sources")) link(INSERT_STEP_SOURCE, stepId, s, sort++);
        sort = 0;
        for (JsonNode c : step.path("claims")) {
            UUID claimId = jdbc.sql(INSERT_CLAIM).param("step", stepId).param("key", text(c.path("id")))
                    .param("type", enumName(c.path("claimType"))).param("text", json(c.path("text")))
                    .param("why", json(c.path("why"))).param("versions", json(c.path("versions")))
                    .param("firstRecorded", json(c.path("firstRecorded"))).param("sort", sort++)
                    .query(UUID.class).single();
            int s = 0;
            for (JsonNode src : c.path("sources")) link(INSERT_CLAIM_SOURCE, claimId, src, s++);
        }
        sort = relationSort;
        for (JsonNode ref : step.path("related")) {
            relation(owner.type(), owner.slug(), text(step.path("id")), ref, "RELATED", owner.documentId(), sort++);
        }
    }

    /** A link to another entity ({@code EntityRef}: type, id, optional stepId, label, note). */
    void relation(String sourceType, String sourceSlug, String sourceStep, JsonNode ref, String relationType, UUID documentId,
                  int sort) {
        jdbc.sql(INSERT_RELATION).param("sourceType", sourceType).param("sourceSlug", sourceSlug).param("sourceStep", sourceStep)
                .param("targetType", enumName(ref.path("type"))).param("targetSlug", text(ref.path("id")))
                .param("targetStep", text(ref.path("stepId"))).param("relation", relationType)
                .param("label", json(ref.path("label"))).param("note", json(ref.path("note")))
                .param("sources", jsonArray(ref.path("sources"))).param("sort", sort).param("doc", documentId).update();
    }

    void deleteUnusedSources() {
        jdbc.sql(DELETE_UNUSED_SOURCES).update();
    }

    private UUID insertStep(Owner owner, JsonNode step) {
        JsonNode date = step.path("date");
        HistoricalDate when = ContentValues.date(date);
        HistoricalDate.Age age = owner.birth() != null && when != null ? HistoricalDate.ageAt(owner.birth(), when) : null;
        JsonNode loc = step.path("location");
        JsonNode from = step.path("fromLocation");
        JsonNode summary = step.has("factualSummary") ? step.path("factualSummary") : step.path("summary");
        return jdbc.sql(INSERT_STEP)
                .param("ownerType", owner.type()).param("owner", owner.slug()).param("key", text(step.path("id")))
                .param("sequence", step.path("order").asInt()).param("kind", owner.kind())
                .params(ContentValues.dateParams("date", date))
                .param("title", json(step.path("title"))).param("summary", json(summary)).param("narrative", json(step.path("narrative")))
                .param("mood", enumName(step.path("mood")))
                .param("claimType", step.has("claimType") ? enumName(step.path("claimType")) : "FACT")
                .param("locName", json(loc.path("name"))).param("locModern", json(loc.path("modernName")))
                .param("lng", number(loc.path("lng"))).param("lat", number(loc.path("lat")))
                .param("locApprox", bool(loc.path("approximate"))).param("locPlace", text(loc.path("placeId")))
                .param("fromName", json(from.path("name"))).param("fromModern", json(from.path("modernName")))
                .param("fromLng", number(from.path("lng"))).param("fromLat", number(from.path("lat")))
                .param("fromApprox", present(from) ? Boolean.TRUE.equals(bool(from.path("approximate"))) : null)
                .param("fromPlace", text(from.path("placeId")))
                .param("route", route(step))
                .param("snapshot", text(step.path("territorySnapshotId"))).param("theme", text(step.path("themeId")))
                .param("age", age == null ? null : age.years()).param("ageApprox", age == null ? null : age.approximate())
                .param("details", json(details(step))).param("doc", owner.documentId())
                .query(UUID.class).single();
    }

    /** {@code fromLocation → route waypoints → location} as a GeoJSON LineString (ADR-0007), when there is a start. */
    static String route(JsonNode step) {
        JsonNode from = step.path("fromLocation");
        if (!from.isObject()) return null;
        StringBuilder coords = new StringBuilder();
        point(coords, from.path("lng").asDouble(), from.path("lat").asDouble());
        for (JsonNode p : step.path("route")) point(coords, p.path(0).asDouble(), p.path(1).asDouble());
        point(coords, step.path("location").path("lng").asDouble(), step.path("location").path("lat").asDouble());
        return "{\"type\":\"LineString\",\"coordinates\":[" + coords + "]}";
    }

    private static void point(StringBuilder out, double lng, double lat) {
        if (!out.isEmpty()) out.append(',');
        out.append('[').append(lng).append(',').append(lat).append(']');
    }

    /** Kind-specific fields: outcome, choice, quiz, narration, liberated settlements… A life event's {@code type} becomes {@code eventType}. */
    static ObjectNode details(JsonNode step) {
        ObjectNode out = (ObjectNode) step.deepCopy();
        out.remove(MAPPED);
        if (out.has("type")) out.set("eventType", out.remove("type"));
        return out;
    }

    private void link(String sql, UUID owner, JsonNode source, int sort) {
        UUID sourceId = upsertSource(source);
        jdbc.sql(sql).param("owner", owner).param("source", sourceId).param("locator", text(source.path("note")))
                .param("sort", sort).update();
    }

    private UUID upsertSource(JsonNode s) {
        byte[] hash = sourceHash(s);
        return jdbc.sql(UPSERT_SOURCE).param("slug", "src-" + HexFormat.of().formatHex(hash, 0, 12))
                .param("title", text(s.path("title"))).param("authors", text(s.path("author"))).param("url", text(s.path("url")))
                .param("type", enumName(s.path("type"))).param("hash", hash).query(UUID.class).single();
    }

    /** {@code sha256(title|author|url|type)}: the same book cited in two documents is one row (ADR-0007). */
    static byte[] sourceHash(JsonNode s) {
        String key = String.join("|", nz(text(s.path("title"))), nz(text(s.path("author"))), nz(text(s.path("url"))),
                nz(text(s.path("type"))));
        try {
            return MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
