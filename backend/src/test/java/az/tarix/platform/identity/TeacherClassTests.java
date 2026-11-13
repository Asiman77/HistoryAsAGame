package az.tarix.platform.identity;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.identity.api.ClassGroups;
import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import java.time.Instant;
import java.util.EnumSet;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** Teacher classes over HTTP: a teacher sees and changes only their own (BACKEND_SPEC.md §18). */
@IntegrationTest
class TeacherClassTests {

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
    ClassGroups classGroups;

    @AfterEach
    void cleanUp() {
        jdbc.sql("DELETE FROM class_group").update();
        jdbc.sql("DELETE FROM refresh_token").update();
        jdbc.sql("DELETE FROM app_user WHERE email LIKE '%@classes.test'").update();
    }

    String tokenOf(String email, Role role) {
        users.save(new AppUser(email, "Test", passwords.encode(PASSWORD), EnumSet.of(role), Instant.now()));
        return call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", email, "password", PASSWORD))
                .getBody().path("accessToken").asString();
    }

    ResponseEntity<JsonNode> call(HttpMethod method, String path, String token, Object body) {
        RestClient.RequestBodySpec req = RestClient.builder().baseUrl("http://localhost:" + port)
                .defaultStatusHandler(s -> true, (q, r) -> {}).build().method(method).uri(path);
        if (token != null) req.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).body(body);
        return req.retrieve().toEntity(JsonNode.class);
    }

    String create(String token, String name) {
        ResponseEntity<JsonNode> res = call(HttpMethod.POST, "/api/v1/teacher/classes", token, Map.of("name", name));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return res.getBody().path("code").asString();
    }

    static List<String> codes(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false).map(n -> n.path("code").asString()).toList();
    }

    @Test
    void aTeacherCreatesListsRenamesAndDeletesTheirClasses() {
        String teacher = tokenOf("teacher@classes.test", Role.TEACHER);
        ResponseEntity<JsonNode> created = call(HttpMethod.POST, "/api/v1/teacher/classes", teacher, Map.of("name", " 7A sinfi "));
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String code = created.getBody().path("code").asString();
        assertThat(code).matches("[A-HJKMNP-Z2-9]{6}");
        assertThat(created.getBody().path("name").asString()).isEqualTo("7A sinfi");
        assertThat(created.getHeaders().getLocation().getPath()).isEqualTo("/api/v1/teacher/classes/" + code);
        String second = create(teacher, "7B sinfi");

        assertThat(codes(call(HttpMethod.GET, "/api/v1/teacher/classes", teacher, null).getBody())).containsExactly(code, second);
        // Codes are typed by hand: any case works.
        assertThat(call(HttpMethod.GET, "/api/v1/teacher/classes/" + code.toLowerCase(), teacher, null).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(call(HttpMethod.PATCH, "/api/v1/teacher/classes/" + code, teacher, Map.of("name", "8A sinfi")).getBody()
                .path("name").asString()).isEqualTo("8A sinfi");
        assertThat(call(HttpMethod.DELETE, "/api/v1/teacher/classes/" + second, teacher, null).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(codes(call(HttpMethod.GET, "/api/v1/teacher/classes", teacher, null).getBody())).containsExactly(code);
    }

    @Test
    void aTeacherCannotSeeOrChangeAnotherTeachersClass() {
        String one = tokenOf("one@classes.test", Role.TEACHER);
        String other = tokenOf("other@classes.test", Role.TEACHER);
        String code = create(one, "Birinci");

        assertThat(codes(call(HttpMethod.GET, "/api/v1/teacher/classes", other, null).getBody())).isEmpty();
        for (ResponseEntity<JsonNode> res : List.of(
                call(HttpMethod.GET, "/api/v1/teacher/classes/" + code, other, null),
                call(HttpMethod.PATCH, "/api/v1/teacher/classes/" + code, other, Map.of("name", "Oğurlanmış")),
                call(HttpMethod.DELETE, "/api/v1/teacher/classes/" + code, other, null))) {
            // The same answer as for a code that does not exist: nothing to probe.
            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
        assertThat(call(HttpMethod.GET, "/api/v1/teacher/classes/ZZZZZZ", other, null).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(call(HttpMethod.GET, "/api/v1/teacher/classes/" + code, one, null).getBody().path("name").asString())
                .isEqualTo("Birinci");

        UUID oneId = users.findByEmail("one@classes.test").orElseThrow().id();
        UUID otherId = users.findByEmail("other@classes.test").orElseThrow().id();
        assertThat(classGroups.ownedBy(code.toLowerCase(), oneId)).isTrue();
        assertThat(classGroups.ownedBy(code, otherId)).isFalse();
        assertThat(classGroups.byCode("nonsense")).isEmpty();
    }

    @Test
    void onlyTeachersManageClassesAndAnAdminSeesThemAll() {
        String teacher = tokenOf("t@classes.test", Role.TEACHER);
        String code = create(teacher, "9C");
        String author = tokenOf("author@classes.test", Role.AUTHOR);
        assertThat(call(HttpMethod.GET, "/api/v1/teacher/classes", author, null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(call(HttpMethod.POST, "/api/v1/teacher/classes", author, Map.of("name", "x")).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(call(HttpMethod.GET, "/api/v1/teacher/classes", null, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        String admin = call(HttpMethod.POST, "/api/v1/auth/login", null,
                Map.of("email", IntegrationTest.ADMIN_EMAIL, "password", IntegrationTest.ADMIN_PASSWORD)).getBody().path("accessToken").asString();
        assertThat(codes(call(HttpMethod.GET, "/api/v1/admin/classes", admin, null).getBody())).contains(code);
        assertThat(call(HttpMethod.GET, "/api/v1/admin/classes", teacher, null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        // ADMIN is not a teacher: the teacher endpoints are for a teacher's own classes.
        assertThat(call(HttpMethod.GET, "/api/v1/teacher/classes", admin, null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void aClassNeedsAName() {
        String teacher = tokenOf("named@classes.test", Role.TEACHER);
        assertThat(call(HttpMethod.POST, "/api/v1/teacher/classes", teacher, Map.of("name", "  ")).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(call(HttpMethod.POST, "/api/v1/teacher/classes", teacher, Map.of("name", "x".repeat(121))).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
