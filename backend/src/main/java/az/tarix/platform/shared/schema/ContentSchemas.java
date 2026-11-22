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
    /** The same schemas with {@code unevaluatedProperties: false} on every object: finds keys no schema knows. */
    private final SchemaRegistry strictRegistry;
    private final List<DataFile> dataFiles;
    private final int schemaVersion;
    private final ConcurrentMap<String, Schema> schemas = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Schema> strictSchemas = new ConcurrentHashMap<>();

    public ContentSchemas() {
        SchemaRegistryConfig config = SchemaRegistryConfig.builder()
                // Zod checks z.url(), so "format": "uri" must be asserted here too, not only annotated.
                .formatAssertionsEnabled(true)
                .pathType(PathType.JSON_POINTER)
                .build();
        this.registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12, b -> b
                .schemaRegistryConfig(config)
                .schemaIdResolvers(r -> r.mapPrefix(BASE, "classpath:" + CLASSPATH_DIR)));
        this.strictRegistry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12, b -> b
                .schemaRegistryConfig(config)
                .schemas(iri -> iri.startsWith(BASE) ? strict(iri.substring(BASE.length())) : null));

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

    /**
     * Keys inside {@code document} that no schema describes (Zod ignores them, so they are not
     * errors, but they are usually typos or leftovers): JSON Pointers of the objects holding them,
     * with a message naming the keys.
     */
    public List<SchemaViolation> unknownKeys(String schemaName, JsonNode document) {
        checkName(schemaName);
        Schema strict = strictSchemas.computeIfAbsent(schemaName,
                n -> strictRegistry.getSchema(SchemaLocation.of(BASE + n + ".schema.json")));
        return strict.validate(document).stream()
                .filter(e -> "unevaluatedProperties".equals(e.getKeyword()))
                .map(e -> new SchemaViolation(pointer(e.getInstanceLocation().toString()), e.getKeyword(), e.getMessage()))
                .toList();
    }

    /**
     * A schema file with {@code unevaluatedProperties: false} added to every object schema that
     * lists its properties and does not decide about others itself. Branches of
     * {@code anyOf}/{@code oneOf}/{@code allOf} are left open: a strict branch would fail for keys
     * that another branch (or the parent) evaluates.
     */
    static String strict(String file) {
        JsonNode root = readClasspathJson(file);
        close(root, false);
        return root.toString();
    }

    private static void close(JsonNode node, boolean inBranch) {
        if (node instanceof tools.jackson.databind.node.ObjectNode o) {
            if (!inBranch && o.has("properties") && !o.has("additionalProperties") && !o.has("unevaluatedProperties")) {
                o.put("unevaluatedProperties", false);
            }
            for (String key : List.copyOf(o.propertyNames())) {
                boolean branch = key.equals("anyOf") || key.equals("oneOf") || key.equals("allOf");
                close(o.get(key), branch || (inBranch && !key.equals("properties") && !key.equals("items")
                        && !key.equals("$defs") && !key.equals("prefixItems")));
            }
        } else if (node != null && node.isArray()) {
            for (JsonNode child : node) close(child, inBranch);
        }
    }

    private void checkName(String name) {
        if (!name.matches("[A-Za-z]+")) throw new IllegalArgumentException("invalid schema name: " + name);
        if (getClass().getClassLoader().getResource(CLASSPATH_DIR + name + ".schema.json") == null) {
            throw new IllegalArgumentException("unknown schema: " + name);
        }
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
