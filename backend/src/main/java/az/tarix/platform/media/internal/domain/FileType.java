package az.tarix.platform.media.internal.domain;

import az.tarix.platform.media.api.AssetType;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * The file types that may be uploaded (BACKEND_SPEC.md §13: an allowlist, not a blocklist).
 * The declared MIME type must be one of these, and the file's first bytes must match it, so a
 * script renamed to {@code .jpg} is refused. SVG is deliberately missing: it can carry script.
 */
public enum FileType {

    JPEG("image/jpeg", "jpg", AssetType.IMAGE),
    PNG("image/png", "png", AssetType.IMAGE),
    WEBP("image/webp", "webp", AssetType.IMAGE),
    AVIF("image/avif", "avif", AssetType.IMAGE),
    MP3("audio/mpeg", "mp3", AssetType.AUDIO),
    WEBM_AUDIO("audio/webm", "webm", AssetType.AUDIO),
    OGG("audio/ogg", "ogg", AssetType.AUDIO),
    GEOJSON("application/geo+json", "geojson", AssetType.GEOJSON);

    /** How many leading bytes {@link #matches} needs. */
    public static final int HEAD_BYTES = 32;

    private final String mimeType;
    private final String extension;
    private final AssetType assetType;

    FileType(String mimeType, String extension, AssetType assetType) {
        this.mimeType = mimeType;
        this.extension = extension;
        this.assetType = assetType;
    }

    public String mimeType() {
        return mimeType;
    }

    public String extension() {
        return extension;
    }

    public AssetType assetType() {
        return assetType;
    }

    /** The type for a declared MIME type (case and parameters ignored), if it is allowed. */
    public static Optional<FileType> ofMime(String mime) {
        if (mime == null) return Optional.empty();
        String m = mime.split(";", 2)[0].strip().toLowerCase(Locale.ROOT);
        return Arrays.stream(values()).filter(t -> t.mimeType.equals(m)).findFirst();
    }

    /** Whether the file's first bytes are this type's signature. */
    public boolean matches(byte[] head) {
        return switch (this) {
            case JPEG -> startsWith(head, 0, 0xFF, 0xD8, 0xFF);
            case PNG -> startsWith(head, 0, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A);
            case WEBP -> ascii(head, 0, "RIFF") && ascii(head, 8, "WEBP");
            case AVIF -> ascii(head, 4, "ftyp") && (ascii(head, 8, "avif") || ascii(head, 8, "avis"));
            case MP3 -> ascii(head, 0, "ID3") || (head.length > 1 && (head[0] & 0xFF) == 0xFF && (head[1] & 0xE0) == 0xE0);
            case WEBM_AUDIO -> startsWith(head, 0, 0x1A, 0x45, 0xDF, 0xA3);
            case OGG -> ascii(head, 0, "OggS");
            case GEOJSON -> firstJsonChar(head) == '{';
        };
    }

    private static boolean startsWith(byte[] head, int offset, int... expected) {
        if (head.length < offset + expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if ((head[offset + i] & 0xFF) != expected[i]) return false;
        }
        return true;
    }

    private static boolean ascii(byte[] head, int offset, String expected) {
        byte[] e = expected.getBytes(StandardCharsets.US_ASCII);
        if (head.length < offset + e.length) return false;
        return Arrays.equals(head, offset, offset + e.length, e, 0, e.length);
    }

    /** The first character after an optional UTF-8 BOM and whitespace, or -1. */
    private static int firstJsonChar(byte[] head) {
        int i = startsWith(head, 0, 0xEF, 0xBB, 0xBF) ? 3 : 0;
        while (i < head.length && Character.isWhitespace(head[i])) i++;
        return i < head.length ? head[i] : -1;
    }
}
