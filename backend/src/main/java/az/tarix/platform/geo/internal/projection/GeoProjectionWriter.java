package az.tarix.platform.geo.internal.projection;

import static az.tarix.platform.shared.content.ContentValues.enumName;
import static az.tarix.platform.shared.content.ContentValues.integer;
import static az.tarix.platform.shared.content.ContentValues.json;
import static az.tarix.platform.shared.content.ContentValues.jsonArray;
import static az.tarix.platform.shared.content.ContentValues.number;
import static az.tarix.platform.shared.content.ContentValues.text;

import az.tarix.platform.shared.content.ProjectionWriter;
import az.tarix.platform.shared.content.PublishedContent;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Projects PLACE and TERRITORY_SNAPSHOT documents (V005). Territory polygons come from the
 * built part of the snapshot ({@code /built}, see ADR-0011); a simplified copy is computed
 * here, and the validity range of every snapshot is recomputed after each change.
 *
 * <p>An invalid polygon blocks publishing (validation ERROR), but one that reaches the
 * projection anyway (a rebuild of older content) is repaired with {@code ST_MakeValid}
 * instead of failing the whole projection, and logged.
 */
@Component
class GeoProjectionWriter implements ProjectionWriter {

    /** Tolerance of the small-zoom geometry, in degrees (≈ 1 km). */
    static final double SIMPLIFY_DEGREES = 0.01;

    static final String INSERT_PLACE = """
            INSERT INTO place (slug, historical_name, modern_name, place_type, location, importance, description, sources,
                               document_id)
            VALUES (:slug, CAST(:historical AS jsonb), CAST(:modern AS jsonb), :type,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :importance, CAST(:description AS jsonb),
                    CAST(:sources AS jsonb), :doc)
            RETURNING id""";

    static final String INSERT_PLACE_PERIOD = """
            INSERT INTO place_period (place_id, from_year, to_year, name) VALUES (:place, :from, :to, CAST(:name AS jsonb))""";

    static final String INSERT_UPCOMING = """
            INSERT INTO place_upcoming (place_id, year, title, ref, sources, sort_order)
            VALUES (:place, :year, CAST(:title AS jsonb), CAST(:ref AS jsonb), CAST(:sources AS jsonb), :sort)""";

    static final String INSERT_SNAPSHOT = """
            INSERT INTO territory_snapshot (slug, year, valid_from_year, title, certainty, note, sources, document_id)
            VALUES (:slug, :year, :year, CAST(:title AS jsonb), :certainty, CAST(:note AS jsonb), CAST(:sources AS jsonb), :doc)
            RETURNING id""";

    static final String INSERT_TERRITORY = """
            WITH raw AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326) AS geom),
                 g AS (SELECT ST_Multi(CASE WHEN ST_IsValid(geom) THEN geom
                                            ELSE ST_CollectionExtract(ST_MakeValid(geom), 3) END) AS geom FROM raw)
            INSERT INTO polity_territory (snapshot_id, polity_slug, name, color, geometry, geometry_simplified,
                                          capital_place_slug, vassal_of_slug, label_at, area_km2, sort_order)
            SELECT :snapshot, :polity, CAST(:name AS jsonb), :color, g.geom,
                   (SELECT CASE WHEN ST_IsValid(s) AND NOT ST_IsEmpty(s) THEN ST_Multi(s) END
                      FROM ST_SimplifyPreserveTopology(g.geom, :tolerance) AS s),
                   :capital, :vassal, ST_SetSRID(ST_MakePoint(:labelLng, :labelLat), 4326),
                   ST_Area(g.geom::geography) / 1e6, :sort
            FROM g""";

    /** Each snapshot is valid until the year before the next one; the latest is open-ended (NULL). */
    static final String RECOMPUTE_VALIDITY = """
            UPDATE territory_snapshot t
            SET valid_to_year = CASE WHEN n.next_year IS NULL THEN NULL ELSE greatest(n.next_year - 1, t.valid_from_year) END
            FROM (SELECT id, lead(year) OVER (ORDER BY year, slug) AS next_year FROM territory_snapshot) n
            WHERE t.id = n.id
              AND t.valid_to_year IS DISTINCT FROM
                  CASE WHEN n.next_year IS NULL THEN NULL ELSE greatest(n.next_year - 1, t.valid_from_year) END""";

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GeoProjectionWriter.class);

    private final JdbcClient jdbc;

    GeoProjectionWriter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void delete(UUID documentId) {
        jdbc.sql("DELETE FROM place WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM territory_snapshot WHERE document_id = :doc").param("doc", documentId).update();
    }

    @Override
    public void deleteAll() {
        jdbc.sql("DELETE FROM place").update();
        jdbc.sql("DELETE FROM territory_snapshot").update();
    }

    @Override
    public void write(PublishedContent doc) {
        switch (doc.type()) {
            case PLACE -> place(doc);
            case TERRITORY_SNAPSHOT -> snapshot(doc);
            default -> { }
        }
    }

    @Override
    public void afterChanges() {
        jdbc.sql(RECOMPUTE_VALIDITY).update();
    }

    private void place(PublishedContent doc) {
        JsonNode p = doc.part("place");
        UUID placeId = jdbc.sql(INSERT_PLACE).param("slug", doc.slug())
                .param("historical", json(p.path("names").path("historical"))).param("modern", json(p.path("names").path("modern")))
                .param("type", enumName(p.path("type"))).param("lng", number(p.path("lng"))).param("lat", number(p.path("lat")))
                .param("importance", integer(p.path("importance"))).param("description", json(p.path("description")))
                .param("sources", jsonArray(p.path("sources"))).param("doc", doc.documentId())
                .query(UUID.class).single();
        for (JsonNode period : p.path("periods")) {
            jdbc.sql(INSERT_PLACE_PERIOD).param("place", placeId).param("from", integer(period.path("from")))
                    .param("to", integer(period.path("to"))).param("name", json(period.path("name"))).update();
        }
        int sort = 0;
        for (JsonNode u : p.path("upcoming")) {
            jdbc.sql(INSERT_UPCOMING).param("place", placeId).param("year", integer(u.path("year")))
                    .param("title", json(u.path("title"))).param("ref", json(u.path("ref")))
                    .param("sources", jsonArray(u.path("sources"))).param("sort", sort++).update();
        }
    }

    private void snapshot(PublishedContent doc) {
        JsonNode s = doc.part("snapshot");
        UUID snapshotId = jdbc.sql(INSERT_SNAPSHOT).param("slug", doc.slug()).param("year", integer(s.path("year")))
                .param("title", json(s.path("title"))).param("certainty", enumName(s.path("certainty")))
                .param("note", json(s.path("note"))).param("sources", jsonArray(s.path("sources")))
                .param("doc", doc.documentId()).query(UUID.class).single();

        // Capital and suzerain are in the authored snapshot, the polygons in the built one.
        Map<String, JsonNode> authored = new HashMap<>();
        for (JsonNode p : s.path("polities")) authored.put(p.path("polityId").asString(), p);
        int sort = 0;
        for (JsonNode p : doc.part("built").path("polities")) {
            String polity = text(p.path("id"));
            String problem = jdbc.sql("SELECT geojson_problem(:g)").param("g", json(p.path("geometry"))).query(String.class)
                    .list().stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
            if (problem != null) log.warn("repairing invalid territory polygon snapshot={} polity={}: {}", doc.slug(), polity, problem);
            JsonNode source = authored.getOrDefault(polity, p);
            jdbc.sql(INSERT_TERRITORY).param("snapshot", snapshotId).param("polity", polity)
                    .param("name", json(p.path("name"))).param("color", text(p.path("color")))
                    .param("geometry", json(p.path("geometry"))).param("tolerance", SIMPLIFY_DEGREES)
                    .param("capital", text(source.path("capitalId"))).param("vassal", text(source.path("vassalOf")))
                    .param("labelLng", number(p.path("labelAt").path(0))).param("labelLat", number(p.path("labelAt").path(1)))
                    .param("sort", sort++).update();
        }
    }
}
