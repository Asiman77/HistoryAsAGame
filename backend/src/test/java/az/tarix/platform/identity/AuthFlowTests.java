package az.tarix.platform.identity;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** Login, token rotation, reuse detection and access rules over real HTTP and a real database. */
@IntegrationTest
class AuthFlowTests {

    static final String PASSWORD = "a long enough passphrase";

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    AppUserRepository users;

    @Autowired
    PasswordEncoder passwords;

    @Autowired
    JwtEncoder jwtEncoder;

    RestClient http() {
        return RestClient.builder().baseUrl("http://localhost:" + port)
                .defaultStatusHandler(status -> true, (request, response) -> {})
                .build();
    }

    @AfterEach
    void cleanUp() {
        jdbc.sql("DELETE FROM refresh_token").update();
        jdbc.sql("DELETE FROM app_user WHERE email <> :admin").param("admin", IntegrationTest.ADMIN_EMAIL).update();
    }

    AppUser createUser(String email, Role... roles) {
        return users.save(new AppUser(email, "Test", passwords.encode(PASSWORD),
                roles.length == 0 ? EnumSet.noneOf(Role.class) : EnumSet.of(roles[0], roles), Instant.now()));
    }

    ResponseEntity<JsonNode> post(String path, Object body) {
        return http().post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().toEntity(JsonNode.class);
    }

    ResponseEntity<JsonNode> login(String email, String password) {
        return post("/api/v1/auth/login", Map.of("email", email, "password", password));
    }

    ResponseEntity<JsonNode> refresh(String token) {
        return post("/api/v1/auth/refresh", Map.of("refreshToken", token));
    }

    ResponseEntity<JsonNode> me(String accessToken) {
        return http().get().uri("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .retrieve().toEntity(JsonNode.class);
    }

    // --- bootstrap and login ------------------------------------------------------------

    @Test
    void bootstrapCreatesTheAdminWithAnArgon2idHash() {
        AppUser admin = users.findByEmail(IntegrationTest.ADMIN_EMAIL).orElseThrow();
        assertThat(admin.roles()).containsExactly(Role.ADMIN);
        assertThat(admin.passwordHash()).startsWith("$argon2id$").doesNotContain(IntegrationTest.ADMIN_PASSWORD);
    }

    @Test
    void loginReturnsUncacheableTokensThatAuthenticateTheCaller() {
        ResponseEntity<JsonNode> res = login(IntegrationTest.ADMIN_EMAIL.toUpperCase(), IntegrationTest.ADMIN_PASSWORD);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getHeaders().getCacheControl()).contains("no-store");
        JsonNode body = res.getBody();
        assertThat(body.path("tokenType").asString()).isEqualTo("Bearer");
        assertThat(body.path("expiresIn").asLong()).isEqualTo(900);
        assertThat(body.path("refreshExpiresIn").asLong()).isEqualTo(14 * 24 * 3600);

        JsonNode me = me(body.path("accessToken").asString()).getBody();
        assertThat(me.path("email").asString()).isEqualTo(IntegrationTest.ADMIN_EMAIL);
        assertThat(me.path("roles").get(0).asString()).isEqualTo("ADMIN");
    }

    @Test
    void failedLoginsLookTheSameWhateverTheCause() {
        createUser("disabled@test.invalid", Role.AUTHOR);
        users.findByEmail("disabled@test.invalid").ifPresent(u -> {
            u.disable(Instant.now());
            users.save(u);
        });
        ResponseEntity<JsonNode> wrongPassword = login(IntegrationTest.ADMIN_EMAIL, "not the right password");
        ResponseEntity<JsonNode> unknownEmail = login("nobody@test.invalid", PASSWORD);
        ResponseEntity<JsonNode> disabled = login("disabled@test.invalid", PASSWORD);

        for (ResponseEntity<JsonNode> res : java.util.List.of(wrongPassword, unknownEmail, disabled)) {
            assertThat(res.getStatusCode().value()).isEqualTo(401);
            assertThat(res.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);
            assertThat(res.getBody().path("type").asString()).endsWith("/problems/authentication-failed");
        }
        assertThat(unknownEmail.getBody()).isEqualTo(wrongPassword.getBody()).isEqualTo(disabled.getBody());
    }

    @Test
    void invalidRequestBodiesAreProblemDetails() {
        ResponseEntity<JsonNode> res = post("/api/v1/auth/login", Map.of("email", "a@b.az"));
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertThat(res.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);
    }

    // --- refresh rotation ---------------------------------------------------------------

    @Test
    void refreshRotatesTheToken() {
        createUser("author@test.invalid", Role.AUTHOR);
        JsonNode first = login("author@test.invalid", PASSWORD).getBody();
        ResponseEntity<JsonNode> second = refresh(first.path("refreshToken").asString());

        assertThat(second.getStatusCode().value()).isEqualTo(200);
        assertThat(second.getBody().path("refreshToken").asString()).isNotEqualTo(first.path("refreshToken").asString());
        assertThat(me(second.getBody().path("accessToken").asString()).getBody().path("roles").get(0).asString())
                .isEqualTo("AUTHOR");
    }

    @Test
    void reusingARotatedTokenRevokesTheWholeSession() {
        createUser("author@test.invalid", Role.AUTHOR);
        String stolen = login("author@test.invalid", PASSWORD).getBody().path("refreshToken").asString();
        String legitimate = refresh(stolen).getBody().path("refreshToken").asString();

        assertThat(refresh(stolen).getStatusCode().value()).isEqualTo(401);
        // The attacker's reuse also kills the legitimate continuation of the session…
        assertThat(refresh(legitimate).getStatusCode().value()).isEqualTo(401);
        // …but not other sessions of the same user.
        String otherSession = login("author@test.invalid", PASSWORD).getBody().path("refreshToken").asString();
        assertThat(refresh(otherSession).getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void expiredRefreshTokensAreRejected() {
        createUser("author@test.invalid", Role.AUTHOR);
        String token = login("author@test.invalid", PASSWORD).getBody().path("refreshToken").asString();
        jdbc.sql("UPDATE refresh_token SET created_at = now() - interval '20 days', expires_at = now() - interval '1 second'")
                .update();
        assertThat(refresh(token).getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void logoutEndsTheSessionAndIsIdempotent() {
        String token = login(IntegrationTest.ADMIN_EMAIL, IntegrationTest.ADMIN_PASSWORD).getBody().path("refreshToken").asString();
        assertThat(post("/api/v1/auth/logout", Map.of("refreshToken", token)).getStatusCode().value()).isEqualTo(204);
        assertThat(refresh(token).getStatusCode().value()).isEqualTo(401);
        assertThat(post("/api/v1/auth/logout", Map.of("refreshToken", "unknown")).getStatusCode().value()).isEqualTo(204);
    }

    @Test
    void disablingAUserStopsRefresh() {
        AppUser user = createUser("author@test.invalid", Role.AUTHOR);
        String token = login("author@test.invalid", PASSWORD).getBody().path("refreshToken").asString();
        AppUser reloaded = users.findById(user.id()).orElseThrow();
        reloaded.disable(Instant.now());
        users.save(reloaded);
        assertThat(refresh(token).getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void storesOnlyHashesOfRefreshTokens() {
        String token = login(IntegrationTest.ADMIN_EMAIL, IntegrationTest.ADMIN_PASSWORD).getBody().path("refreshToken").asString();
        long plain = jdbc.sql("SELECT count(*) FROM refresh_token WHERE encode(token_hash, 'escape') LIKE :t")
                .param("t", "%" + token + "%").query(Long.class).single();
        assertThat(plain).isZero();
    }

    // --- access tokens and access rules ---------------------------------------------------

    @Test
    void rejectsMissingTamperedExpiredOrForeignTokens() {
        ResponseEntity<JsonNode> anonymous = http().get().uri("/api/v1/auth/me").retrieve().toEntity(JsonNode.class);
        assertThat(anonymous.getStatusCode().value()).isEqualTo(401);
        assertThat(anonymous.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE)).isEqualTo("Bearer");
        assertThat(anonymous.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);

        String valid = login(IntegrationTest.ADMIN_EMAIL, IntegrationTest.ADMIN_PASSWORD).getBody().path("accessToken").asString();
        String tampered = valid.substring(0, valid.length() - 4) + (valid.endsWith("AAAA") ? "BBBB" : "AAAA");
        assertThat(me(tampered).getStatusCode().value()).isEqualTo(401);
        assertThat(me(tampered).getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE)).contains("invalid_token");

        Instant past = Instant.now().minus(1, ChronoUnit.HOURS);
        assertThat(me(token("tarix-platform", past, past.plusSeconds(60))).getStatusCode().value()).isEqualTo(401);
        Instant now = Instant.now();
        assertThat(me(token("someone-else", now, now.plusSeconds(600))).getStatusCode().value()).isEqualTo(401);
        assertThat(me(token("tarix-platform", now, now.plusSeconds(600))).getStatusCode().value()).isEqualTo(200);
    }

    String token(String issuer, Instant issuedAt, Instant expiresAt) {
        String adminId = users.findByEmail(IntegrationTest.ADMIN_EMAIL).orElseThrow().id().toString();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer(issuer).subject(adminId).issuedAt(issuedAt)
                .expiresAt(expiresAt).claim("roles", java.util.List.of("ADMIN")).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    @Test
    void publicReadApiIsOpenAndEverythingElseNeedsAToken() {
        // Anonymous GETs reach the application: a public resource answers, an unknown one is 404 (not 401).
        assertThat(http().get().uri("/api/v1/persons").retrieve().toBodilessEntity().getStatusCode().value()).isEqualTo(200);
        assertThat(http().get().uri("/api/v1/no-such-resource").retrieve().toBodilessEntity().getStatusCode().value())
                .isEqualTo(404);
        assertThat(http().get().uri("/api/v1/editorial/documents").retrieve().toBodilessEntity().getStatusCode().value())
                .isEqualTo(401);
        assertThat(http().post().uri("/api/v1/persons").retrieve().toBodilessEntity().getStatusCode().value()).isEqualTo(401);
        assertThat(http().get().uri("/actuator/health").retrieve().toBodilessEntity().getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void operationalEndpointsNeedTheAdminRole() {
        createUser("author@test.invalid", Role.AUTHOR);
        String author = login("author@test.invalid", PASSWORD).getBody().path("accessToken").asString();
        String admin = login(IntegrationTest.ADMIN_EMAIL, IntegrationTest.ADMIN_PASSWORD).getBody().path("accessToken").asString();

        assertThat(http().get().uri("/actuator/metrics").retrieve().toBodilessEntity().getStatusCode().value()).isEqualTo(401);
        ResponseEntity<JsonNode> forbidden = http().get().uri("/actuator/metrics")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + author).retrieve().toEntity(JsonNode.class);
        assertThat(forbidden.getStatusCode().value()).isEqualTo(403);
        assertThat(forbidden.getBody().path("type").asString()).endsWith("/problems/forbidden");
        assertThat(http().get().uri("/actuator/metrics").header(HttpHeaders.AUTHORIZATION, "Bearer " + admin)
                .retrieve().toBodilessEntity().getStatusCode().value()).isEqualTo(200);
    }
}
