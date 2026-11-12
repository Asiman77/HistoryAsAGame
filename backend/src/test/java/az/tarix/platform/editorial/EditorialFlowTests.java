package az.tarix.platform.editorial;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.TestDatabase;
import az.tarix.platform.editorial.api.ContentArchived;
import az.tarix.platform.editorial.api.ContentPublished;
import az.tarix.platform.shared.content.DocumentType;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** The editorial API over real HTTP and PostgreSQL: CRUD, locking, history, workflow, comments. */
@IntegrationTest
class EditorialFlowTests {

    static final String BASE = "/api/v1/editorial/documents";

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    JwtEncoder jwtEncoder;

    @Autowired
    RecordedEditorialEvents events;

    /** Bearer tokens of test users by name. */
    final Map<String, String> tokens = new HashMap<>();
    final Map<String, UUID> ids = new HashMap<>();

    @BeforeEach
    void users() {
        user("author", "AUTHOR");
        user("author2", "AUTHOR");
        user("reviewer", "REVIEWER");
        user("reviewer2", "REVIEWER");
        user("admin", "ADMIN");
        user("teacher", "TEACHER");
        events.clear();
    }

    @AfterEach
    void cleanUp() {
        TestDatabase.clearContent(jdbc);
        jdbc.sql("DELETE FROM app_user WHERE email LIKE '%@editorial.test'").update();
    }

    void user(String name, String role) {
        UUID id = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:e, :n) RETURNING id")
                .param("e", name + "@editorial.test").param("n", name).query(UUID.class).single();
        jdbc.sql("INSERT INTO user_role (user_id, role) VALUES (:id, :r)").param("id", id).param("r", role).update();
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("tarix-platform").subject(id.toString()).issuedAt(now)
                .expiresAt(now.plusSeconds(600)).claim("roles", List.of(role)).build();
        tokens.put(name, jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue());
        ids.put(name, id);
    }

    // --- HTTP helpers -------------------------------------------------------------------------

    RestClient http() {
        return RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (req, res) -> {}).build();
    }

    ResponseEntity<JsonNode> call(String who, HttpMethod method, String path, Object body, String ifMatch) {
        var spec = http().method(method).uri(path);
        if (who != null) spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.get(who));
        if (ifMatch != null) spec = spec.header(HttpHeaders.IF_MATCH, ifMatch);
        if (body != null) spec = spec.contentType(MediaType.APPLICATION_JSON).body(body);
        return spec.retrieve().toEntity(JsonNode.class);
    }

    ResponseEntity<JsonNode> get(String who, String path) {
        return call(who, HttpMethod.GET, path, null, null);
    }

    ResponseEntity<JsonNode> create(String who, DocumentType type, JsonNode content) {
        return call(who, HttpMethod.POST, BASE, Map.of("type", type.name(), "content", content, "changeNote", "ilk"), null);
    }

    ResponseEntity<JsonNode> put(String who, String id, String etag, JsonNode content) {
        return call(who, HttpMethod.PUT, BASE + "/" + id, Map.of("content", content), etag);
    }

    ResponseEntity<JsonNode> transition(String who, String id, String action, String comment) {
        Map<String, String> body = new HashMap<>(Map.of("action", action));
        if (comment != null) body.put("comment", comment);
        return call(who, HttpMethod.POST, BASE + "/" + id + "/transitions", body, null);
    }

    static int status(ResponseEntity<?> res) {
        return res.getStatusCode().value();
    }

    static ObjectNode place(String slug) {
        return DataDocuments.find(DocumentType.PLACE, slug).content().deepCopy();
    }

    static ObjectNode renamed(ObjectNode content, String az) {
        ObjectNode copy = content.deepCopy();
        ((ObjectNode) copy.path("place").path("names").path("historical")).put("az", az);
        return copy;
    }

    // --- CRUD and optimistic locking ----------------------------------------------------------

    @Test
    void createReadAndEditWithOptimisticLocking() {
        ResponseEntity<JsonNode> created = create("author", DocumentType.PLACE, place("tebriz"));
        assertThat(status(created)).isEqualTo(201);
        JsonNode doc = created.getBody();
        String id = doc.path("id").asString();
        assertThat(created.getHeaders().getLocation()).hasToString(BASE + "/" + id);
        assertThat(doc.path("slug").asString()).isEqualTo("tebriz");          // taken from the content id
        assertThat(doc.path("title").asString()).isEqualTo("Təbriz");
        assertThat(doc.path("status").asString()).isEqualTo("DRAFT");
        assertThat(doc.path("revision").path("revisionNo").asInt()).isEqualTo(1);
        assertThat(doc.path("content")).isEqualTo(place("tebriz"));
        String etag = created.getHeaders().getETag();
        assertThat(get("author", BASE + "/" + id).getHeaders().getETag()).isEqualTo(etag);

        ObjectNode changed = renamed(place("tebriz"), "Təbriz (paytaxt)");
        ResponseEntity<JsonNode> missing = put("author", id, null, changed);
        assertThat(status(missing)).isEqualTo(428);
        assertThat(missing.getBody().path("type").asString()).endsWith("/problems/precondition-required");

        ResponseEntity<JsonNode> stale = put("author", id, "\"999\"", changed);
        assertThat(status(stale)).isEqualTo(412);
        assertThat(stale.getHeaders().getETag()).isEqualTo(etag);

        ResponseEntity<JsonNode> updated = put("author", id, etag, changed);
        assertThat(status(updated)).isEqualTo(200);
        assertThat(updated.getBody().path("revision").path("revisionNo").asInt()).isEqualTo(2);
        assertThat(updated.getBody().path("title").asString()).isEqualTo("Təbriz (paytaxt)");
        assertThat(updated.getHeaders().getETag()).isNotEqualTo(etag);

        // The old ETag no longer works; unchanged content adds no revision.
        assertThat(status(put("author", id, etag, changed))).isEqualTo(412);
        ResponseEntity<JsonNode> same = put("author", id, updated.getHeaders().getETag(), changed);
        assertThat(same.getBody().path("revision").path("revisionNo").asInt()).isEqualTo(2);
    }

    @Test
    void rejectsDuplicateAndInvalidSlugsAndBadContent() {
        assertThat(status(create("author", DocumentType.PLACE, place("tebriz")))).isEqualTo(201);
        ResponseEntity<JsonNode> duplicate = create("reviewer", DocumentType.PLACE, place("tebriz"));
        assertThat(status(duplicate)).isEqualTo(409);
        assertThat(duplicate.getBody().path("code").asString()).isEqualTo("duplicate-slug");

        ResponseEntity<JsonNode> badSlug = call("author", HttpMethod.POST, BASE,
                Map.of("type", "PLACE", "slug", "Təbriz", "content", place("tebriz")), null);
        assertThat(status(badSlug)).isEqualTo(400);
        assertThat(badSlug.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);

        ResponseEntity<JsonNode> notObject = call("author", HttpMethod.POST, BASE,
                Map.of("type", "PLACE", "slug", "x", "content", List.of(1, 2)), null);
        assertThat(status(notObject)).isEqualTo(400);
        assertThat(status(call("author", HttpMethod.POST, BASE, Map.of("type", "NOPE", "content", Map.of()), null))).isEqualTo(400);
    }

    @Test
    void accessNeedsAnEditorialRole() {
        assertThat(status(get(null, BASE))).isEqualTo(401);
        ResponseEntity<JsonNode> teacher = get("teacher", BASE);
        assertThat(status(teacher)).isEqualTo(403);
        assertThat(teacher.getBody().path("type").asString()).endsWith("/problems/forbidden");
        assertThat(status(get("author", BASE + "/" + UUID.randomUUID()))).isEqualTo(404);
    }

    @Test
    void authorsEditOnlyTheirOwnDocuments() {
        ResponseEntity<JsonNode> created = create("author", DocumentType.PLACE, place("tebriz"));
        String id = created.getBody().path("id").asString();
        String etag = created.getHeaders().getETag();
        ResponseEntity<JsonNode> foreign = put("author2", id, etag, renamed(place("tebriz"), "X"));
        assertThat(status(foreign)).isEqualTo(403);
        assertThat(status(transition("author2", id, "submit", null))).isEqualTo(403);
        // …but may read it, and a reviewer may edit it.
        assertThat(status(get("author2", BASE + "/" + id))).isEqualTo(200);
        assertThat(status(put("reviewer", id, etag, renamed(place("tebriz"), "X")))).isEqualTo(200);
    }

    // --- history, diff, revert ----------------------------------------------------------------

    @Test
    void historyDiffAndRevert() {
        ResponseEntity<JsonNode> created = create("author", DocumentType.PLACE, place("tebriz"));
        String id = created.getBody().path("id").asString();
        ResponseEntity<JsonNode> v2 = put("author", id, created.getHeaders().getETag(), renamed(place("tebriz"), "Təvriz"));

        JsonNode revisions = get("author", BASE + "/" + id + "/revisions").getBody();
        assertThat(revisions).hasSize(2);
        assertThat(revisions.get(0).path("revisionNo").asInt()).isEqualTo(2);
        assertThat(revisions.get(1).path("changeNote").asString()).isEqualTo("ilk");
        assertThat(revisions.get(1).path("authorId").asString()).isEqualTo(ids.get("author").toString());

        ResponseEntity<JsonNode> diff = get("author", BASE + "/" + id + "/diff?from=1&to=2");
        assertThat(diff.getHeaders().getContentType().toString()).startsWith("application/json-patch+json");
        assertThat(diff.getBody()).hasSize(1);
        assertThat(diff.getBody().get(0).path("op").asString()).isEqualTo("replace");
        assertThat(diff.getBody().get(0).path("path").asString()).isEqualTo("/place/names/historical/az");
        assertThat(diff.getBody().get(0).path("value").asString()).isEqualTo("Təvriz");

        ResponseEntity<JsonNode> reverted = call("author", HttpMethod.POST, BASE + "/" + id + "/revert?to=1", null,
                v2.getHeaders().getETag());
        assertThat(status(reverted)).isEqualTo(200);
        assertThat(reverted.getBody().path("revision").path("revisionNo").asInt()).isEqualTo(3);
        assertThat(reverted.getBody().path("revision").path("changeNote").asString()).contains("1");
        assertThat(reverted.getBody().path("content")).isEqualTo(place("tebriz"));
        assertThat(get("author", BASE + "/" + id + "/revisions/1").getBody().path("content")).isEqualTo(place("tebriz"));
        assertThat(get("author", BASE + "/" + id + "/diff?from=1&to=3").getBody()).isEmpty();
        assertThat(status(get("author", BASE + "/" + id + "/diff?from=1&to=9"))).isEqualTo(404);
    }

    // --- workflow -----------------------------------------------------------------------------

    @Test
    void reviewAndPublishWorkflow() {
        ResponseEntity<JsonNode> created = create("author", DocumentType.PLACE, place("tebriz"));
        String id = created.getBody().path("id").asString();

        assertThat(transition("author", id, "submit", null).getBody().path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(status(transition("author", id, "approve", null))).isEqualTo(403);
        ResponseEntity<JsonNode> back = transition("reviewer", id, "request_changes", null);
        assertThat(status(back)).isEqualTo(409);                       // a comment is required
        assertThat(transition("reviewer", id, "request_changes", "Mənbə əlavə edin").getBody().path("status").asString())
                .isEqualTo("CHANGES_REQUESTED");
        transition("author", id, "submit", null);
        assertThat(transition("reviewer", id, "approve", null).getBody().path("status").asString()).isEqualTo("APPROVED");
        assertThat(status(transition("reviewer", id, "publish", null))).isEqualTo(403);

        ResponseEntity<JsonNode> published = transition("admin", id, "publish", null);
        assertThat(status(published)).isEqualTo(200);
        assertThat(published.getBody().path("status").asString()).isEqualTo("PUBLISHED");
        assertThat(published.getBody().path("publishedRevisionNo").asInt()).isEqualTo(1);
        assertThat(events.all()).singleElement().isInstanceOfSatisfying(ContentPublished.class, e -> {
            assertThat(e.slug()).isEqualTo("tebriz");
            assertThat(e.docType()).isEqualTo(DocumentType.PLACE);
            assertThat(e.revisionNo()).isEqualTo(1);
        });

        // A new revision of a published document is a draft; the public version stays revision 1.
        ResponseEntity<JsonNode> edited = put("author", id, published.getHeaders().getETag(), renamed(place("tebriz"), "Təbriz şəhəri"));
        assertThat(edited.getBody().path("status").asString()).isEqualTo("DRAFT");
        assertThat(edited.getBody().path("publishedRevisionNo").asInt()).isEqualTo(1);
        assertThat(edited.getBody().path("revision").path("revisionNo").asInt()).isEqualTo(2);

        JsonNode log = get("author", BASE + "/" + id + "/transitions").getBody();
        assertThat(log).extracting(t -> t.path("action").asString())
                .containsExactly("create", "submit", "request_changes", "submit", "approve", "publish", "edit");
        assertThat(log.get(2).path("comment").asString()).isEqualTo("Mənbə əlavə edin");
        assertThat(log.get(5).path("actorId").asString()).isEqualTo(ids.get("admin").toString());
    }

    @Test
    void nobodyApprovesTheirOwnRevision() {
        ResponseEntity<JsonNode> created = create("reviewer", DocumentType.PLACE, place("tebriz"));
        String id = created.getBody().path("id").asString();
        transition("reviewer", id, "submit", null);
        ResponseEntity<JsonNode> own = transition("reviewer", id, "approve", null);
        assertThat(status(own)).isEqualTo(403);
        assertThat(own.getBody().path("detail").asString()).contains("öz");
        assertThat(status(transition("reviewer2", id, "approve", null))).isEqualTo(200);
    }

    @Test
    void validationErrorsBlockPublishing() {
        ObjectNode broken = place("tebriz");
        ((ObjectNode) broken.path("place").path("periods").get(0)).put("from", 3000);
        ((ObjectNode) broken.path("place")).put("lat", 500);
        String id = create("author", DocumentType.PLACE, broken).getBody().path("id").asString();

        JsonNode report = get("author", BASE + "/" + id + "/validation").getBody();
        assertThat(report.path("publishable").asBoolean()).isFalse();
        assertThat(report.path("revisionNo").asInt()).isEqualTo(1);
        assertThat(report.path("issues")).anyMatch(i -> i.path("code").asString().equals("year-range")
                && i.path("pointer").asString().equals("/place/periods/0"));
        assertThat(report.path("issues")).anyMatch(i -> i.path("code").asString().equals("schema")
                && i.path("pointer").asString().equals("/place/lat"));

        transition("author", id, "submit", null);
        transition("reviewer", id, "approve", null);
        ResponseEntity<JsonNode> blocked = transition("admin", id, "publish", null);
        assertThat(status(blocked)).isEqualTo(422);
        assertThat(blocked.getBody().path("type").asString()).endsWith("/problems/validation-failed");
        assertThat(blocked.getBody().path("errors")).isNotEmpty();
        assertThat(get("admin", BASE + "/" + id).getBody().path("status").asString()).isEqualTo("APPROVED");
        assertThat(events.all()).isEmpty();
    }

    @Test
    void referencesAreCheckedAgainstOtherDocuments() {
        ObjectNode era = DataDocuments.all().stream().filter(d -> d.type() == DocumentType.ERA).findFirst().orElseThrow()
                .content().deepCopy();
        String id = create("author", DocumentType.ERA, era).getBody().path("id").asString();
        String theme = era.path("era").path("themeId").asString();
        JsonNode before = get("author", BASE + "/" + id + "/validation").getBody();
        assertThat(before.path("issues")).anyMatch(i -> i.path("code").asString().equals("unknown-reference")
                && i.path("pointer").asString().equals("/era/themeId"));

        create("author", DocumentType.THEME, DataDocuments.find(DocumentType.THEME, theme).content());
        JsonNode after = get("author", BASE + "/" + id + "/validation").getBody();
        assertThat(after.path("issues")).noneMatch(i -> i.path("code").asString().equals("unknown-reference"));
        assertThat(after.path("issues")).anyMatch(i -> i.path("code").asString().equals("unpublished-reference"));
    }

    @Test
    void invalidPolygonsAreFoundByPostgis() {
        ObjectNode snapshot = DataDocuments.all().stream()
                .filter(d -> d.type() == DocumentType.TERRITORY_SNAPSHOT && d.content().has("built"))
                .findFirst().orElseThrow().content().deepCopy();
        ObjectNode geometry = (ObjectNode) snapshot.path("built").path("polities").get(0).path("geometry");
        geometry.put("type", "Polygon");
        geometry.set("coordinates", tools.jackson.databind.json.JsonMapper.shared()
                .readTree("[[[0,0],[2,2],[2,0],[0,2],[0,0]]]"));     // a bow tie: self-intersecting
        String id = create("admin", DocumentType.TERRITORY_SNAPSHOT, snapshot).getBody().path("id").asString();
        JsonNode report = get("admin", BASE + "/" + id + "/validation").getBody();
        assertThat(report.path("issues")).anyMatch(i -> i.path("code").asString().equals("invalid-geometry")
                && i.path("pointer").asString().equals("/built/polities/0/geometry"));
    }

    @Test
    void archivingIsAdminOnlyAndFinal() {
        ResponseEntity<JsonNode> created = create("author", DocumentType.PLACE, place("tebriz"));
        String id = created.getBody().path("id").asString();
        assertThat(status(transition("reviewer", id, "archive", null))).isEqualTo(403);
        ResponseEntity<JsonNode> archived = transition("admin", id, "archive", "dublikat");
        assertThat(archived.getBody().path("status").asString()).isEqualTo("ARCHIVED");
        assertThat(events.all()).singleElement().isInstanceOfSatisfying(ContentArchived.class,
                e -> assertThat(e.wasPublished()).isFalse());
        ResponseEntity<JsonNode> edit = put("admin", id, archived.getHeaders().getETag(), renamed(place("tebriz"), "X"));
        assertThat(status(edit)).isEqualTo(409);
        assertThat(edit.getBody().path("code").asString()).isEqualTo("archived");
    }

    // --- list and search ----------------------------------------------------------------------

    @Test
    void listFiltersAndSearchesWithoutAzerbaijaniLetters() {
        create("author", DocumentType.PLACE, place("tebriz"));
        create("author2", DocumentType.PLACE, place("erdebil"));
        create("author", DocumentType.ERA, DataDocuments.all().stream().filter(d -> d.type() == DocumentType.ERA)
                .findFirst().orElseThrow().content());

        assertThat(get("author", BASE).getBody()).hasSize(3);
        assertThat(get("author", BASE + "?type=PLACE").getBody()).hasSize(2);
        assertThat(get("author", BASE + "?mine=true").getBody()).hasSize(2);
        JsonNode found = get("author", BASE + "?q=erdebil").getBody();
        assertThat(found).singleElement().satisfies(d -> assertThat(d.path("title").asString()).isEqualTo("Ərdəbil"));
        assertThat(get("author", BASE + "?q=Ərdə").getBody()).hasSize(1);
        assertThat(get("author", BASE + "?q=%25").getBody()).isEmpty();           // LIKE wildcards are literal
        assertThat(get("author", BASE + "?status=PUBLISHED").getBody()).isEmpty();
        assertThat(status(get("author", BASE + "?limit=0"))).isEqualTo(400);
    }

    // --- comments -----------------------------------------------------------------------------

    @Test
    void reviewCommentsOnFieldsCanBeResolved() {
        ResponseEntity<JsonNode> created = create("author", DocumentType.PLACE, place("tebriz"));
        String id = created.getBody().path("id").asString();
        ResponseEntity<JsonNode> comment = call("reviewer", HttpMethod.POST, BASE + "/" + id + "/comments",
                Map.of("fieldPath", "/place/description/az", "body", "Mənbə göstərin"), null);
        assertThat(status(comment)).isEqualTo(201);
        String cid = comment.getBody().path("id").asString();
        assertThat(comment.getBody().path("revisionNo").asInt()).isEqualTo(1);

        assertThat(status(call("author", HttpMethod.POST, BASE + "/" + id + "/comments",
                Map.of("fieldPath", "place.description", "body", "x"), null))).isEqualTo(400);
        assertThat(status(call("author", HttpMethod.PATCH, BASE + "/" + id + "/comments/" + cid,
                Map.of("body", "dəyişdim"), null))).isEqualTo(403);
        assertThat(status(call("author2", HttpMethod.PATCH, BASE + "/" + id + "/comments/" + cid,
                Map.of("resolved", true), null))).isEqualTo(403);

        ResponseEntity<JsonNode> resolved = call("author", HttpMethod.PATCH, BASE + "/" + id + "/comments/" + cid,
                Map.of("resolved", true), null);
        assertThat(status(resolved)).isEqualTo(200);
        assertThat(resolved.getBody().path("resolved").asBoolean()).isTrue();
        assertThat(resolved.getBody().path("resolvedBy").asString()).isEqualTo(ids.get("author").toString());

        put("author", id, created.getHeaders().getETag(), renamed(place("tebriz"), "Təvriz"));
        JsonNode all = get("reviewer", BASE + "/" + id + "/comments").getBody();
        assertThat(all).singleElement().satisfies(c -> {
            assertThat(c.path("revisionNo").asInt()).isEqualTo(1);
            assertThat(c.path("fieldPath").asString()).isEqualTo("/place/description/az");
        });
        assertThat(status(call("reviewer", HttpMethod.PATCH, BASE + "/" + UUID.randomUUID() + "/comments/" + cid,
                Map.of("resolved", false), null))).isEqualTo(404);
    }
}
