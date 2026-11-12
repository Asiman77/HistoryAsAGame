package az.tarix.platform.editorial.internal.content;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/** Parsing, canonical form and hashing of revision content. */
public final class ContentJson {

    private static final JsonMapper JSON = JsonMapper.shared();

    private ContentJson() {}

    public static JsonNode parse(String json) {
        try {
            return JSON.readTree(json);
        } catch (JacksonException e) {
            throw new IllegalStateException("stored content is not JSON", e);
        }
    }

    public static String write(JsonNode node) {
        return JSON.writeValueAsString(node);
    }

    /** The same JSON with object keys sorted at every level; arrays keep their order. */
    public static JsonNode canonical(JsonNode node) {
        if (node.isObject()) {
            List<String> names = new ArrayList<>(node.propertyNames());
            names.sort(null);
            ObjectNode out = JsonNodeFactory.instance.objectNode();
            for (String n : names) out.set(n, canonical(node.get(n)));
            return out;
        }
        if (node.isArray()) {
            ArrayNode out = JsonNodeFactory.instance.arrayNode(node.size());
            for (JsonNode item : node) out.add(canonical(item));
            return out;
        }
        return node;
    }

    /** SHA-256 of the canonical JSON: equal content gives the same hash whatever the key order. */
    public static byte[] hash(JsonNode content) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(write(canonical(content)).getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Text at a JSON Pointer, or null when absent or not a string. */
    public static String text(JsonNode root, String pointer) {
        JsonNode n = root.at(pointer);
        return n.isString() ? n.stringValue() : null;
    }

    /** Escapes one reference token of a JSON Pointer (RFC 6901 §3). */
    public static String escape(String token) {
        return token.replace("~", "~0").replace("/", "~1");
    }

    /** Iterates the properties of an object node (empty for anything else). */
    public static Iterable<Map.Entry<String, JsonNode>> fields(JsonNode node) {
        return node.isObject() ? node.properties() : List.of();
    }
}
