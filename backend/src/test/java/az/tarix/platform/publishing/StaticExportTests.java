package az.tarix.platform.publishing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.TestDatabase;
import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.editorial.internal.importing.DataImporter;
import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.identity.api.Role;
import az.tarix.platform.media.api.PublicContentStore;
import az.tarix.platform.publishing.internal.export.StaticExporter;
import az.tarix.platform.shared.schema.ContentSchemas;
import az.tarix.platform.shared.schema.SchemaViolation;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import software.amazon.awssdk.core.exception.SdkException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * The static export of today's data (BACKEND_SPEC.md §15, §18): imported and exported again,
 * it is the data/ folder (same files, same content, same order), minus what may not be
 * published; every file passes the shared schema the frontend's Zod schemas are checked
 * against. The export is also written to {@code target/static-export} for
 * {@code npx tsx scripts/validate-data.ts backend/target/static-export/data}.
 */
@IntegrationTest
class StaticExportTests {

    static final Path ROOT = DataDocuments.DATA.getParent();
    /** Under data/ but not content: base maps and notes, never documents. */
    static final Set<String> NOT_CONTENT = Set.of("data/territories/countries.json", "data/territories/land.json");

    @Autowired
    DataImporter importer;

    @Autowired
    StaticExporter exporter;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    PublicContentStore store;

    @Value("${platform.media.s3.endpoint:}")
    String s3Endpoint;

    final ContentSchemas schemas = new ContentSchemas();

    @BeforeEach
    void importData() {
        UUID admin = jdbc.sql("SELECT id FROM app_user WHERE email = :e").param("e", IntegrationTest.ADMIN_EMAIL)
                .query(UUID.class).single();
        importer.run(new CurrentUser(admin, Set.of(Role.ADMIN)), false);
    }

    @AfterEach
    void cleanUp() {
        TestDatabase.clearContent(jdbc);
    }

    /** type:slug of every document that is not public (the importer leaves invalid ones as drafts). */
    Set<String> drafts() {
        return new HashSet<>(jdbc.sql("SELECT doc_type || ':' || slug FROM editorial_document WHERE published_revision_id IS NULL")
                .query(String.class).list());
    }

    /** Every JSON file of data/ and the built polygons, as export paths. */
    static Map<String, JsonNode> repositoryFiles() throws IOException {
        Map<String, JsonNode> out = new TreeMap<>();
        for (Path dir : List.of(DataDocuments.DATA, DataDocuments.BUILT_TERRITORIES)) {
            try (Stream<Path> files = Files.walk(dir)) {
                for (Path f : files.filter(p -> p.toString().endsWith(".json")).toList()) {
                    String path = ROOT.relativize(f).toString().replace('\\', '/');
                    if (!NOT_CONTENT.contains(path)) out.put(path, JsonMapper.shared().readTree(f.toFile()));
                }
            }
        }
        return out;
    }

    @Test
    void theExportIsTheDataMinusWhatMayNotBePublished() throws IOException {
        Set<String> drafts = drafts();
        assertThat(drafts).isNotEmpty();      // today: the two tracks awaiting permission and one snapshot
        Map<String, JsonNode> exported = exporter.build().files();

        Map<String, JsonNode> expected = new TreeMap<>();
        repositoryFiles().forEach((path, json) -> {
            JsonNode e = withoutDrafts(path, json.deepCopy(), drafts);
            if (e != null) expected.put(path, e);
        });

        assertThat(exported.keySet()).containsExactlyElementsOf(expected.keySet());
        List<String> different = new ArrayList<>();
        expected.forEach((path, json) -> {
            if (!json.equals(exported.get(path))) different.add(path);
        });
        assertThat(different).as("files whose content or order differs from the repository").isEmpty();
    }

    /** What the export should contain of a repository file, or null when nothing of it is public. */
    static JsonNode withoutDrafts(String path, JsonNode json, Set<String> drafts) {
        String name = path.substring(path.lastIndexOf('/') + 1).replace(".json", "");
        if (path.startsWith("data/territories/snapshots/") || path.startsWith("public/data/territories/")) {
            return drafts.contains("TERRITORY_SNAPSHOT:" + name) ? null : json;
        }
        if (path.endsWith("/soundtrack.json")) {
            ArrayNode tracks = (ArrayNode) json.path("tracks");
            for (int i = tracks.size() - 1; i >= 0; i--) {
                if (drafts.contains("SOUNDTRACK_TRACK:" + tracks.get(i).path("trackId").asString())) tracks.remove(i);
            }
            return tracks.isEmpty() ? null : json;
        }
        return json;
    }

    @Test
    void everyExportedFilePassesTheSharedSchema() throws IOException {
        Map<String, JsonNode> exported = exporter.build().files();
        Path out = Path.of("target", "static-export");
        List<String> problems = new ArrayList<>();
        for (Map.Entry<String, JsonNode> f : exported.entrySet()) {
            String path = f.getKey();
            String schema = path.startsWith("public/data/territories/") ? "TerritorySnapshot"
                    : schemas.schemaForDataFile(path.substring("data/".length())).orElse(null);
            if (schema == null) {
                problems.add(path + ": no schema");
                continue;
            }
            for (SchemaViolation v : schemas.validate(schema, f.getValue())) problems.add(path + " " + v);
            Path file = out.resolve(path);
            Files.createDirectories(file.getParent());
            Files.write(file, JsonMapper.shared().writerWithDefaultPrettyPrinter().writeValueAsBytes(f.getValue()));
        }
        assertThat(problems).isEmpty();
    }

    @Test
    void aWithdrawnPermissionRemovesTheFileFromTheExport() {
        String portrait = "/portraits/shah-ismayil.jpg";
        assertThat(jdbc.sql("UPDATE media_asset SET permission_status = 'DENIED' WHERE storage_key = :k").param("k", portrait).update())
                .isOne();
        jdbc.sql("UPDATE content_version SET value = value + 1").update();     // what MediaAssetChanged does

        JsonNode person = exporter.build().files().get("data/persons/shah-ismayil/person.json");
        assertThat(person.has("portrait")).isFalse();
        assertThat(schemas.validate("Person", person)).isEmpty();
        assertThat(person.toString()).doesNotContain(portrait);
    }

    @Test
    void writesVersionedFilesThenTheManifest() {
        assumeTrue(!s3Endpoint.isBlank(), "no S3 endpoint (see TestcontainersConfiguration)");
        try {
            exporter.exportedVersion();
        } catch (SdkException e) {
            assumeTrue(false, "S3 not reachable");
        }
        StaticExporter.Report report = exporter.export();
        JsonNode manifest = JsonMapper.shared().readTree(store.get("latest.json"));
        assertThat(manifest.path("contentVersion").asLong()).isEqualTo(report.contentVersion());
        assertThat(manifest.path("prefix").asString()).isEqualTo("v" + report.contentVersion() + "/");
        assertThat(manifest.path("files")).hasSize(report.files());
        JsonNode places = JsonMapper.shared().readTree(store.get("v" + report.contentVersion() + "/data/places.json"));
        assertThat(places).isEqualTo(exporter.build().files().get("data/places.json"));
        assertThat(exporter.exportedVersion()).isEqualTo(report.contentVersion());
        assertThat(((ObjectNode) manifest).has("generatedAt")).isTrue();
    }
}
