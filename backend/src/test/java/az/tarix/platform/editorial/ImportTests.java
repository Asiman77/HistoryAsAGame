package az.tarix.platform.editorial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.TestDatabase;
import az.tarix.platform.editorial.internal.importing.DataFolder;
import az.tarix.platform.shared.content.DocumentType;
import java.time.Duration;
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

/** Importing today's data/ (BACKEND_SPEC.md §16): everything arrives, nothing is duplicated, CMS edits are kept. */
@IntegrationTest
class ImportTests {

    static final String IMPORT = "/api/v1/admin/import";

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    JwtEncoder jwtEncoder;

    final Map<String, String> tokens = new HashMap<>();
    final Map<String, UUID> ids = new HashMap<>();

    @BeforeEach
    void users() {
        user("admin", "ADMIN");
        user("author", "AUTHOR");
    }

    @AfterEach
    void cleanUp() {
        TestDatabase.clearContent(jdbc);
        jdbc.sql("DELETE FROM app_user WHERE email LIKE '%@import.test'").update();
    }

    void user(String name, String role) {
        UUID id = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:e, :n) RETURNING id")
                .param("e", name + "@import.test").param("n", name).query(UUID.class).single();
        jdbc.sql("INSERT INTO user_role (user_id, role) VALUES (:id, :r)").param("id", id).param("r", role).update();
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("tarix-platform").subject(id.toString()).issuedAt(now)
                .expiresAt(now.plusSeconds(600)).claim("roles", List.of(role)).build();
        tokens.put(name, jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue());
        ids.put(name, id);
    }

    ResponseEntity<JsonNode> call(String who, HttpMethod method, String path, Object body, String ifMatch) {
        var spec = RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build()
                .method(method).uri(path).header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.get(who));
        if (ifMatch != null) spec = spec.header(HttpHeaders.IF_MATCH, ifMatch);
        if (body != null) spec = spec.contentType(MediaType.APPLICATION_JSON).body(body);
        return spec.retrieve().toEntity(JsonNode.class);
    }

    JsonNode runImport(boolean dryRun) {
        ResponseEntity<JsonNode> res = call("admin", HttpMethod.POST, IMPORT + "?dryRun=" + dryRun, null, null);
        assertThat(res.getStatusCode().value()).as(String.valueOf(res.getBody())).isEqualTo(200);
        return res.getBody();
    }

    long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    /** Documents whose current data cannot be published (validation errors), as type:slug. */
    static List<String> drafts(JsonNode report) {
        return stream(report.path("results")).filter(r -> !r.path("status").asString().equals("PUBLISHED"))
                .map(r -> r.path("type").asString() + ":" + r.path("slug").asString()).sorted().toList();
    }

    static java.util.stream.Stream<JsonNode> stream(JsonNode array) {
        return java.util.stream.StreamSupport.stream(array.spliterator(), false);
    }

    @Test
    void importsEverythingOnceAndPublishesWhatIsValid() {
        int expected = DataFolder.read(DataDocuments.DATA, DataDocuments.BUILT_TERRITORIES).documents().size();
        long version = count("SELECT value FROM content_version");
        JsonNode report = runImport(false);

        assertThat(report.path("dryRun").asBoolean()).isFalse();
        assertThat(report.path("documents").asInt()).isEqualTo(expected);
        assertThat(report.path("outcomes").path("CREATED").asInt()).isEqualTo(expected);
        assertThat(report.path("sourceProblems")).isEmpty();
        assertThat(count("SELECT count(*) FROM editorial_document")).isEqualTo(expected);
        assertThat(report.path("published").asInt() + report.path("drafts").asInt()).isEqualTo(expected);

        // Only content that may not go public stays a draft: the tracks awaiting permission. Every
        // territory polygon passes PostGIS (y2020 was rejected until data/territories/countries.json
        // was repaired). Each draft lists its errors.
        assertThat(drafts(report)).isNotEmpty().allMatch(d -> d.startsWith("SOUNDTRACK_TRACK:"));
        assertThat(stream(report.path("results")).filter(r -> !r.path("status").asString().equals("PUBLISHED")))
                .allMatch(r -> !r.path("errors").isEmpty());
        assertThat(stream(report.path("results")).filter(r -> r.path("type").asString().equals("SOUNDTRACK_TRACK")
                && !r.path("status").asString().equals("PUBLISHED"))).allMatch(r ->
                r.path("errors").get(0).path("code").asString().equals("media-permission"));

        // Imported revisions are written by the importer account; the admin who ran it is the actor.
        UUID importer = jdbc.sql("SELECT id FROM app_user WHERE email = 'importer@system.invalid'").query(UUID.class).single();
        assertThat(count("SELECT count(*) FROM editorial_revision WHERE author_id <> '" + importer + "'")).isZero();
        assertThat(count("SELECT count(*) FROM status_transition_log WHERE action = 'IMPORT' AND actor_id = '" + ids.get("admin") + "'"))
                .isEqualTo(report.path("published").asLong());

        // ADR-0010: the protected recordings are pending; free images are not.
        assertThat(report.path("media").path("PENDING").asInt()).isGreaterThanOrEqualTo(2);
        assertThat(report.path("media").path("NOT_REQUIRED").asInt()).isPositive();
        assertThat(report.path("mediaPending")).anyMatch(m -> m.path("docType").asString().equals("SOUNDTRACK_TRACK"));

        // ADR-0017: every linked file with a licence is in the registry, with that same status.
        long linked = count("SELECT count(*) FROM media_asset WHERE origin = 'LINKED'");
        assertThat(linked).isPositive().isEqualTo(report.path("mediaRegistry").path("registered").asLong());
        assertThat(count("SELECT count(*) FROM media_asset WHERE permission_status = 'GRANTED'")).isZero();
        assertThat(count("SELECT count(*) FROM media_asset WHERE permission_status = 'NOT_REQUIRED'")).isPositive();
        assertThat(count("SELECT count(*) FROM media_asset WHERE uploaded_by <> '" + importer + "'")).isZero();

        // The read model is rebuilt once, asynchronously.
        await().atMost(Duration.ofSeconds(60)).until(() -> count("SELECT count(*) FROM person") == 3);
        assertThat(count("SELECT value FROM content_version")).isEqualTo(version + 1);
        assertThat(count("SELECT count(*) FROM soundtrack_track WHERE permission_status = 'PENDING'")).isZero();
        // Portraits with a file point at their registry entry.
        assertThat(count("SELECT count(*) FROM portrait WHERE image IS NOT NULL")).isPositive();
        assertThat(count("SELECT count(*) FROM portrait WHERE image IS NOT NULL AND media_id IS NULL")).isZero();
    }

    @Test
    void importingTwiceChangesNothing() {
        runImport(false);
        long revisions = count("SELECT count(*) FROM editorial_revision");
        long transitions = count("SELECT count(*) FROM status_transition_log");
        long media = count("SELECT count(*) FROM media_asset");
        JsonNode second = runImport(false);

        assertThat(second.path("outcomes").path("UNCHANGED").asInt()).isEqualTo(second.path("documents").asInt());
        assertThat(second.path("published").asInt()).isZero();
        assertThat(second.path("mediaRegistry").path("registered").asInt()).isZero();
        assertThat(second.path("mediaRegistry").path("existing").asLong()).isEqualTo(media);
        assertThat(count("SELECT count(*) FROM media_asset")).isEqualTo(media);
        assertThat(count("SELECT count(*) FROM editorial_revision")).isEqualTo(revisions);
        assertThat(count("SELECT count(*) FROM status_transition_log")).isEqualTo(transitions);
        assertThat(count("SELECT count(*) FROM editorial_document")).isEqualTo(second.path("documents").asLong());
        assertThat(count("SELECT count(*) FROM (SELECT doc_type, slug FROM editorial_document GROUP BY 1, 2 HAVING count(*) > 1) d")).isZero();
    }

    @Test
    void dryRunReportsButKeepsNothing() {
        JsonNode report = runImport(true);
        assertThat(report.path("dryRun").asBoolean()).isTrue();
        assertThat(report.path("outcomes").path("CREATED").asInt()).isPositive();
        assertThat(count("SELECT count(*) FROM editorial_document")).isZero();
        assertThat(count("SELECT count(*) FROM event_publication")).isZero();
        assertThat(report.path("mediaRegistry").path("registered").asInt()).isPositive();
        assertThat(count("SELECT count(*) FROM media_asset")).isZero();
    }

    @Test
    void changedDataGetsANewRevisionButCmsEditsAreKept() {
        runImport(false);
        String place = jdbc.sql("SELECT id FROM editorial_document WHERE doc_type = 'PLACE' AND slug = 'tebriz'").query(String.class).single();
        String era = jdbc.sql("SELECT id FROM editorial_document WHERE doc_type = 'ERA' ORDER BY slug LIMIT 1").query(String.class).single();

        // The data changed since the last import (simulated: the stored hash no longer matches).
        jdbc.sql("UPDATE editorial_revision SET content_hash = sha256('older'::bytea) WHERE document_id = CAST(:d AS uuid)")
                .param("d", place).update();
        // An editor changed the era in the CMS.
        JsonNode doc = call("admin", HttpMethod.GET, "/api/v1/editorial/documents/" + era, null, null).getBody();
        ObjectNode edited = (ObjectNode) doc.path("content").deepCopy();
        ((ObjectNode) edited.path("era").path("description")).put("az", "Redaktorun mətni");
        assertThat(call("admin", HttpMethod.PUT, "/api/v1/editorial/documents/" + era, Map.of("content", edited),
                "\"" + doc.path("version").asLong() + "\"").getStatusCode().value()).isEqualTo(200);

        JsonNode report = runImport(false);
        JsonNode placeResult = stream(report.path("results")).filter(r -> r.path("slug").asString().equals("tebriz")).findFirst().orElseThrow();
        assertThat(placeResult.path("outcome").asString()).isEqualTo("UPDATED");
        assertThat(placeResult.path("revisionNo").asInt()).isEqualTo(2);
        assertThat(placeResult.path("status").asString()).isEqualTo("PUBLISHED");

        JsonNode eraResult = stream(report.path("results"))
                .filter(r -> r.path("type").asString().equals("ERA") && r.path("slug").asString().equals(doc.path("slug").asString()))
                .findFirst().orElseThrow();
        assertThat(eraResult.path("outcome").asString()).isEqualTo("CONFLICT");
        assertThat(call("admin", HttpMethod.GET, "/api/v1/editorial/documents/" + era, null, null).getBody()
                .path("content").path("era").path("description").path("az").asString()).isEqualTo("Redaktorun mətni");
    }

    @Test
    void onlyAdminsImport() {
        assertThat(call("author", HttpMethod.POST, IMPORT, null, null).getStatusCode().value()).isEqualTo(403);
        assertThat(count("SELECT count(*) FROM editorial_document")).isZero();
    }
}
