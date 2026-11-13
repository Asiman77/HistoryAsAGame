package az.tarix.platform.identity;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import az.tarix.platform.shared.web.PublicApi;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Who may call what (BACKEND_SPEC.md §8.2, §13, §18): every non-public endpoint against every
 * role and an anonymous caller. Allowed means the request gets past security (whatever the
 * business answer: 200, 404, 422…); denied means 403, anonymous 401. The test also fails when
 * an endpoint exists that the matrix does not list, so a new endpoint cannot ship without a rule.
 */
@IntegrationTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PermissionMatrixTests {

    static final String PASSWORD = "a long enough passphrase";
    static final String DOMAIN = "@matrix.test";

    /** A caller: anonymous or one role. */
    enum Caller { ANONYMOUS, AUTHOR, REVIEWER, TEACHER, ADMIN }

    static final Set<Caller> EDITORS = EnumSet.of(Caller.AUTHOR, Caller.REVIEWER, Caller.ADMIN);
    static final Set<Caller> ADMIN = EnumSet.of(Caller.ADMIN);
    static final Set<Caller> TEACHER = EnumSet.of(Caller.TEACHER);
    static final Set<Caller> SIGNED_IN = EnumSet.of(Caller.AUTHOR, Caller.REVIEWER, Caller.TEACHER, Caller.ADMIN);
    static final Set<Caller> EVERYONE = EnumSet.allOf(Caller.class);

    /**
     * One row of the matrix.
     *
     * @param pattern  as mapped ({@code {id}} etc.)
     * @param path     a concrete request for it
     * @param body     a well-formed body (validation runs before method security), or null
     * @param exercise whether allowed callers really send it; false for heavy or global actions
     *                 (import, rebuild), where only the denials are checked
     */
    record Rule(HttpMethod method, String pattern, String path, Object body, Set<Caller> allowed, boolean exercise) {

        Rule(HttpMethod method, String pattern, String path, Object body, Set<Caller> allowed) {
            this(method, pattern, path, body, allowed, true);
        }

        String key() {
            return method.name() + " " + pattern;
        }
    }

    static final String DOC = "/api/v1/editorial/documents/" + UUID.randomUUID();
    static final String USER = "/api/v1/admin/users/" + UUID.randomUUID();

    static final List<Rule> MATRIX = List.of(
            // Editorial (§8.2): authors, reviewers and admins; the role rules per action are in the workflow.
            new Rule(HttpMethod.GET, "/api/v1/editorial/documents", "/api/v1/editorial/documents", null, EDITORS),
            new Rule(HttpMethod.POST, "/api/v1/editorial/documents", "/api/v1/editorial/documents",
                    Map.of("type", "GLOSSARY_ENTRY", "content", Map.of()), EDITORS),
            new Rule(HttpMethod.GET, "/api/v1/editorial/documents/{id}", DOC, null, EDITORS),
            new Rule(HttpMethod.PUT, "/api/v1/editorial/documents/{id}", DOC, Map.of("content", Map.of()), EDITORS),
            new Rule(HttpMethod.GET, "/api/v1/editorial/documents/{id}/revisions", DOC + "/revisions", null, EDITORS),
            new Rule(HttpMethod.GET, "/api/v1/editorial/documents/{id}/revisions/{revisionNo}", DOC + "/revisions/1", null, EDITORS),
            new Rule(HttpMethod.GET, "/api/v1/editorial/documents/{id}/diff", DOC + "/diff?from=1&to=2", null, EDITORS),
            new Rule(HttpMethod.POST, "/api/v1/editorial/documents/{id}/revert", DOC + "/revert?to=1", null, EDITORS),
            new Rule(HttpMethod.GET, "/api/v1/editorial/documents/{id}/validation", DOC + "/validation", null, EDITORS),
            new Rule(HttpMethod.POST, "/api/v1/editorial/documents/{id}/transitions", DOC + "/transitions",
                    Map.of("action", "submit"), EDITORS),
            new Rule(HttpMethod.GET, "/api/v1/editorial/documents/{id}/transitions", DOC + "/transitions", null, EDITORS),
            new Rule(HttpMethod.GET, "/api/v1/editorial/documents/{id}/comments", DOC + "/comments", null, EDITORS),
            new Rule(HttpMethod.POST, "/api/v1/editorial/documents/{id}/comments", DOC + "/comments", Map.of("body", "x"), EDITORS),
            new Rule(HttpMethod.PATCH, "/api/v1/editorial/documents/{id}/comments/{commentId}",
                    DOC + "/comments/" + UUID.randomUUID(), Map.of("resolved", true), EDITORS),
            // Administration.
            new Rule(HttpMethod.GET, "/api/v1/admin/broken-references", "/api/v1/admin/broken-references", null, ADMIN),
            new Rule(HttpMethod.POST, "/api/v1/admin/import", "/api/v1/admin/import?dryRun=true", null, ADMIN, false),
            new Rule(HttpMethod.POST, "/api/v1/admin/projections/rebuild", "/api/v1/admin/projections/rebuild", null, ADMIN, false),
            new Rule(HttpMethod.GET, "/api/v1/admin/users", "/api/v1/admin/users", null, ADMIN),
            new Rule(HttpMethod.POST, "/api/v1/admin/users", "/api/v1/admin/users",
                    Map.of("email", "new" + DOMAIN, "displayName", "New", "roles", List.of("AUTHOR"), "password", "short"), ADMIN),
            new Rule(HttpMethod.GET, "/api/v1/admin/users/{id}", USER, null, ADMIN),
            new Rule(HttpMethod.PATCH, "/api/v1/admin/users/{id}", USER, Map.of("displayName", "X"), ADMIN),
            new Rule(HttpMethod.PUT, "/api/v1/admin/users/{id}/password", USER + "/password", Map.of("password", PASSWORD), ADMIN),
            new Rule(HttpMethod.GET, "/api/v1/admin/classes", "/api/v1/admin/classes", null, ADMIN),
            // Teachers' own classes.
            new Rule(HttpMethod.GET, "/api/v1/teacher/classes", "/api/v1/teacher/classes", null, TEACHER),
            new Rule(HttpMethod.POST, "/api/v1/teacher/classes", "/api/v1/teacher/classes", Map.of("name", "Matris"), TEACHER),
            new Rule(HttpMethod.GET, "/api/v1/teacher/classes/{code}", "/api/v1/teacher/classes/ZZZZZZ", null, TEACHER),
            new Rule(HttpMethod.PATCH, "/api/v1/teacher/classes/{code}", "/api/v1/teacher/classes/ZZZZZZ", Map.of("name", "Y"), TEACHER),
            new Rule(HttpMethod.DELETE, "/api/v1/teacher/classes/{code}", "/api/v1/teacher/classes/ZZZZZZ", null, TEACHER),
            // Own account.
            new Rule(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/login", Map.of("email", "nobody" + DOMAIN, "password", "x"),
                    EVERYONE),
            new Rule(HttpMethod.POST, "/api/v1/auth/refresh", "/api/v1/auth/refresh", Map.of("refreshToken", "x"), EVERYONE),
            new Rule(HttpMethod.POST, "/api/v1/auth/logout", "/api/v1/auth/logout", Map.of("refreshToken", "x"), EVERYONE),
            new Rule(HttpMethod.GET, "/api/v1/auth/me", "/api/v1/auth/me", null, SIGNED_IN),
            new Rule(HttpMethod.POST, "/api/v1/auth/password", "/api/v1/auth/password",
                    Map.of("currentPassword", "not the password", "newPassword", "another long passphrase"), SIGNED_IN),
            // Operations: health and info are public, the rest is for admins.
            new Rule(HttpMethod.GET, "/actuator/health", "/actuator/health", null, EVERYONE),
            new Rule(HttpMethod.GET, "/actuator/metrics", "/actuator/metrics", null, ADMIN),
            new Rule(HttpMethod.GET, "/actuator/prometheus", "/actuator/prometheus", null, ADMIN),
            new Rule(HttpMethod.GET, "/actuator/modulith", "/actuator/modulith", null, ADMIN));

    /** Mapped by libraries (OpenAPI, Swagger UI, the error page), not by us. */
    static final List<String> FOREIGN = List.of("/v3/api-docs", "/swagger-ui", "/error");

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    AppUserRepository users;

    @Autowired
    PasswordEncoder passwords;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping mappings;

    final Map<Caller, String> tokens = new EnumMap<>(Caller.class);

    @BeforeAll
    void signIn() {
        for (Caller c : List.of(Caller.AUTHOR, Caller.REVIEWER, Caller.TEACHER)) {
            String email = c.name().toLowerCase() + DOMAIN;
            users.save(new AppUser(email, c.name(), passwords.encode(PASSWORD), EnumSet.of(Role.valueOf(c.name())), Instant.now()));
            tokens.put(c, login(email, PASSWORD));
        }
        tokens.put(Caller.ADMIN, login(IntegrationTest.ADMIN_EMAIL, IntegrationTest.ADMIN_PASSWORD));
    }

    @AfterAll
    void cleanUp() {
        jdbc.sql("DELETE FROM class_group").update();
        jdbc.sql("DELETE FROM review_comment").update();
        jdbc.sql("DELETE FROM refresh_token").update();
        jdbc.sql("DELETE FROM app_user WHERE email LIKE :d").param("d", "%" + DOMAIN).update();
    }

    RestClient http() {
        return RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build();
    }

    String login(String email, String password) {
        return http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "password", password)).retrieve().toEntity(tools.jackson.databind.JsonNode.class)
                .getBody().path("accessToken").asString();
    }

    /**
     * The security layer's verdict: {@code unauthorized} / {@code forbidden} when it refused
     * (by Problem Details type, so a business 401 such as a wrong password is not mistaken
     * for one), else {@code passed}.
     */
    String verdict(Rule rule, Caller caller) {
        RestClient.RequestBodySpec req = http().method(rule.method()).uri(rule.path());
        if (caller != Caller.ANONYMOUS) req.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.get(caller));
        if (rule.body() != null) req.contentType(MediaType.APPLICATION_JSON).body(rule.body());
        var res = req.retrieve().toEntity(String.class);
        int status = res.getStatusCode().value();
        String body = res.getBody() == null ? "" : res.getBody();
        if (status == 401 && body.contains("/problems/unauthorized")) return "unauthorized";
        if (status == 403 && body.contains("/problems/forbidden")) return "forbidden";
        // Anything else, a business 401 (wrong password: authentication-failed) included, got past security.
        return "passed";
    }

    @TestFactory
    Stream<DynamicTest> everyEndpointAgainstEveryCaller() {
        List<DynamicTest> tests = new ArrayList<>();
        for (Rule rule : MATRIX) {
            for (Caller caller : Caller.values()) {
                boolean allowed = rule.allowed().contains(caller);
                if (allowed && !rule.exercise()) continue;
                String expected = allowed ? "passed" : caller == Caller.ANONYMOUS ? "unauthorized" : "forbidden";
                tests.add(DynamicTest.dynamicTest(rule.key() + " as " + caller + " → " + expected, () ->
                        assertThat(verdict(rule, caller)).as("%s as %s", rule.key(), caller).isEqualTo(expected)));
            }
        }
        return tests.stream();
    }

    @Test
    void everyNonPublicEndpointIsInTheMatrix() {
        Set<String> listed = new TreeSet<>();
        MATRIX.forEach(r -> listed.add(r.key()));
        Set<String> missing = new TreeSet<>();
        mappings.getHandlerMethods().forEach((RequestMappingInfo info, org.springframework.web.method.HandlerMethod handler) -> {
            if (AnnotatedElementUtils.hasAnnotation(handler.getBeanType(), PublicApi.class)) return;
            for (String pattern : info.getPatternValues()) {
                if (FOREIGN.stream().anyMatch(pattern::startsWith)) continue;
                Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
                for (RequestMethod m : methods.isEmpty() ? EnumSet.allOf(RequestMethod.class) : methods) {
                    String key = m.name() + " " + pattern;
                    if (!listed.contains(key)) missing.add(key);
                }
            }
        });
        assertThat(missing).as("endpoints without a permission rule").isEmpty();
    }

    @Test
    void everyPublicEndpointIsReadOnly() {
        mappings.getHandlerMethods().forEach((info, handler) -> {
            if (!AnnotatedElementUtils.hasAnnotation(handler.getBeanType(), PublicApi.class)) return;
            assertThat(info.getMethodsCondition().getMethods()).as(info.toString()).containsOnly(RequestMethod.GET);
        });
    }
}
