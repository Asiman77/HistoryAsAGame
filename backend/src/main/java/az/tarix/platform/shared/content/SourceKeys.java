package az.tarix.platform.shared.content;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import tools.jackson.databind.JsonNode;

/**
 * Identity of an inline {@code Source} (ADR-0007): {@code sha256(title|author|url|type)}, so
 * the same book cited in two documents is one {@code source} row with one slug.
 */
public final class SourceKeys {

    private SourceKeys() {}

    public static byte[] hash(JsonNode source) {
        String key = String.join("|", nz(source.path("title")), nz(source.path("author")), nz(source.path("url")),
                nz(source.path("type")));
        try {
            return MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** {@code src-} and the first 12 bytes of the hash in hex. */
    public static String slug(byte[] hash) {
        return "src-" + HexFormat.of().formatHex(hash, 0, 12);
    }

    public static String slug(JsonNode source) {
        return slug(hash(source));
    }

    private static String nz(JsonNode node) {
        return node.isString() ? node.stringValue() : "";
    }
}
