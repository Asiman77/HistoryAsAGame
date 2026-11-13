package az.tarix.platform.identity;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.identity.api.SystemAccounts;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** Accounts managed by an ADMIN, and a user changing their own password, over HTTP. */
@IntegrationTest
class AccountManagementTests {

    static final String PASSWORD = "a long enough passphrase";

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    SystemAccounts systemAccounts;

    @AfterEach
    void cleanUp() {
        jdbc.sql("DELETE FROM refresh_token").update();
        jdbc.sql("DELETE FROM app_user WHERE email LIKE '%@accounts.test'").update();
        jdbc.sql("UPDATE app_user SET enabled = true WHERE email = :admin").param("admin", IntegrationTest.ADMIN_EMAIL).update();
    }

    ResponseEntity<JsonNode> call(HttpMethod method, String path, String token, Object body) {
        RestClient.RequestBodySpec req = RestClient.builder().baseUrl("http://localhost:" + port)
                .defaultStatusHandler(s -> true, (q, r) -> {}).build()
                .method(method).uri(path);
        if (token != null) req.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).body(body);
        return req.retrieve().toEntity(JsonNode.class);
    }

    JsonNode loginBody(String email, String password) {
        ResponseEntity<JsonNode> res = call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", email, "password", password));
        assertThat(res.getStatusCode()).as("login " + email).isEqualTo(HttpStatus.OK);
        return res.getBody();
    }

    String admin() {
        return loginBody(IntegrationTest.ADMIN_EMAIL, IntegrationTest.ADMIN_PASSWORD).path("accessToken").asString();
    }

    ResponseEntity<JsonNode> create(String token, String email, List<String> roles) {
        return call(HttpMethod.POST, "/api/v1/admin/users", token,
                Map.of("email", email, "displayName", "Test " + email, "roles", roles, "password", PASSWORD));
    }

    UUID createOk(String token, String email, String... roles) {
        ResponseEntity<JsonNode> res = create(token, email, List.of(roles));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return UUID.fromString(res.getBody().path("id").asString());
    }

    int loginStatus(String email, String password) {
        return call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", email, "password", password)).getStatusCode().value();
    }

    int refreshStatus(String refreshToken) {
        return call(HttpMethod.POST, "/api/v1/auth/refresh", null, Map.of("refreshToken", refreshToken)).getStatusCode().value();
    }

    static List<String> strings(JsonNode array, String field) {
        return StreamSupport.stream(array.spliterator(), false).map(n -> n.path(field).asString()).toList();
    }

    @Test
    void anAdminCreatesAnAccountThatCanLogIn() {
        String admin = admin();
        ResponseEntity<JsonNode> res = create(admin, "Author@Accounts.test", List.of("AUTHOR", "REVIEWER"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(res.getHeaders().getLocation().getPath()).isEqualTo("/api/v1/admin/users/" + res.getBody().path("id").asString());
        assertThat(res.getHeaders().getCacheControl()).contains("no-store");
        assertThat(res.getBody().path("email").asString()).isEqualTo("author@accounts.test");
        assertThat(res.getBody().path("roles").size()).isEqualTo(2);
        assertThat(res.getBody().has("password")).isFalse();
        assertThat(res.getBody().has("passwordHash")).isFalse();

        JsonNode me = call(HttpMethod.GET, "/api/v1/auth/me", loginBody("author@accounts.test", PASSWORD).path("accessToken").asString(),
                null).getBody();
        assertThat(me.path("roles").toString()).contains("AUTHOR", "REVIEWER");
    }

    @Test
    void creatingChecksTheEmailRolesAndPassword() {
        String admin = admin();
        createOk(admin, "dup@accounts.test", "AUTHOR");
        ResponseEntity<JsonNode> dup = create(admin, "DUP@accounts.test", List.of("AUTHOR"));
        assertThat(dup.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(dup.getBody().path("code").asString()).isEqualTo("duplicate-email");

        ResponseEntity<JsonNode> weak = call(HttpMethod.POST, "/api/v1/admin/users", admin,
                Map.of("email", "weak@accounts.test", "displayName", "W", "roles", List.of("AUTHOR"), "password", "short"));
        assertThat(weak.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(weak.getBody().path("code").asString()).isEqualTo("invalid-password");
        assertThat(weak.getBody().path("problems").size()).isPositive();

        assertThat(create(admin, "noroles@accounts.test", List.of()).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(create(admin, "not-an-email", List.of("AUTHOR")).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(create(admin, "x@accounts.test", List.of("PRINCIPAL")).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void theListFiltersByRoleAndTextAndHidesSystemAccounts() {
        String admin = admin();
        systemAccounts.importer();
        createOk(admin, "teacher.one@accounts.test", "TEACHER");
        createOk(admin, "author.one@accounts.test", "AUTHOR");

        List<String> all = strings(call(HttpMethod.GET, "/api/v1/admin/users", admin, null).getBody(), "email");
        assertThat(all).contains(IntegrationTest.ADMIN_EMAIL, "teacher.one@accounts.test", "author.one@accounts.test")
                .noneMatch(e -> e.endsWith("@system.invalid"));
        assertThat(strings(call(HttpMethod.GET, "/api/v1/admin/users?role=TEACHER", admin, null).getBody(), "email"))
                .contains("teacher.one@accounts.test").doesNotContain("author.one@accounts.test");
        assertThat(strings(call(HttpMethod.GET, "/api/v1/admin/users?q=AUTHOR.ONE", admin, null).getBody(), "email"))
                .containsExactly("author.one@accounts.test");

        UUID importer = systemAccounts.importer();
        assertThat(call(HttpMethod.GET, "/api/v1/admin/users/" + importer, admin, null).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(call(HttpMethod.PATCH, "/api/v1/admin/users/" + importer, admin, Map.of("enabled", true)).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void disablingOrChangingRolesEndsTheUsersSessions() {
        String admin = admin();
        UUID id = createOk(admin, "worker@accounts.test", "AUTHOR");
        String refresh = loginBody("worker@accounts.test", PASSWORD).path("refreshToken").asString();

        ResponseEntity<JsonNode> promoted = call(HttpMethod.PATCH, "/api/v1/admin/users/" + id, admin,
                Map.of("roles", List.of("AUTHOR", "REVIEWER"), "displayName", "Renamed"));
        assertThat(promoted.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(promoted.getBody().path("displayName").asString()).isEqualTo("Renamed");
        assertThat(refreshStatus(refresh)).isEqualTo(401);

        String second = loginBody("worker@accounts.test", PASSWORD).path("refreshToken").asString();
        assertThat(call(HttpMethod.PATCH, "/api/v1/admin/users/" + id, admin, Map.of("enabled", false)).getBody()
                .path("enabled").asBoolean()).isFalse();
        assertThat(refreshStatus(second)).isEqualTo(401);
        assertThat(loginStatus("worker@accounts.test", PASSWORD)).isEqualTo(401);

        call(HttpMethod.PATCH, "/api/v1/admin/users/" + id, admin, Map.of("enabled", true));
        assertThat(loginStatus("worker@accounts.test", PASSWORD)).isEqualTo(200);

        // Renaming alone leaves the sessions alone.
        String third = loginBody("worker@accounts.test", PASSWORD).path("refreshToken").asString();
        call(HttpMethod.PATCH, "/api/v1/admin/users/" + id, admin, Map.of("displayName", "Again"));
        assertThat(refreshStatus(third)).isEqualTo(200);
    }

    @Test
    void anAdminCannotLockThemselvesOutAndTheLastAdminStays() {
        String admin = admin();
        UUID me = UUID.fromString(call(HttpMethod.GET, "/api/v1/auth/me", admin, null).getBody().path("id").asString());
        ResponseEntity<JsonNode> selfDisable = call(HttpMethod.PATCH, "/api/v1/admin/users/" + me, admin, Map.of("enabled", false));
        assertThat(selfDisable.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(selfDisable.getBody().path("code").asString()).isEqualTo("self-lockout");
        assertThat(call(HttpMethod.PATCH, "/api/v1/admin/users/" + me, admin, Map.of("roles", List.of("AUTHOR")))
                .getBody().path("code").asString()).isEqualTo("self-lockout");

        // A second admin, disabled while their access token is still valid, cannot disable the only enabled admin.
        UUID other = createOk(admin, "admin2@accounts.test", "ADMIN");
        String otherToken = loginBody("admin2@accounts.test", PASSWORD).path("accessToken").asString();
        assertThat(call(HttpMethod.PATCH, "/api/v1/admin/users/" + other, admin, Map.of("enabled", false)).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        ResponseEntity<JsonNode> last = call(HttpMethod.PATCH, "/api/v1/admin/users/" + me, otherToken, Map.of("enabled", false));
        assertThat(last.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(last.getBody().path("code").asString()).isEqualTo("last-admin");
    }

    @Test
    void anAdminSetsAPasswordAndTheUserChangesItLater() {
        String admin = admin();
        UUID id = createOk(admin, "forgetful@accounts.test", "AUTHOR");
        String oldSession = loginBody("forgetful@accounts.test", PASSWORD).path("refreshToken").asString();

        String reset = "another long passphrase";
        assertThat(call(HttpMethod.PUT, "/api/v1/admin/users/" + id + "/password", admin, Map.of("password", reset)).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(refreshStatus(oldSession)).isEqualTo(401);
        assertThat(loginStatus("forgetful@accounts.test", PASSWORD)).isEqualTo(401);

        JsonNode tokens = loginBody("forgetful@accounts.test", reset);
        String access = tokens.path("accessToken").asString();
        ResponseEntity<JsonNode> wrong = call(HttpMethod.POST, "/api/v1/auth/password", access,
                Map.of("currentPassword", "not it at all", "newPassword", "my very own passphrase"));
        assertThat(wrong.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(wrong.getBody().path("code").asString()).isEqualTo("wrong-password");
        ResponseEntity<JsonNode> weak = call(HttpMethod.POST, "/api/v1/auth/password", access,
                Map.of("currentPassword", reset, "newPassword", "short"));
        assertThat(weak.getBody().path("code").asString()).isEqualTo("invalid-password");

        assertThat(call(HttpMethod.POST, "/api/v1/auth/password", access,
                Map.of("currentPassword", reset, "newPassword", "my very own passphrase")).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(refreshStatus(tokens.path("refreshToken").asString())).isEqualTo(401);
        assertThat(loginStatus("forgetful@accounts.test", "my very own passphrase")).isEqualTo(200);

        assertThat(call(HttpMethod.POST, "/api/v1/auth/password", null,
                Map.of("currentPassword", "x", "newPassword", "y")).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unknownAccountsAreNotFound() {
        String admin = admin();
        assertThat(call(HttpMethod.GET, "/api/v1/admin/users/" + UUID.randomUUID(), admin, null).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(call(HttpMethod.PUT, "/api/v1/admin/users/" + UUID.randomUUID() + "/password", admin, Map.of("password", PASSWORD))
                .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
