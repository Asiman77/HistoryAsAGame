package az.tarix.platform.publishing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.TestDatabase;
import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.editorial.DataDocuments.Doc;
import az.tarix.platform.publishing.internal.Projector;
import az.tarix.platform.publishing.internal.Projector.RebuildReport;
import az.tarix.platform.shared.content.DocumentType;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Publishing: every document type projected from today's data, derived values, idempotent
 * rebuilds, the asynchronous publish → project flow, archiving and retries.
 */
@IntegrationTest
class ProjectionTests {

    static final List<Doc> DATA = DataDocuments.all();
    static final String DOCS = "/api/v1/editorial/documents";

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    Projector projector;

    @Autowired
    JwtEncoder jwtEncoder;

    @Autowired
    IncompleteEventPublications incomplete;

    final Map<String, String> tokens = new HashMap<>();
    UUID owner;

    @BeforeEach
    void users() {
        owner = user("owner", "AUTHOR");
        user("author", "AUTHOR");
        user("reviewer", "REVIEWER");
        user("admin", "ADMIN");
    }

    @AfterEach
    void cleanUp() {
        TestDatabase.clearContent(jdbc);
        jdbc.sql("DELETE FROM app_user WHERE email LIKE '%@projection.test'").update();
    }

    UUID user(String name, String role) {
        UUID id = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:e, :n) RETURNING id")
                .param("e", name + "@projection.test").param("n", name).query(UUID.class).single();
        jdbc.sql("INSERT INTO user_role (user_id, role) VALUES (:id, :r)").param("id", id).param("r", role).update();
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("tarix-platform").subject(id.toString()).issuedAt(now)
                .expiresAt(now.plusSeconds(600)).claim("roles", List.of(role)).build();
        tokens.put(name, jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue());
        return id;
    }

    /** Stores a document as published, straight in the editorial tables (no events). */
    UUID seedPublished(Doc d) {
        UUID doc = jdbc.sql("""
                INSERT INTO editorial_document (doc_type, slug, status, created_by, created_at, updated_at)
                VALUES (:type, :slug, 'PUBLISHED', :owner, now(), now()) RETURNING id""")
                .param("type", d.type().name()).param("slug", d.slug()).param("owner", owner).query(UUID.class).single();
        UUID rev = jdbc.sql("""
                INSERT INTO editorial_revision (document_id, revision_no, schema_version, content, content_hash, author_id, created_at)
                VALUES (:doc, 1, 1, CAST(:content AS jsonb), sha256(convert_to(:content, 'UTF8')), :owner, now()) RETURNING id""")
                .param("doc", doc).param("content", d.content().toString()).param("owner", owner).query(UUID.class).single();
        jdbc.sql("UPDATE editorial_document SET current_revision_id = :rev, published_revision_id = :rev WHERE id = :doc")
                .param("rev", rev).param("doc", doc).update();
        return doc;
    }

    long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    static long countOf(DocumentType type) {
        return DATA.stream().filter(d -> d.type() == type).count();
    }

    static long sizes(DocumentType type, String part) {
        return DATA.stream().filter(d -> d.type() == type).mapToLong(d -> d.content().path(part).size()).sum();
    }

    // --- every document type, from today's data -----------------------------------------------

    @Test
    void rebuildProjectsAllOfTodaysData() {
        DATA.forEach(this::seedPublished);
        long before = count("SELECT value FROM content_version");
        RebuildReport report = projector.rebuild();

        assertThat(report.deferred()).isEmpty();
        assertThat(report.documents()).isEqualTo(DATA.size());
        assertThat(report.contentVersion()).isEqualTo(before + 1);

        assertThat(count("SELECT count(*) FROM person")).isEqualTo(countOf(DocumentType.PERSON));
        assertThat(count("SELECT count(*) FROM conflict")).isEqualTo(countOf(DocumentType.CONFLICT));
        assertThat(count("SELECT count(*) FROM state_profile")).isEqualTo(countOf(DocumentType.STATE));
        assertThat(count("SELECT count(*) FROM simulation_step WHERE step_kind = 'LIFE_EVENT'")).isEqualTo(sizes(DocumentType.PERSON, "events"));
        assertThat(count("SELECT count(*) FROM simulation_step WHERE step_kind = 'WAR_DAY'")).isEqualTo(sizes(DocumentType.CONFLICT, "days"));
        assertThat(count("SELECT count(*) FROM simulation_step WHERE step_kind = 'STATE_STEP'")).isEqualTo(sizes(DocumentType.STATE, "steps"));
        assertThat(count("SELECT count(*) FROM settlement")).isEqualTo(sizes(DocumentType.CONFLICT, "settlements"));
        assertThat(count("SELECT count(*) FROM commander")).isEqualTo(sizes(DocumentType.CONFLICT, "commanders"));
        assertThat(count("SELECT count(*) FROM place")).isEqualTo(countOf(DocumentType.PLACE));
        assertThat(count("SELECT count(*) FROM polity")).isEqualTo(countOf(DocumentType.POLITY));
        assertThat(count("SELECT count(*) FROM reign")).isEqualTo(sizes(DocumentType.POLITY, "reigns"));
        assertThat(count("SELECT count(*) FROM ruler")).isEqualTo(countOf(DocumentType.RULER));
        assertThat(count("SELECT count(*) FROM era")).isEqualTo(countOf(DocumentType.ERA));
        assertThat(count("SELECT count(*) FROM theme")).isEqualTo(countOf(DocumentType.THEME));
        assertThat(count("SELECT count(*) FROM territory_snapshot")).isEqualTo(countOf(DocumentType.TERRITORY_SNAPSHOT));
        assertThat(count("SELECT count(*) FROM hero")).isEqualTo(countOf(DocumentType.HERO));
        assertThat(count("SELECT count(*) FROM battle")).isEqualTo(countOf(DocumentType.BATTLE));
        assertThat(count("SELECT count(*) FROM soundtrack_track")).isEqualTo(countOf(DocumentType.SOUNDTRACK_TRACK));
        assertThat(count("SELECT count(*) FROM glossary_entry")).isEqualTo(countOf(DocumentType.GLOSSARY_ENTRY));
        assertThat(count("SELECT count(*) FROM commemoration")).isEqualTo(countOf(DocumentType.COMMEMORATION));
        assertThat(count("SELECT count(*) FROM world_event")).isEqualTo(countOf(DocumentType.WORLD_EVENT));
        long builtPolities = DATA.stream().filter(d -> d.type() == DocumentType.TERRITORY_SNAPSHOT)
                .mapToLong(d -> d.content().path("built").path("polities").size()).sum();
        assertThat(count("SELECT count(*) FROM polity_territory")).isEqualTo(builtPolities).isPositive();
        long portraits = DATA.stream().filter(d -> d.type() == DocumentType.PERSON)
                .mapToLong(d -> d.content().path("person").path("portraits").size()).sum();
        assertThat(count("SELECT count(*) FROM portrait")).isEqualTo(portraits);
        long relations = sizes(DocumentType.PERSON, "relations") + DATA.stream()
                .flatMap(d -> d.type() == DocumentType.PERSON ? stream(d.content().path("events"))
                        : d.type() == DocumentType.STATE ? stream(d.content().path("steps"))
                        : d.type() == DocumentType.CONFLICT ? stream(d.content().path("days")) : java.util.stream.Stream.empty())
                .mapToLong(s -> s.path("related").size()).sum();
        assertThat(count("SELECT count(*) FROM entity_relation")).isEqualTo(relations);
    }

    static java.util.stream.Stream<JsonNode> stream(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false);
    }

    @Test
    void derivedValuesAreComputedOnProjection() {
        DATA.forEach(this::seedPublished);
        projector.rebuild();

        // Age at the event, from the person's birth.
        assertThat(count("SELECT age_at_event FROM simulation_step WHERE owner_slug = 'shah-ismayil' ORDER BY sequence LIMIT 1")).isZero();
        assertThat(count("SELECT count(*) FROM simulation_step WHERE step_kind = 'LIFE_EVENT' AND age_at_event IS NULL")).isZero();

        // Routes run fromLocation → waypoints → location.
        Map<String, Object> merv = jdbc.sql("""
                SELECT ST_NPoints(route) AS points, ST_X(ST_StartPoint(route)) AS start_lng, ST_X(ST_EndPoint(route)) AS end_lng
                FROM simulation_step WHERE step_key = 'ismayil-merv'""").query().singleRow();
        assertThat(((Number) merv.get("points")).intValue()).isEqualTo(4);
        assertThat(((Number) merv.get("start_lng")).doubleValue()).isEqualTo(44.3661);
        assertThat(((Number) merv.get("end_lng")).doubleValue()).isEqualTo(62.172);
        assertThat(count("SELECT count(*) FROM simulation_step WHERE route IS NOT NULL AND from_location_point IS NULL")).isZero();

        // A life event's type is kept in details as eventType; columns are not duplicated there.
        JsonNode details = tools.jackson.databind.json.JsonMapper.shared().readTree(jdbc.sql(
                "SELECT details::text FROM simulation_step WHERE owner_slug = 'shah-ismayil' ORDER BY sequence LIMIT 1")
                .query(String.class).single());
        assertThat(details.path("eventType").asString()).isEqualTo("birth");
        assertThat(details.has("title") || details.has("date") || details.has("sources")).isFalse();

        // Sources are shared rows, cited by locator.
        assertThat(count("SELECT count(*) FROM source")).isPositive()
                .isLessThan(count("SELECT (SELECT count(*) FROM step_source) + (SELECT count(*) FROM claim_source)"));

        // Snapshots: each valid until the next one, the latest open-ended.
        List<Map<String, Object>> snapshots = jdbc.sql("SELECT year, valid_from_year, valid_to_year FROM territory_snapshot ORDER BY year")
                .query().listOfRows();
        for (int i = 0; i < snapshots.size() - 1; i++) {
            assertThat(snapshots.get(i).get("valid_to_year")).isEqualTo((Integer) snapshots.get(i + 1).get("year") - 1);
        }
        assertThat(snapshots.getLast().get("valid_to_year")).isNull();
        assertThat(count("SELECT count(*) FROM polity_territory WHERE NOT ST_IsValid(geometry) OR area_km2 <= 0")).isZero();
        assertThat(count("SELECT count(*) FROM polity_territory WHERE geometry_simplified IS NOT NULL")).isPositive();

        // Theme variant merged over its parent; enums upper-case in the database.
        Map<String, Object> hind = jdbc.sql("""
                SELECT t.palette ->> 'primary' AS primary, p.palette ->> 'primary' AS parent_primary, t.fonts = p.fonts AS same_fonts,
                       t.raw -> 'fonts' IS NOT NULL AS own_fonts, t.ambient_effect, t.extends_slug
                FROM theme t JOIN theme p ON p.slug = t.extends_slug WHERE t.slug = 'efshar-hind'""").query().singleRow();
        assertThat(hind.get("extends_slug")).isEqualTo("efshar");
        if (!(Boolean) hind.get("own_fonts")) assertThat(hind.get("same_fonts")).isEqualTo(true);
        assertThat((String) hind.get("ambient_effect")).isUpperCase();

        // Conflict span from its first and last day; polity span from its periods.
        assertThat(count("SELECT count(*) FROM conflict WHERE start_year IS NULL OR end_sort_key < start_sort_key")).isZero();
        assertThat(count("SELECT count(*) FROM polity p WHERE start_year <> (SELECT min(from_year) FROM polity_period WHERE polity_id = p.id)")).isZero();
    }

    @Test
    void rebuildIsIdempotent() {
        DATA.forEach(this::seedPublished);
        projector.rebuild();
        String fingerprint = fingerprint();
        RebuildReport again = projector.rebuild();
        assertThat(again.deferred()).isEmpty();
        assertThat(fingerprint()).isEqualTo(fingerprint);
    }

    /** Row counts and a hash of the content columns of the main tables (ids are regenerated). */
    String fingerprint() {
        return jdbc.sql("""
                SELECT concat_ws('|',
                  (SELECT count(*) || md5(string_agg(slug || name::text, ',' ORDER BY slug)) FROM person),
                  (SELECT count(*) || md5(string_agg(owner_slug || step_key || title::text || details::text || coalesce(age_at_event, -1),
                                                     ',' ORDER BY owner_slug, step_key)) FROM simulation_step),
                  (SELECT count(*) || md5(string_agg(slug || title, ',' ORDER BY slug)) FROM source),
                  (SELECT count(*) || md5(string_agg(slug || palette::text, ',' ORDER BY slug)) FROM theme),
                  (SELECT count(*) || md5(string_agg(s.slug || t.polity_slug || ST_AsText(t.geometry), ',' ORDER BY s.slug, t.sort_order))
                     FROM polity_territory t JOIN territory_snapshot s ON s.id = t.snapshot_id),
                  (SELECT count(*) FROM entity_relation), (SELECT count(*) FROM step_claim))""").query(String.class).single();
    }

    @Test
    void projectingOneDocumentReplacesOnlyItsRows() {
        UUID ismayil = seedPublished(DataDocuments.find(DocumentType.PERSON, "shah-ismayil"));
        UUID nadir = seedPublished(DataDocuments.find(DocumentType.PERSON, "nadir-shah"));
        projector.project(ismayil);
        projector.project(nadir);
        long steps = count("SELECT count(*) FROM simulation_step");
        projector.project(ismayil);
        projector.project(ismayil);
        assertThat(count("SELECT count(*) FROM simulation_step")).isEqualTo(steps);
        assertThat(count("SELECT count(*) FROM person")).isEqualTo(2);

        // Archived (no public revision any more): its rows go, the other person stays.
        jdbc.sql("UPDATE editorial_document SET status = 'ARCHIVED' WHERE id = :id").param("id", ismayil).update();
        projector.project(ismayil);
        assertThat(jdbc.sql("SELECT slug FROM person").query(String.class).list()).containsExactly("nadir-shah");
        assertThat(count("SELECT count(*) FROM simulation_step WHERE owner_slug = 'shah-ismayil'")).isZero();
        assertThat(count("SELECT count(*) FROM source s WHERE NOT EXISTS (SELECT 1 FROM step_source x WHERE x.source_id = s.id) "
                + "AND NOT EXISTS (SELECT 1 FROM claim_source x WHERE x.source_id = s.id)")).isZero();
    }

    // --- the asynchronous flow ----------------------------------------------------------------

    ResponseEntity<JsonNode> call(String who, HttpMethod method, String path, Object body, String ifMatch) {
        var spec = RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build()
                .method(method).uri(path).header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.get(who));
        if (ifMatch != null) spec = spec.header(HttpHeaders.IF_MATCH, ifMatch);
        if (body != null) spec = spec.contentType(MediaType.APPLICATION_JSON).body(body);
        return spec.retrieve().toEntity(JsonNode.class);
    }

    String publishViaApi(DocumentType type, JsonNode content) {
        String id = call("author", HttpMethod.POST, DOCS, Map.of("type", type.name(), "content", content), null)
                .getBody().path("id").asString();
        transition(id, "author", "submit");
        transition(id, "reviewer", "approve");
        ResponseEntity<JsonNode> published = transition(id, "admin", "publish");
        assertThat(published.getStatusCode().value()).as(published.getBody().toString()).isEqualTo(200);
        return id;
    }

    ResponseEntity<JsonNode> transition(String id, String who, String action) {
        return call(who, HttpMethod.POST, DOCS + "/" + id + "/transitions", Map.of("action", action), null);
    }

    @Test
    void publishingProjectsAndArchivingRemoves() {
        long before = count("SELECT value FROM content_version");
        String id = publishViaApi(DocumentType.PLACE, DataDocuments.find(DocumentType.PLACE, "tebriz").content());
        await().atMost(Duration.ofSeconds(10)).until(() -> count("SELECT count(*) FROM place WHERE slug = 'tebriz'") == 1);
        assertThat(count("SELECT value FROM content_version")).isGreaterThan(before);

        // A new draft does not touch the public rows; publishing it does.
        JsonNode doc = call("admin", HttpMethod.GET, DOCS + "/" + id, null, null).getBody();
        ObjectNode renamed = (ObjectNode) doc.path("content").deepCopy();
        ((ObjectNode) renamed.path("place").path("names").path("historical")).put("az", "Təbriz (yeni)");
        call("author", HttpMethod.PUT, DOCS + "/" + id, Map.of("content", renamed), "\"" + doc.path("version").asLong() + "\"");
        assertThat(jdbc.sql("SELECT historical_name ->> 'az' FROM place WHERE slug = 'tebriz'").query(String.class).single())
                .isEqualTo("Təbriz");
        transition(id, "author", "submit");
        transition(id, "reviewer", "approve");
        transition(id, "admin", "publish");
        await().atMost(Duration.ofSeconds(10)).until(() ->
                "Təbriz (yeni)".equals(jdbc.sql("SELECT historical_name ->> 'az' FROM place WHERE slug = 'tebriz'").query(String.class).single()));

        transition(id, "admin", "archive");
        await().atMost(Duration.ofSeconds(10)).until(() -> count("SELECT count(*) FROM place WHERE slug = 'tebriz'") == 0);
        await().atMost(Duration.ofSeconds(10)).until(() -> count("SELECT count(*) FROM event_publication WHERE completion_date IS NULL") == 0);
    }

    @Test
    void aRenamedDocumentKeepsItsOldLinkUntilRepublishedAndThenRedirects() {
        String id = publishViaApi(DocumentType.PLACE, DataDocuments.find(DocumentType.PLACE, "tebriz").content());
        await().atMost(Duration.ofSeconds(10)).until(() -> count("SELECT count(*) FROM place WHERE slug = 'tebriz'") == 1);

        assertThat(call("reviewer", HttpMethod.POST, DOCS + "/" + id + "/rename", Map.of("slug", "tabriz"), null)
                .getStatusCode().value()).isEqualTo(403);
        ResponseEntity<JsonNode> renamed = call("admin", HttpMethod.POST, DOCS + "/" + id + "/rename", Map.of("slug", "tabriz"), null);
        assertThat(renamed.getStatusCode().value()).as(renamed.getBody().toString()).isEqualTo(200);
        assertThat(renamed.getBody().path("slug").asString()).isEqualTo("tabriz");
        assertThat(renamed.getBody().path("status").asString()).isEqualTo("DRAFT");
        assertThat(renamed.getBody().path("content").path("place").path("id").asString()).isEqualTo("tabriz");
        assertThat(renamed.getBody().path("revision").path("changeNote").asString()).isEqualTo("slug: tebriz → tabriz");
        assertThat(jdbc.sql("SELECT new_slug FROM slug_redirect WHERE doc_type = 'PLACE' AND old_slug = 'tebriz'")
                .query(String.class).single()).isEqualTo("tabriz");
        // The renamed revision is valid as it stands (its id is the new slug).
        assertThat(call("admin", HttpMethod.GET, DOCS + "/" + id + "/validation", null, null).getBody().path("publishable").asBoolean())
                .isTrue();

        // Until it is published again, the public revision keeps the old slug; a rebuild agrees.
        call("admin", HttpMethod.POST, "/api/v1/admin/projections/rebuild", null, null);
        assertThat(count("SELECT count(*) FROM place WHERE slug = 'tebriz'")).isEqualTo(1);
        assertThat(call("admin", HttpMethod.GET, "/api/v1/places/tebriz", null, null).getBody().path("slug").asString()).isEqualTo("tebriz");

        transition(id, "author", "submit");
        transition(id, "reviewer", "approve");
        transition(id, "admin", "publish");
        await().atMost(Duration.ofSeconds(10)).until(() -> count("SELECT count(*) FROM place WHERE slug = 'tabriz'") == 1);
        assertThat(count("SELECT count(*) FROM place WHERE slug = 'tebriz'")).isZero();
        // The old link answers 301 to the new one.
        ResponseEntity<JsonNode> moved = call("admin", HttpMethod.GET, "/api/v1/places/tebriz", null, null);
        assertThat(moved.getStatusCode().value()).isEqualTo(301);
        assertThat(moved.getHeaders().getLocation()).hasToString("/api/v1/places/tabriz");
        assertThat(call("admin", HttpMethod.GET, "/api/v1/places/tabriz", null, null).getBody().path("slug").asString()).isEqualTo("tabriz");

        // The old name cannot be taken by a new document, but this one may get it back.
        assertThat(call("author", HttpMethod.POST, DOCS, Map.of("type", "PLACE",
                "content", DataDocuments.find(DocumentType.PLACE, "tebriz").content()), null).getStatusCode().value()).isEqualTo(409);
        assertThat(call("admin", HttpMethod.POST, DOCS + "/" + id + "/rename", Map.of("slug", "tebriz"), null)
                .getStatusCode().value()).isEqualTo(200);
        assertThat(count("SELECT count(*) FROM slug_redirect WHERE doc_type = 'PLACE' AND old_slug = 'tebriz'")).isZero();
        assertThat(jdbc.sql("SELECT new_slug FROM slug_redirect WHERE doc_type = 'PLACE' AND old_slug = 'tabriz'")
                .query(String.class).single()).isEqualTo("tebriz");
        assertThat(call("admin", HttpMethod.POST, DOCS + "/" + id + "/rename", Map.of("slug", "Bad Slug"), null)
                .getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void aFailedProjectionIsRetriedOnceItsDependencyIsThere() {
        // The parent theme exists but is not published yet (a WARNING only), so the variant can be published
        // first: its projection fails (MissingDependencyException) and stays in the registry.
        String parent = call("author", HttpMethod.POST, DOCS, Map.of("type", "THEME",
                "content", DataDocuments.find(DocumentType.THEME, "efshar").content()), null).getBody().path("id").asString();
        publishViaApi(DocumentType.THEME, DataDocuments.find(DocumentType.THEME, "efshar-hind").content());
        await().atMost(Duration.ofSeconds(10)).until(() ->
                count("SELECT count(*) FROM event_publication WHERE completion_date IS NULL AND event_type LIKE '%ContentPublished'") == 1);
        assertThat(count("SELECT count(*) FROM theme")).isZero();

        transition(parent, "author", "submit");
        transition(parent, "reviewer", "approve");
        assertThat(transition(parent, "admin", "publish").getStatusCode().value()).isEqualTo(200);
        await().atMost(Duration.ofSeconds(10)).until(() -> count("SELECT count(*) FROM theme WHERE slug = 'efshar'") == 1);

        incomplete.resubmitIncompletePublicationsOlderThan(Duration.ZERO);
        await().atMost(Duration.ofSeconds(10)).until(() -> count("SELECT count(*) FROM theme WHERE slug = 'efshar-hind'") == 1);
        assertThat(count("SELECT count(*) FROM theme t JOIN theme p ON p.slug = t.extends_slug WHERE t.music_theme_slug IS NOT NULL")).isEqualTo(1);
        await().atMost(Duration.ofSeconds(10)).until(() -> count("SELECT count(*) FROM event_publication WHERE completion_date IS NULL") == 0);
    }

    // --- admin endpoints ----------------------------------------------------------------------

    @Test
    void rebuildEndpointIsForAdmins() {
        seedPublished(DataDocuments.find(DocumentType.PLACE, "tebriz"));
        assertThat(call("author", HttpMethod.POST, "/api/v1/admin/projections/rebuild", null, null).getStatusCode().value()).isEqualTo(403);
        ResponseEntity<JsonNode> res = call("admin", HttpMethod.POST, "/api/v1/admin/projections/rebuild", null, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody().path("documents").asInt()).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM place")).isEqualTo(1);
    }

    @Test
    void brokenReferencesListLinksToMissingContent() {
        seedPublished(DataDocuments.find(DocumentType.PERSON, "shah-ismayil"));
        assertThat(call("author", HttpMethod.GET, "/api/v1/admin/broken-references", null, null).getStatusCode().value()).isEqualTo(403);
        JsonNode broken = call("admin", HttpMethod.GET, "/api/v1/admin/broken-references", null, null).getBody();
        // Nothing else is published: its eras, theme and places are all missing.
        assertThat(broken).isNotEmpty().allMatch(b -> b.path("slug").asString().equals("shah-ismayil"));
        assertThat(broken).anyMatch(b -> b.path("code").asString().equals("unknown-reference")
                && b.path("pointer").asString().equals("/person/eraIds/0"));
    }
}
