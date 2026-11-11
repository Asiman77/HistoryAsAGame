package az.tarix.platform.shared.schema;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class ContentSchemasTests {

    static final Path DATA = Path.of("..", "data");
    static final Path SHARED_SCHEMA = Path.of("..", "shared", "schema");
    static final List<String> NON_CONTENT = List.of("territories/README.md");

    final ContentSchemas schemas = new ContentSchemas();
    final JsonMapper json = JsonMapper.shared();

    JsonNode parse(String text) {
        return json.readTree(text);
    }

    static List<String> dataFiles() throws IOException {
        try (Stream<Path> files = Files.walk(DATA)) {
            return files.filter(Files::isRegularFile)
                    .map(p -> DATA.relativize(p).toString().replace('\\', '/'))
                    .filter(p -> !NON_CONTENT.contains(p))
                    .sorted()
                    .toList();
        }
    }

    @Test
    void everyDataFileIsCoveredByExactlyOneSchema() throws IOException {
        List<String> files = dataFiles();
        assertThat(files).hasSizeGreaterThan(50);
        for (String file : files) {
            assertThat(schemas.dataFiles().stream().filter(f -> f.matches(file)))
                    .as(file).hasSize(1);
        }
    }

    @Test
    void everyDataFilePassesJsonSchemaValidation() throws IOException {
        List<String> failures = new ArrayList<>();
        for (String file : dataFiles()) {
            String schema = schemas.schemaForDataFile(file).orElseThrow();
            JsonNode doc = json.readTree(DATA.resolve(file).toFile());
            schemas.validate(schema, doc).forEach(v -> failures.add(file + " " + v));
        }
        assertThat(failures).isEmpty();
    }

    @Test
    void everySchemaFileCompiles() throws IOException {
        try (Stream<Path> files = Files.list(SHARED_SCHEMA)) {
            List<String> names = files.map(p -> p.getFileName().toString())
                    .filter(n -> n.endsWith(".schema.json"))
                    .map(n -> n.substring(0, n.length() - ".schema.json".length()))
                    .toList();
            assertThat(names).contains("Person", "LifeEvent", "TerritorySnapshot");
            names.forEach(n -> schemas.validate(n, parse("null")));
        }
    }

    @Test
    void reportsMissingRequiredFieldsAsJsonPointer() {
        assertThat(schemas.validate("LocalizedText", parse("{\"en\": \"Tabriz\"}")))
                .singleElement()
                .satisfies(v -> {
                    assertThat(v.pointer()).isEqualTo("/");
                    assertThat(v.keyword()).isEqualTo("required");
                });
    }

    @Test
    void followsReferencesAcrossSchemaFiles() {
        String events = """
                {"events": [{"id": "x", "personId": "p", "order": 0,
                  "date": {"year": 1501, "month": 13, "certainty": "exact"},
                  "type": "coronation", "mood": "coronation",
                  "location": {"name": {"az": "Təbriz"}, "lat": 38.08, "lng": 46.29},
                  "title": {"az": ""}, "factualSummary": {"az": "..."}, "narrative": {"az": "..."},
                  "sources": [{"title": "T", "type": "book"}]}]}
                """;
        assertThat(schemas.validate("EventsFile", parse(events)))
                .extracting(SchemaViolation::pointer)
                .containsExactlyInAnyOrder("/events/0/date/month", "/events/0/title/az");
    }

    @Test
    void enforcesSlugPatternEnumsAndUriFormat() {
        String source = "{\"title\": \"T\", \"type\": \"blog\", \"url\": \"not a url\"}";
        assertThat(schemas.validate("Source", parse(source)))
                .extracting(SchemaViolation::pointer, SchemaViolation::keyword)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("/type", "enum"),
                        org.assertj.core.groups.Tuple.tuple("/url", "format"));

        String ref = "{\"type\": \"person\", \"id\": \"Şah İsmayıl\"}";
        assertThat(schemas.validate("EntityRef", parse(ref)))
                .extracting(SchemaViolation::pointer, SchemaViolation::keyword)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("/id", "pattern"));
    }

    @Test
    void rejectsUnknownOrMalformedSchemaNames() {
        assertThatThrownBy(() -> schemas.validate("Nope", parse("{}"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> schemas.validate("../x", parse("{}"))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void exposesTheSchemaVersion() {
        assertThat(schemas.schemaVersion()).isEqualTo(1);
    }
}
