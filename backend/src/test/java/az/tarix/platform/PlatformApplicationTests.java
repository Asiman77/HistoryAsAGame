package az.tarix.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.client.RestClient;

@IntegrationTest
class PlatformApplicationTests {

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    RestClient http() {
        return RestClient.create("http://localhost:" + port);
    }

    @Test
    void migrationsApplyFromScratch() {
        List<String> applied = jdbc.sql("SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank")
                .query(String.class).list();
        assertThat(applied).startsWith("001", "002");
    }

    @Test
    void postgisAndTrigramExtensionsAreInstalled() {
        List<String> ext = jdbc.sql("SELECT extname FROM pg_extension").query(String.class).list();
        assertThat(ext).contains("postgis", "pg_trgm");
        assertThat(jdbc.sql("SELECT ST_AsText(ST_SetSRID(ST_MakePoint(48.29, 38.25), 4326))")
                .query(String.class).single()).isEqualTo("POINT(48.29 38.25)");
    }

    @Test
    void healthIsUp() {
        ResponseEntity<String> res = http().get().uri("/actuator/health").retrieve().toEntity(String.class);
        assertThat(res.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(res.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void everyResponseCarriesARequestId() {
        var generated = http().get().uri("/actuator/health").retrieve().toBodilessEntity();
        assertThat(generated.getHeaders().getFirst("X-Request-Id")).matches("[0-9a-f-]{36}");

        var echoed = http().get().uri("/actuator/health").header("X-Request-Id", "abc-12345678")
                .retrieve().toBodilessEntity();
        assertThat(echoed.getHeaders().getFirst("X-Request-Id")).isEqualTo("abc-12345678");

        var rejected = http().get().uri("/actuator/health").header("X-Request-Id", "bad id; level=ERROR")
                .retrieve().toBodilessEntity();
        assertThat(rejected.getHeaders().getFirst("X-Request-Id")).matches("[0-9a-f-]{36}");
    }
}
