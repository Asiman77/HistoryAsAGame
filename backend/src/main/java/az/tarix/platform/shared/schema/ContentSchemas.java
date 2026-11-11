package az.tarix.platform.shared.schema;

import com.networknt.schema.Schema;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SchemaRegistryConfig;
import com.networknt.schema.SpecificationVersion;
import com.networknt.schema.path.PathType;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Validates content documents against shared/schema (JSON Schema 2020-12), which the build
 * copies onto the classpath under {@code schema/}. Schema ids use {@link #BASE}; that prefix
 * is mapped to the classpath, so nothing is ever fetched over the network.
 */
@Component
public class ContentSchemas {

    public static final String BASE = "https://tarixin-icinde.az/schema/v1/";
    static final String CLASSPATH_DIR = "schema/";

    private final SchemaRegistry registry;
    private final List<DataFile> dataFiles;
    private final int schemaVersion;
    private final ConcurrentMap<String, Schema> schemas = new ConcurrentHashMap<>();

    public ContentSchemas() {
        SchemaRegistryConfig config = SchemaRegistryConfig.builder()
                // Zod checks z.url(), so "format": "uri" must be asserted here too, not only annotated.
                .formatAssertionsEnabled(true)
                .pathType(PathType.JSON_POINTER)
                .build();
        this.registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12, b -> b
                .schemaRegistryConfig(config)
                .schemaIdResolvers(r -> r.mapPrefix(BASE, "classpath:" + CLASSPATH_DIR)));

        JsonNode manifest = readClasspathJson("files.json");
        this.schemaVersion = manifest.path("schemaVersion").asInt();
        this.dataFiles = manifest.path("files").valueStream()
                .map(f -> new DataFile(f.path("pattern").asString(), f.path("schema").asString()))
                .toList();
    }

    /** Version of the schema set; stored with every editorial revision. */
    public int schemaVersion() {
        return schemaVersion;
    }

    /** Which data/ files follow which schema (shared/schema/files.json). */
    public List<DataFile> dataFiles() {
        return dataFiles;
    }

    /** Schema for a data/ path relative to data/, if the manifest covers it. */
    public Optional<String> schemaForDataFile(String relativePath) {
        return dataFiles.stream().filter(f -> f.matches(relativePath)).map(DataFile::schema).findFirst();
    }

    /** Validates {@code document} against the named schema, e.g. {@code "LifeEvent"}; empty list means valid. */
    public List<SchemaViolation> validate(String schemaName, JsonNode document) {
        return schema(schemaName).validate(document).stream()
                .map(e -> new SchemaViolation(pointer(e.getInstanceLocation().toString()), e.getKeyword(), e.getMessage()))
                .toList();
    }

    private Schema schema(String name) {
        if (!name.matches("[A-Za-z]+")) throw new IllegalArgumentException("invalid schema name: " + name);
        return schemas.computeIfAbsent(name, n -> {
            if (getClass().getClassLoader().getResource(CLASSPATH_DIR + n + ".schema.json") == null) {
                throw new IllegalArgumentException("unknown schema: " + n);
            }
            return registry.getSchema(SchemaLocation.of(BASE + n + ".schema.json"));
        });
    }

    /** The root location is "" in JSON Pointer; keep it explicit as "/" for readability. */
    private static String pointer(String location) {
        return location.isEmpty() ? "/" : location;
    }

    private static JsonNode readClasspathJson(String file) {
        try (InputStream in = ContentSchemas.class.getClassLoader().getResourceAsStream(CLASSPATH_DIR + file)) {
            if (in == null) throw new IllegalStateException("classpath:" + CLASSPATH_DIR + file + " missing; is shared/schema built?");
            return JsonMapper.shared().readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
