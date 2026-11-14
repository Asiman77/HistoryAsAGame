package az.tarix.platform.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.PublishedData;
import az.tarix.platform.TestDatabase;
import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.editorial.DataDocuments.Doc;
import az.tarix.platform.media.internal.storage.MediaProperties;
import az.tarix.platform.media.internal.storage.ObjectStorage;
import az.tarix.platform.publishing.internal.Projector;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.read.PublicCache;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HexFormat;
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
import software.amazon.awssdk.core.exception.SdkException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Media end to end against a real S3 store (BACKEND_SPEC.md §11, §13, §18; ADR-0017): presigned
 * upload, registration checks, the permission rules, and what the public API gives out.
 */
@IntegrationTest
class MediaFlowTests {

    static final String MEDIA = "/api/v1/editorial/media";
    static final String DOMAIN = "@media.test";
    static final byte[] PNG = bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 'I', 'H', 'D', 'R');
    static final byte[] OGG = "OggS\u0000\u0002 a short recording".getBytes(StandardCharsets.ISO_8859_1);

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    JwtEncoder jwtEncoder;

    @Autowired
    ObjectStorage storage;

    @Autowired
    MediaProperties props;

    @Autowired
    Projector projector;

    @Autowired
    PublicCache cache;

    final Map<String, String> tokens = new HashMap<>();
    final Map<String, UUID> ids = new HashMap<>();
    final HttpClient http = HttpClient.newHttpClient();

    static byte[] bytes(int... b) {
        byte[] out = new byte[b.length];
        for (int i = 0; i < b.length; i++) out[i] = (byte) b[i];
        return out;
    }

    @BeforeEach
    void setUp() {
        assumeTrue(s3Available(), "no S3 endpoint (see TestcontainersConfiguration)");
        for (String role : List.of("AUTHOR", "REVIEWER", "ADMIN")) user(role.toLowerCase(), role);
    }

    boolean s3Available() {
        if (props.s3().endpointUri() == null) return false;     // never the real AWS
        try {
            storage.ensureBucket();
            return true;
        } catch (SdkException e) {
            return false;
        }
    }

    @AfterEach
    void cleanUp() {
        TestDatabase.clearContent(jdbc);
        jdbc.sql("DELETE FROM app_user WHERE email LIKE :d").param("d", "%" + DOMAIN).update();
        cache.clear();
    }

    void user(String name, String role) {
        UUID id = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:e, :n) RETURNING id")
                .param("e", name + DOMAIN).param("n", name).query(UUID.class).single();
        jdbc.sql("INSERT INTO user_role (user_id, role) VALUES (:id, :r)").param("id", id).param("r", role).update();
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("tarix-platform").subject(id.toString()).issuedAt(now)
                .expiresAt(now.plusSeconds(600)).claim("roles", List.of(role)).build();
        tokens.put(name, jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue());
        ids.put(name, id);
    }

    ResponseEntity<JsonNode> call(String who, HttpMethod method, String path, Object body, String ifMatch) {
        var spec = RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build()
                .method(method).uri(path);
        if (who != null) spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.get(who));
        if (ifMatch != null) spec = spec.header(HttpHeaders.IF_MATCH, ifMatch);
        if (body != null) spec = spec.contentType(MediaType.APPLICATION_JSON).body(body);
        return spec.retrieve().toEntity(JsonNode.class);
    }

    /** Asks for an upload URL and puts {@code content} there, as a browser would; returns the storage key. */
    String upload(String mime, byte[] content) throws IOException, InterruptedException {
        ResponseEntity<JsonNode> res = call("author", HttpMethod.POST, MEDIA + "/uploads",
                Map.of("mimeType", mime, "sizeBytes", content.length), null);
        assertThat(res.getStatusCode().value()).as(String.valueOf(res.getBody())).isEqualTo(200);
        JsonNode u = res.getBody();
        assertThat(u.path("method").asString()).isEqualTo("PUT");
        HttpRequest.Builder put = HttpRequest.newBuilder(URI.create(u.path("url").asString()))
                .PUT(HttpRequest.BodyPublishers.ofByteArray(content));
        u.path("headers").properties().forEach(h -> put.header(h.getKey(), h.getValue().asString()));
        HttpResponse<String> stored = http.send(put.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(stored.statusCode()).as(stored.body()).isEqualTo(200);
        return u.path("storageKey").asString();
    }

    ResponseEntity<JsonNode> register(String who, String key, String license) {
        return call(who, HttpMethod.POST, MEDIA, Map.of("storageKey", key, "license", license,
                "title", Map.of("az", "Sınaq şəkli"), "rightsHolder", "Muzey"), null);
    }

    JsonNode registered(String mime, byte[] content, String license) throws Exception {
        ResponseEntity<JsonNode> res = register("author", upload(mime, content), license);
        assertThat(res.getStatusCode().value()).as(String.valueOf(res.getBody())).isEqualTo(201);
        return res.getBody();
    }

    long contentVersion() {
        return jdbc.sql("SELECT value FROM content_version").query(Long.class).single();
    }

    // --- upload and registration ---------------------------------------------------------

    @Test
    void anUploadIsRegisteredWithItsLicenceAndServedFromTheBucket() throws Exception {
        String key = upload("image/png", PNG);
        assertThat(key).matches("uploads/[0-9a-f-]{36}\\.png");
        ResponseEntity<JsonNode> res = register("author", key, "Muzeyin icazəsi ilə");
        assertThat(res.getStatusCode().value()).as(String.valueOf(res.getBody())).isEqualTo(201);
        JsonNode m = res.getBody();
        assertThat(res.getHeaders().getLocation()).hasToString(MEDIA + "/" + m.path("id").asString());
        assertThat(res.getHeaders().getETag()).isEqualTo("\"0\"");
        assertThat(m.path("ref").asString()).isEqualTo("media:" + m.path("id").asString());
        assertThat(m.path("origin").asString()).isEqualTo("UPLOAD");
        assertThat(m.path("mediaType").asString()).isEqualTo("IMAGE");
        assertThat(m.path("mimeType").asString()).isEqualTo("image/png");
        assertThat(m.path("sizeBytes").asLong()).isEqualTo(PNG.length);
        assertThat(m.path("checksum").asString()).isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(PNG)));
        // Permission is never assumed: a restricted licence starts PENDING.
        assertThat(m.path("permissionStatus").asString()).isEqualTo("PENDING");
        assertThat(m.path("uploadedBy").asString()).isEqualTo(ids.get("author").toString());
        assertThat(m.path("title").path("az").asString()).isEqualTo("Sınaq şəkli");

        // The public URL serves the file without credentials (anonymous read on the bucket).
        HttpResponse<byte[]> file = http.send(HttpRequest.newBuilder(URI.create(m.path("url").asString())).build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(file.statusCode()).isEqualTo(200);
        assertThat(file.body()).isEqualTo(PNG);

        assertThat(call("reviewer", HttpMethod.GET, MEDIA + "/" + m.path("id").asString(), null, null).getBody()
                .path("storageKey").asString()).isEqualTo(key);
        assertThat(call("reviewer", HttpMethod.GET, MEDIA + "?status=PENDING&q=" + key.substring(8, 20), null, null).getBody())
                .extracting(n -> n.path("id").asString()).containsExactly(m.path("id").asString());
        assertThat(call("reviewer", HttpMethod.GET, MEDIA + "?type=AUDIO", null, null).getBody()).isEmpty();

        // A free licence needs no permission.
        assertThat(registered("image/png", PNG, "CC0 1.0").path("permissionStatus").asString()).isEqualTo("NOT_REQUIRED");
    }

    @Test
    void onlyAllowedTypesAndSizesMayBeUploaded() {
        ResponseEntity<JsonNode> svg = call("author", HttpMethod.POST, MEDIA + "/uploads",
                Map.of("mimeType", "image/svg+xml", "sizeBytes", 100), null);
        assertThat(svg.getStatusCode().value()).isEqualTo(422);
        assertThat(svg.getBody().path("code").asString()).isEqualTo("unsupported-type");
        ResponseEntity<JsonNode> big = call("author", HttpMethod.POST, MEDIA + "/uploads",
                Map.of("mimeType", "image/jpeg", "sizeBytes", 16L * 1024 * 1024), null);
        assertThat(big.getStatusCode().value()).isEqualTo(413);
        assertThat(big.getBody().path("type").asString()).endsWith("/problems/content-too-large");
    }

    @Test
    void aFileThatIsNotWhatItClaimsIsRefusedAndDeleted() throws Exception {
        String key = upload("image/png", "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8));
        ResponseEntity<JsonNode> res = register("author", key, "CC0");
        assertThat(res.getStatusCode().value()).isEqualTo(422);
        assertThat(res.getBody().path("code").asString()).isEqualTo("content-mismatch");
        assertThat(storage.head(key)).isEmpty();
        assertThat(jdbc.sql("SELECT count(*) FROM media_asset").query(Long.class).single()).isZero();
    }

    @Test
    void registrationNeedsAnUploadedObjectALicenceAndHappensOnce() throws Exception {
        String missing = "uploads/" + UUID.randomUUID() + ".png";
        assertThat(register("author", missing, "CC0").getBody().path("code").asString()).isEqualTo("upload-missing");
        assertThat(register("author", "../secrets.png", "CC0").getBody().path("code").asString()).isEqualTo("invalid-storage-key");

        String key = upload("image/png", PNG);
        assertThat(register("author", key, " ").getBody().path("code").asString()).isEqualTo("license-required");
        assertThat(register("author", key, "CC0").getStatusCode().value()).isEqualTo(201);
        ResponseEntity<JsonNode> again = register("reviewer", key, "CC0");
        assertThat(again.getStatusCode().value()).isEqualTo(409);
        assertThat(again.getBody().path("code").asString()).isEqualTo("already-registered");
    }

    // --- permission rules ----------------------------------------------------------------

    @Test
    void onlyAnAdminGrantsAndChangesNeedTheCurrentVersion() throws Exception {
        JsonNode m = registered("image/png", PNG, "Muzeyin icazəsi ilə");
        String path = MEDIA + "/" + m.path("id").asString();

        ResponseEntity<JsonNode> byAuthor = call("author", HttpMethod.PATCH, path, Map.of("permissionStatus", "GRANTED"), "\"0\"");
        assertThat(byAuthor.getStatusCode().value()).isEqualTo(403);
        assertThat(byAuthor.getBody().path("code").asString()).isEqualTo("grant-requires-admin");
        assertThat(call("reviewer", HttpMethod.PATCH, path, Map.of("permissionStatus", "GRANTED"), "\"0\"").getStatusCode().value())
                .isEqualTo(403);

        ResponseEntity<JsonNode> noVersion = call("admin", HttpMethod.PATCH, path, Map.of("permissionStatus", "GRANTED"), null);
        assertThat(noVersion.getStatusCode().value()).isEqualTo(428);
        assertThat(noVersion.getHeaders().getETag()).isEqualTo("\"0\"");
        ResponseEntity<JsonNode> granted = call("admin", HttpMethod.PATCH, path, Map.of("permissionStatus", "GRANTED"), "\"0\"");
        assertThat(granted.getStatusCode().value()).as(String.valueOf(granted.getBody())).isEqualTo(200);
        assertThat(granted.getBody().path("permissionStatus").asString()).isEqualTo("GRANTED");
        assertThat(granted.getHeaders().getETag()).isEqualTo("\"1\"");
        assertThat(call("admin", HttpMethod.PATCH, path, Map.of("caption", Map.of("az", "x")), "\"0\"").getStatusCode().value())
                .isEqualTo(412);

        // New terms from an author drop the grant; NOT_REQUIRED needs a free licence.
        ResponseEntity<JsonNode> newTerms = call("author", HttpMethod.PATCH, path, Map.of("license", "Muzeyin yeni şərtləri"), "\"1\"");
        assertThat(newTerms.getBody().path("permissionStatus").asString()).isEqualTo("PENDING");
        ResponseEntity<JsonNode> notRequired = call("author", HttpMethod.PATCH, path, Map.of("permissionStatus", "NOT_REQUIRED"), "\"2\"");
        assertThat(notRequired.getStatusCode().value()).isEqualTo(409);
        assertThat(notRequired.getBody().path("code").asString()).isEqualTo("permission-not-applicable");
        // Only the description fields can be patched.
        assertThat(call("admin", HttpMethod.PATCH, path, Map.of("storageKey", "uploads/x.png"), "\"2\"").getBody()
                .path("code").asString()).isEqualTo("unknown-field");
    }

    // --- public output -------------------------------------------------------------------

    @Test
    void thePublicApiShowsAFileOnlyWhileItsPermissionAllows() throws Exception {
        JsonNode m = registered("image/png", PNG, "Ailənin icazəsi ilə");
        UUID owner = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:e, 'o') RETURNING id")
                .param("e", "owner" + DOMAIN).query(UUID.class).single();
        Doc hero = DataDocuments.find(DocumentType.HERO, "mehdiyev-i-lham");
        ObjectNode content = hero.content().deepCopy();
        ((ObjectNode) content.path("hero")).putObject("photo").put("url", m.path("ref").asString()).put("source", "Ailə arxivi")
                .put("license", "Ailənin icazəsi ilə").put("permissionNote", "Yazılı icazə");
        UUID doc = PublishedData.seedPublished(jdbc, new Doc(hero.type(), hero.slug(), content), owner);
        projector.project(doc);
        String heroPath = "/api/v1/heroes/" + hero.slug();

        assertThat(call(null, HttpMethod.GET, heroPath, null, null).getBody().path("photo").isNull()).isTrue();
        assertThat(jdbc.sql("SELECT count(*) FROM hero WHERE photo IS NOT NULL").query(Long.class).single()).isOne();

        long before = contentVersion();
        String path = MEDIA + "/" + m.path("id").asString();
        assertThat(call("admin", HttpMethod.PATCH, path, Map.of("permissionStatus", "GRANTED"), "\"0\"").getStatusCode().value())
                .isEqualTo(200);
        await().atMost(Duration.ofSeconds(20)).until(() -> contentVersion() > before);
        JsonNode photo = call(null, HttpMethod.GET, heroPath, null, null).getBody().path("photo");
        assertThat(photo.path("url").asString()).isEqualTo(m.path("url").asString());
        assertThat(photo.path("license").asString()).isEqualTo("Ailənin icazəsi ilə");

        long granted = contentVersion();
        assertThat(call("reviewer", HttpMethod.PATCH, path, Map.of("permissionStatus", "DENIED"), "\"1\"").getStatusCode().value())
                .isEqualTo(200);
        await().atMost(Duration.ofSeconds(20)).until(() -> contentVersion() > granted);
        assertThat(call(null, HttpMethod.GET, heroPath, null, null).getBody().path("photo").isNull()).isTrue();
    }

    @Test
    void soundtracksListOnlyPlayableRecordings() throws Exception {
        JsonNode recording = registered("audio/ogg", OGG, "CC BY 4.0");
        UUID owner = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:e, 'o') RETURNING id")
                .param("e", "owner" + DOMAIN).query(UUID.class).single();
        for (Doc t : DataDocuments.all()) {
            if (t.type() != DocumentType.SOUNDTRACK_TRACK) continue;
            ObjectNode content = t.content().deepCopy();
            if (t.slug().equals("veten-yaxsidir")) {
                ((ObjectNode) content.path("track")).put("permissionStatus", "granted").put("file", recording.path("ref").asString());
            }
            projector.project(PublishedData.seedPublished(jdbc, new Doc(t.type(), t.slug(), content), owner));
        }

        JsonNode all = call(null, HttpMethod.GET, "/api/v1/soundtracks", null, null).getBody();
        assertThat(all).extracting(n -> n.path("slug").asString()).containsExactly("veten-yaxsidir");
        assertThat(all.get(0).path("url").asString()).isEqualTo(recording.path("url").asString());
        assertThat(all.get(0).path("moods")).extracting(JsonNode::asString).containsExactly("VICTORY");
        assertThat(call(null, HttpMethod.GET, "/api/v1/soundtracks?mood=death", null, null).getBody()).isEmpty();
        assertThat(call(null, HttpMethod.GET, "/api/v1/soundtracks?mood=victory&conflict=karabakh-war-2020", null, null).getBody())
                .hasSize(1);
        assertThat(call(null, HttpMethod.GET, "/api/v1/soundtracks?mood=sad", null, null).getStatusCode().value()).isEqualTo(400);
    }
}
