package az.tarix.platform.identity;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

/** Security headers and CORS (BACKEND_SPEC.md §13) on real responses. */
@IntegrationTest
class SecurityHeadersTests {

    @LocalServerPort
    int port;

    ResponseEntity<String> exchange(HttpMethod method, String path, Consumer<HttpHeaders> headers) {
        return RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build()
                .method(method).uri(path).headers(headers).retrieve().toEntity(String.class);
    }

    @Test
    void everyApiResponseCarriesTheSecurityHeaders() {
        for (String path : new String[] {"/api/v1/eras", "/api/v1/editorial/documents", "/api/v1/nothing-here"}) {
            HttpHeaders h = exchange(HttpMethod.GET, path, x -> {}).getHeaders();
            assertThat(h.getFirst("X-Content-Type-Options")).as(path).isEqualTo("nosniff");
            assertThat(h.getFirst("Referrer-Policy")).as(path).isEqualTo("no-referrer");
            assertThat(h.getFirst("X-Frame-Options")).as(path).isEqualTo("DENY");
            assertThat(h.getFirst("Content-Security-Policy")).as(path).startsWith("default-src 'none'")
                    .contains("frame-ancestors 'none'");
        }
    }

    @Test
    void swaggerUiGetsAPolicyItCanRunUnder() {
        ResponseEntity<String> page = exchange(HttpMethod.GET, "/swagger-ui/index.html", x -> {});
        assertThat(page.getStatusCode()).isEqualTo(HttpStatus.OK);
        String csp = page.getHeaders().getFirst("Content-Security-Policy");
        assertThat(csp).startsWith("default-src 'self'").contains("script-src 'self'").doesNotContain("'unsafe-eval'");
        // Its scripts are files, none inline, so script-src 'self' is enough.
        assertThat(page.getBody()).doesNotContainPattern("<script>\\s*\\S");
    }

    @Test
    void aConfiguredOriginMayCallTheApiFromABrowser() {
        ResponseEntity<String> preflight = exchange(HttpMethod.OPTIONS, "/api/v1/editorial/documents", h -> {
            h.setOrigin(IntegrationTest.ALLOWED_ORIGIN);
            h.setAccessControlRequestMethod(HttpMethod.PUT);
            h.setAccessControlRequestHeaders(java.util.List.of("authorization", "if-match", "content-type"));
        });
        assertThat(preflight.getStatusCode()).isEqualTo(HttpStatus.OK);
        HttpHeaders h = preflight.getHeaders();
        assertThat(h.getAccessControlAllowOrigin()).isEqualTo(IntegrationTest.ALLOWED_ORIGIN);
        assertThat(h.getAccessControlAllowMethods()).contains(HttpMethod.PUT);
        assertThat(h.getAccessControlAllowCredentials()).isFalse();

        ResponseEntity<String> get = exchange(HttpMethod.GET, "/api/v1/eras", x -> x.setOrigin(IntegrationTest.ALLOWED_ORIGIN));
        assertThat(get.getHeaders().getAccessControlAllowOrigin()).isEqualTo(IntegrationTest.ALLOWED_ORIGIN);
        assertThat(get.getHeaders().getAccessControlExposeHeaders()).contains("ETag", "Retry-After", "Location");
    }

    @Test
    void anyOtherOriginIsRefused() {
        ResponseEntity<String> preflight = exchange(HttpMethod.OPTIONS, "/api/v1/eras", h -> {
            h.setOrigin("https://evil.test");
            h.setAccessControlRequestMethod(HttpMethod.GET);
        });
        assertThat(preflight.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(preflight.getHeaders().getAccessControlAllowOrigin()).isNull();

        ResponseEntity<String> get = exchange(HttpMethod.GET, "/api/v1/eras", x -> x.setOrigin("https://evil.test"));
        assertThat(get.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get.getHeaders().getAccessControlAllowOrigin()).isNull();
        // Without an Origin header (servers, scripts) nothing changes.
        assertThat(exchange(HttpMethod.GET, "/api/v1/eras", x -> {}).getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
