package az.tarix.platform.identity;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.TestcontainersConfiguration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/**
 * Login throttling over HTTP (BACKEND_SPEC.md §13). Its own context with low limits: the shared
 * {@link IntegrationTest} context switches throttling off, since every test logs in from the
 * same address.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "platform.identity.jwt-secret=" + IntegrationTest.JWT_SECRET,
        "platform.identity.admin.email=" + IntegrationTest.ADMIN_EMAIL,
        "platform.identity.admin.password=" + IntegrationTest.ADMIN_PASSWORD,
        "platform.identity.login-limit.per-address.capacity=1000",
        "platform.identity.login-limit.per-address.period=1m",
        "platform.identity.login-limit.per-account.capacity=3",
        "platform.identity.login-limit.per-account.period=15m",
})
@Import(TestcontainersConfiguration.class)
class LoginRateLimitTests {

    @LocalServerPort
    int port;

    ResponseEntity<JsonNode> login(String email, String password) {
        return RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build()
                .post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "password", password)).retrieve().toEntity(JsonNode.class);
    }

    @Test
    void tooManyAttemptsOnAnAccountAreAnsweredWith429AndRetryAfter() {
        String target = "throttled@login-limit.test";
        for (int i = 0; i < 3; i++) assertThat(login(target, "wrong password " + i).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        ResponseEntity<JsonNode> throttled = login(target, "wrong password again");
        assertThat(throttled.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(throttled.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(throttled.getHeaders().getCacheControl()).contains("no-store");
        long retryAfter = Long.parseLong(throttled.getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
        assertThat(retryAfter).isBetween(1L, 300L);
        assertThat(throttled.getBody().path("type").asString()).endsWith("/problems/too-many-requests");

        // The e-mail is compared case-insensitively, so changing case does not help.
        assertThat(login("THROTTLED@login-limit.test", "x").getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        // Other accounts can still log in.
        assertThat(login(IntegrationTest.ADMIN_EMAIL, IntegrationTest.ADMIN_PASSWORD).getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
