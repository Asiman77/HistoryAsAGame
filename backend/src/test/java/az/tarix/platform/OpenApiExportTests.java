package az.tarix.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Writes the public OpenAPI description to {@code shared/openapi/public.json} (BACKEND_SPEC.md
 * §17), the input of the frontend's generated types ({@code npm run api:types}). Keys are sorted
 * so the file only changes when the API does; CI fails when it is not committed up to date,
 * like {@code docs/modules}.
 */
@IntegrationTest
class OpenApiExportTests {

    static final Path OUT = Path.of("..", "shared", "openapi", "public.json");

    @LocalServerPort
    int port;

    @Test
    void writesThePublicDescription() throws Exception {
        String body = RestClient.create("http://localhost:" + port).get().uri("/v3/api-docs/public").retrieve().body(String.class);
        JsonNode api = sorted(JsonMapper.shared().readTree(body));
        // The server URL is the random test port: not part of the contract.
        ((ObjectNode) api).remove("servers");
        assertThat(api.path("paths").has("/api/v1/events")).isTrue();
        assertThat(api.path("paths").has("/api/v1/persons/{slug}/steps")).isTrue();
        Files.createDirectories(OUT.getParent());
        String json = JsonMapper.shared().writerWithDefaultPrettyPrinter().writeValueAsString(api) + "\n";
        Files.writeString(OUT, json.replace("\r\n", "\n"), StandardCharsets.UTF_8);
    }

    /** A copy with every object's keys in alphabetical order. */
    static JsonNode sorted(JsonNode node) {
        if (node.isObject()) {
            ObjectNode out = JsonNodeFactory.instance.objectNode();
            List<String> names = new ArrayList<>(node.propertyNames());
            names.sort(null);
            for (String n : names) out.set(n, sorted(node.get(n)));
            return out;
        }
        if (node.isArray()) {
            ArrayNode out = JsonNodeFactory.instance.arrayNode();
            for (JsonNode n : node) out.add(sorted(n));
            return out;
        }
        return node;
    }
}
