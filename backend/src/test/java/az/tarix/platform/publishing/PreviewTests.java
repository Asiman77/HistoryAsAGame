package az.tarix.platform.publishing;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.TestDatabase;
import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.shared.content.DocumentType;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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

/**
 * {@code GET /editorial/documents/{id}/preview}: a draft revision in the public API format,
 * projected in a transaction that is rolled back, so nothing leaks into the public API.
 */
@IntegrationTest
class PreviewTests {

    static final String BASE = "/api/v1/editorial/documents";

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    JwtEncoder jwtEncoder;

    String token;

    @BeforeEach
    void author() {
        var id = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES ('author@preview.test', 'author') RETURNING id")
                .query(java.util.UUID.class).single();
        jdbc.sql("INSERT INTO user_role (user_id, role) VALUES (:id, 'AUTHOR')").param("id", id).update();
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("tarix-platform").subject(id.toString()).issuedAt(now)
                .expiresAt(now.plusSeconds(600)).claim("roles", List.of("AUTHOR")).build();
        token = jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    @AfterEach
    void cleanUp() {
        TestDatabase.clearContent(jdbc);
        jdbc.sql("DELETE FROM app_user WHERE email LIKE '%@preview.test'").update();
    }

    ResponseEntity<JsonNode> call(HttpMethod method, String path, Object body, String ifMatch, boolean signedIn) {
        var spec = RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build()
                .method(method).uri(path);
        if (signedIn) spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        if (ifMatch != null) spec = spec.header(HttpHeaders.IF_MATCH, ifMatch);
        if (body != null) spec = spec.contentType(MediaType.APPLICATION_JSON).body(body);
        return spec.retrieve().toEntity(JsonNode.class);
    }

    static ObjectNode tebriz(String name) {
        ObjectNode content = DataDocuments.find(DocumentType.PLACE, "tebriz").content().deepCopy();
        ((ObjectNode) content.path("place").path("names").path("historical")).put("az", name);
        return content;
    }

    long placeRows() {
        return jdbc.sql("SELECT count(*) FROM place WHERE slug = 'tebriz'").query(Long.class).single();
    }

    @Test
    void aDraftIsShownInThePublicFormatWithoutReachingThePublicApi() {
        ResponseEntity<JsonNode> created = call(HttpMethod.POST, BASE,
                Map.of("type", "PLACE", "content", tebriz("Təbriz"), "changeNote", "ilk"), null, true);
        String id = created.getBody().path("id").asString();
        long version = jdbc.sql("SELECT value FROM content_version").query(Long.class).single();

        ResponseEntity<JsonNode> preview = call(HttpMethod.GET, BASE + "/" + id + "/preview", null, null, true);
        assertThat(preview.getStatusCode().value()).isEqualTo(200);
        assertThat(preview.getHeaders().getCacheControl()).isEqualTo("no-store");
        JsonNode body = preview.getBody();
        assertThat(body.path("type").asString()).isEqualTo("PLACE");
        assertThat(body.path("revisionNo").asInt()).isEqualTo(1);
        // geo serves the place, catalog its timeline: the same shapes as GET /places/{slug}(/timeline).
        assertThat(body.path("parts").path("place").path("slug").asString()).isEqualTo("tebriz");
        assertThat(body.path("parts").path("place").path("historicalName").asString()).isEqualTo("Təbriz");
        assertThat(body.path("parts").has("timeline")).isTrue();

        // Rolled back: no rows, no new content version, and the public API (and its cache) never saw it.
        assertThat(placeRows()).isZero();
        assertThat(jdbc.sql("SELECT value FROM content_version").query(Long.class).single()).isEqualTo(version);
        assertThat(call(HttpMethod.GET, "/api/v1/places/tebriz", null, null, false).getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void anyRevisionAndAnyLanguageCanBePreviewed() {
        ResponseEntity<JsonNode> created = call(HttpMethod.POST, BASE,
                Map.of("type", "PLACE", "content", tebriz("Təbriz"), "changeNote", "ilk"), null, true);
        String id = created.getBody().path("id").asString();
        call(HttpMethod.PUT, BASE + "/" + id, Map.of("content", tebriz("Təbriz (paytaxt)")), created.getHeaders().getETag(), true);

        String current = call(HttpMethod.GET, BASE + "/" + id + "/preview", null, null, true).getBody()
                .path("parts").path("place").path("historicalName").asString();
        String first = call(HttpMethod.GET, BASE + "/" + id + "/preview?revision=1", null, null, true).getBody()
                .path("parts").path("place").path("historicalName").asString();
        assertThat(current).isEqualTo("Təbriz (paytaxt)");
        assertThat(first).isEqualTo("Təbriz");

        JsonNode all = call(HttpMethod.GET, BASE + "/" + id + "/preview?lang=all", null, null, true).getBody();
        assertThat(all.path("parts").path("place").path("historicalName").path("az").asString()).isEqualTo("Təbriz (paytaxt)");

        assertThat(call(HttpMethod.GET, BASE + "/" + id + "/preview?revision=9", null, null, true).getStatusCode().value()).isEqualTo(404);
        assertThat(call(HttpMethod.GET, BASE + "/" + id + "/preview?revision=0", null, null, true).getStatusCode().value()).isEqualTo(400);
        assertThat(call(HttpMethod.GET, BASE + "/" + java.util.UUID.randomUUID() + "/preview", null, null, true)
                .getStatusCode().value()).isEqualTo(404);
        assertThat(placeRows()).isZero();
    }
}
