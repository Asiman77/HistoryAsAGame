package az.tarix.platform.media.internal.service;

import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.identity.api.Role;
import az.tarix.platform.media.api.AssetType;
import az.tarix.platform.media.api.MediaAssetChanged;
import az.tarix.platform.media.internal.domain.FileType;
import az.tarix.platform.media.internal.domain.MediaAsset;
import az.tarix.platform.media.internal.domain.MediaAsset.Description;
import az.tarix.platform.media.internal.domain.MediaAsset.FileFacts;
import az.tarix.platform.media.internal.domain.Origin;
import az.tarix.platform.media.internal.domain.PermissionPolicy;
import az.tarix.platform.media.internal.persistence.MediaAssetRepository;
import az.tarix.platform.media.internal.storage.MediaProperties;
import az.tarix.platform.media.internal.storage.ObjectStorage;
import az.tarix.platform.media.internal.storage.ObjectStorage.ObjectInfo;
import az.tarix.platform.media.internal.storage.ObjectStorage.PresignedUpload;
import az.tarix.platform.shared.domain.LocalizedText;
import az.tarix.platform.shared.domain.PermissionStatus;
import az.tarix.platform.shared.read.ApiImage;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Uploads, registration and licence changes of media (BACKEND_SPEC.md §11, §13; ADR-0017).
 *
 * <p>Uploading is two steps, so file bytes never pass through the backend: the editor asks for
 * a presigned URL ({@link #requestUpload}), puts the file into the bucket, then registers it
 * with its licence ({@link #register}). Registration checks the stored object itself (size,
 * type, first bytes) and deletes it when it is not what was announced.
 */
@Service
public class MediaService {

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);

    /** Object keys of uploads; generated here, never chosen by the client. */
    static final Pattern UPLOAD_KEY = Pattern.compile(
            "^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.([a-z0-9]+)$");

    static final int MAX_LICENSE = 300;
    static final int MAX_TEXT = 1000;

    /** Fields a PATCH may contain (JSON Merge Patch: a field set to null is cleared). */
    static final Set<String> PATCHABLE = Set.of("title", "caption", "license", "sourceUrl", "rightsHolder", "permissionStatus",
            "aiGenerated", "aiDisclosureLabel", "width", "height", "durationMs");

    static final String SEARCH = """
            SELECT id FROM media_asset
            WHERE (CAST(:type AS text) IS NULL OR media_type = CAST(:type AS text))
              AND (CAST(:status AS text) IS NULL OR permission_status = CAST(:status AS text))
              AND (CAST(:origin AS text) IS NULL OR origin = CAST(:origin AS text))
              AND (CAST(:q AS text) IS NULL OR storage_key ILIKE CAST(:q AS text) OR license ILIKE CAST(:q AS text)
                   OR rights_holder ILIKE CAST(:q AS text) OR title->>'az' ILIKE CAST(:q AS text))
            ORDER BY created_at DESC, id
            LIMIT :limit OFFSET :offset""";

    /** A presigned upload as the client needs it. */
    public record Upload(String storageKey, URL url, String method, Map<String, String> headers, Instant expiresAt,
                         long maxSizeBytes) {}

    /** A new file's description, as sent by the editor. JSON fields are LocalizedText objects. */
    public record Registration(String storageKey, JsonNode title, JsonNode caption, String license, String sourceUrl,
                               String rightsHolder, Boolean aiGenerated, JsonNode aiDisclosureLabel, Integer width,
                               Integer height, Integer durationMs) {}

    /** List filter; null fields do not filter. */
    public record Filter(AssetType type, PermissionStatus status, Origin origin, String q, int limit, int offset) {}

    private final MediaAssetRepository assets;
    private final ObjectStorage storage;
    private final MediaProperties props;
    private final JdbcClient jdbc;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    MediaService(MediaAssetRepository assets, ObjectStorage storage, MediaProperties props, JdbcClient jdbc,
                 ApplicationEventPublisher events, Clock clock) {
        this.assets = assets;
        this.storage = storage;
        this.props = props;
        this.jdbc = jdbc;
        this.events = events;
        this.clock = clock;
    }

    /** A presigned {@code PUT} for one file of an allowed type and size. */
    public Upload requestUpload(String mimeType, long sizeBytes) {
        FileType type = FileType.ofMime(mimeType).orElseThrow(() -> MediaException.invalid("unsupported-type",
                "Bu fayl tipi qəbul olunmur. İcazə verilənlər: " + allowedTypes() + "."));
        long max = maxSize(type.assetType());
        if (sizeBytes < 1) throw MediaException.invalid("empty-file", "Fayl boşdur.");
        if (sizeBytes > max) throw MediaException.tooLarge("Fayl çox böyükdür: ən çox " + max + " bayt (" + type.assetType() + ").");
        String key = "uploads/" + UUID.randomUUID() + "." + type.extension();
        PresignedUpload p = storage.presignPut(key, type.mimeType(), props.uploadUrlTtl());
        return new Upload(key, p.url(), "PUT", p.headers(), p.expiresAt(), max);
    }

    /**
     * Registers an uploaded object with its licence. The object must exist, match its type by
     * its first bytes and fit the size limit; otherwise it is deleted and the request refused.
     * The permission status follows from the licence (ADR-0010), never from the request.
     */
    @Transactional
    public MediaAsset register(Registration r, CurrentUser user) {
        String key = r.storageKey() == null ? "" : r.storageKey().strip();
        var m = UPLOAD_KEY.matcher(key);
        if (!m.matches()) throw MediaException.invalid("invalid-storage-key", "storageKey yükləmə cavabındakı açar olmalıdır.");
        FileType type = byExtension(m.group(1));
        if (assets.existsByStorageKey(key)) throw MediaException.conflict("already-registered", "Bu fayl artıq qeydiyyatdadır.");
        Description d = describe(r.title(), r.caption(), r.license(), r.sourceUrl(), r.rightsHolder(),
                Boolean.TRUE.equals(r.aiGenerated()), r.aiDisclosureLabel(), r.width(), r.height(), r.durationMs());

        ObjectInfo info = storage.head(key).orElseThrow(() -> MediaException.invalid("upload-missing",
                "Fayl anbarda tapılmadı: əvvəlcə presigned URL ilə yükləyin."));
        long max = maxSize(type.assetType());
        if (info.size() > max) {
            discard(key, "too large");
            throw MediaException.tooLarge("Fayl çox böyükdür: ən çox " + max + " bayt; fayl silindi.");
        }
        if (info.size() < 1) {
            discard(key, "empty");
            throw MediaException.invalid("empty-file", "Fayl boşdur; silindi.");
        }
        if (!FileType.ofMime(info.contentType()).map(type::equals).orElse(false)) {
            discard(key, "content type " + info.contentType());
            throw MediaException.invalid("content-type-mismatch", "Faylın Content-Type-ı (" + info.contentType()
                    + ") gözlənilən " + type.mimeType() + " deyil; fayl silindi.");
        }
        byte[] checksum = checkContent(key, type, max);

        PermissionStatus status = PermissionPolicy.initial(d.license());
        Instant now = clock.instant();
        MediaAsset asset = assets.save(new MediaAsset(new FileFacts(key, Origin.UPLOAD, type.assetType(), type.mimeType(),
                info.size(), checksum), d, status, user.id(), now));
        log.info("media registered id={} type={} size={} status={}", asset.id(), type, info.size(), status);
        return asset;
    }

    /**
     * Applies a JSON Merge Patch to the description and the permission status, under the
     * {@link PermissionPolicy}. {@code expectedVersion} comes from {@code If-Match}.
     */
    @Transactional
    public MediaAsset update(UUID id, Long expectedVersion, JsonNode patch, CurrentUser user) {
        MediaAsset asset = assets.findById(id).orElseThrow(MediaException::notFound);
        if (expectedVersion == null) throw MediaException.preconditionRequired(asset.version());
        if (expectedVersion != asset.version()) throw MediaException.preconditionFailed(asset.version());
        if (patch == null || !patch.isObject()) throw MediaException.invalid("invalid-patch", "Gövdə JSON obyekt olmalıdır.");
        for (String field : patch.propertyNames()) {
            if (!PATCHABLE.contains(field)) throw MediaException.invalid("unknown-field", "Dəyişdirilə bilməyən sahə: " + field);
        }

        Description old = asset.description();
        Map<String, JsonNode> p = new HashMap<>();
        patch.properties().forEach(e -> p.put(e.getKey(), e.getValue()));
        Description d = describe(
                p.containsKey("title") ? p.get("title") : json(old.title()),
                p.containsKey("caption") ? p.get("caption") : json(old.caption()),
                p.containsKey("license") ? text(p.get("license")) : old.license(),
                p.containsKey("sourceUrl") ? text(p.get("sourceUrl")) : old.sourceUrl(),
                p.containsKey("rightsHolder") ? text(p.get("rightsHolder")) : old.rightsHolder(),
                p.containsKey("aiGenerated") ? p.get("aiGenerated").asBoolean(false) : old.aiGenerated(),
                p.containsKey("aiDisclosureLabel") ? p.get("aiDisclosureLabel") : json(old.aiDisclosureLabel()),
                p.containsKey("width") ? integer(p.get("width"), "width") : old.width(),
                p.containsKey("height") ? integer(p.get("height"), "height") : old.height(),
                p.containsKey("durationMs") ? integer(p.get("durationMs"), "durationMs") : old.durationMs());

        PermissionStatus requested = null;
        if (p.containsKey("permissionStatus")) {
            String s = text(p.get("permissionStatus"));
            try {
                requested = s == null ? null : PermissionStatus.valueOf(s.toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw MediaException.invalid("invalid-permission-status", "permissionStatus: PENDING, GRANTED, NOT_REQUIRED və ya DENIED.");
            }
        }
        boolean termsChanged = !Objects.equals(old.license(), d.license()) || !Objects.equals(old.rightsHolder(), d.rightsHolder())
                || !Objects.equals(old.sourceUrl(), d.sourceUrl());
        PermissionStatus status;
        try {
            status = PermissionPolicy.next(asset.permissionStatus(), requested, d.license(), termsChanged,
                    new PermissionPolicy.Actor(user.hasRole(Role.ADMIN), user.hasRole(Role.REVIEWER)));
        } catch (PermissionPolicy.PolicyViolation e) {
            throw e.forbidden() ? MediaException.forbidden(e.code(), e.getMessage()) : MediaException.conflict(e.code(), e.getMessage());
        }
        if (same(d, old) && status == asset.permissionStatus()) return asset;     // nothing to save, no new version
        PermissionStatus before = asset.permissionStatus();
        asset.update(d, status, clock.instant());
        assets.flush();     // the version in the response must be the new one
        events.publishEvent(new MediaAssetChanged(asset.id()));
        log.info("media updated id={} status={}→{} by={}", asset.id(), before, status, user.id());
        return asset;
    }

    @Transactional(readOnly = true)
    public MediaAsset get(UUID id) {
        return assets.findById(id).orElseThrow(MediaException::notFound);
    }

    @Transactional(readOnly = true)
    public List<MediaAsset> list(Filter f) {
        String q = f.q() == null || f.q().isBlank() ? null : "%" + escapeLike(f.q().strip()) + "%";
        List<UUID> ids = jdbc.sql(SEARCH).param("type", f.type() == null ? null : f.type().name())
                .param("status", f.status() == null ? null : f.status().name())
                .param("origin", f.origin() == null ? null : f.origin().name()).param("q", q)
                .param("limit", f.limit()).param("offset", f.offset()).query(UUID.class).list();
        Map<UUID, MediaAsset> byId = new HashMap<>();
        assets.findAllById(ids).forEach(a -> byId.put(a.id(), a));
        List<MediaAsset> out = new ArrayList<>(ids.size());
        for (UUID id : ids) if (byId.containsKey(id)) out.add(byId.get(id));
        return out;
    }

    /** The public URL of an asset, or null (an upload without a known public base URL). */
    public String url(MediaAsset asset) {
        if (asset.origin() == Origin.LINKED) return asset.storageKey();
        String base = props.objectBaseUrl();
        return base == null ? null : base + "/" + asset.storageKey();
    }

    // --- checks -------------------------------------------------------------------------

    /** Reads the object once: its first bytes must match the type; returns its SHA-256. */
    private byte[] checkContent(String key, FileType type, long max) {
        MessageDigest sha;
        try {
            sha = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        byte[] head = new byte[FileType.HEAD_BYTES];
        int headLength = 0;
        long total = 0;
        try (InputStream in = storage.open(key)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                if (headLength < head.length) {
                    int copy = Math.min(n, head.length - headLength);
                    System.arraycopy(buf, 0, head, headLength, copy);
                    headLength += copy;
                }
                total += n;
                if (total > max) break;
                sha.update(buf, 0, n);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        if (total > max) {
            discard(key, "too large while reading");
            throw MediaException.tooLarge("Fayl çox böyükdür: ən çox " + max + " bayt; fayl silindi.");
        }
        byte[] actualHead = headLength == head.length ? head : java.util.Arrays.copyOf(head, headLength);
        if (!type.matches(actualHead)) {
            discard(key, "signature does not match " + type);
            throw MediaException.invalid("content-mismatch", "Faylın məzmunu " + type.mimeType() + " deyil; fayl silindi.");
        }
        return sha.digest();
    }

    private void discard(String key, String why) {
        log.warn("deleting rejected upload key={} reason={}", key, why);
        storage.delete(key);
    }

    private static FileType byExtension(String ext) {
        for (FileType t : FileType.values()) if (t.extension().equals(ext)) return t;
        throw MediaException.invalid("invalid-storage-key", "storageKey yükləmə cavabındakı açar olmalıdır.");
    }

    private long maxSize(AssetType type) {
        return switch (type) {
            case IMAGE -> props.maxSize().image().toBytes();
            case AUDIO -> props.maxSize().audio().toBytes();
            case GEOJSON -> props.maxSize().geojson().toBytes();
        };
    }

    private static String allowedTypes() {
        List<String> out = new ArrayList<>();
        for (FileType t : FileType.values()) out.add(t.mimeType());
        return String.join(", ", out);
    }

    /** Validates and normalizes an editor's description. */
    static Description describe(JsonNode title, JsonNode caption, String license, String sourceUrl, String rightsHolder,
                                boolean aiGenerated, JsonNode aiLabel, Integer width, Integer height, Integer durationMs) {
        String l = license == null ? null : license.strip();
        if (l == null || l.isEmpty()) throw MediaException.invalid("license-required", "Lisenziya məcburidir (BACKEND_SPEC.md §11).");
        if (l.length() > MAX_LICENSE) throw MediaException.invalid("license-too-long", "Lisenziya " + MAX_LICENSE + " simvoldan uzundur.");
        String src = blankToNull(sourceUrl);
        if (src != null && !isHttpUrl(src)) throw MediaException.invalid("invalid-source-url", "sourceUrl http(s) ünvanı olmalıdır.");
        String holder = blankToNull(rightsHolder);
        if (holder != null && holder.length() > MAX_TEXT) throw MediaException.invalid("rights-holder-too-long", "rightsHolder çox uzundur.");
        String label = localized(aiLabel, "aiDisclosureLabel");
        if (aiGenerated && label == null) label = toJson(ApiImage.AI_DISCLOSURE);
        if (!aiGenerated) label = null;
        positive(width, "width");
        positive(height, "height");
        if (durationMs != null && durationMs < 0) throw MediaException.invalid("invalid-number", "durationMs mənfi ola bilməz.");
        return new Description(localized(title, "title"), localized(caption, "caption"), l, src, holder, aiGenerated, label,
                width, height, durationMs);
    }

    /** Equal descriptions; JSON fields by value (jsonb comes back formatted differently than it was written). */
    static boolean same(Description a, Description b) {
        return sameJson(a.title(), b.title()) && sameJson(a.caption(), b.caption())
                && sameJson(a.aiDisclosureLabel(), b.aiDisclosureLabel())
                && Objects.equals(a.license(), b.license()) && Objects.equals(a.sourceUrl(), b.sourceUrl())
                && Objects.equals(a.rightsHolder(), b.rightsHolder()) && a.aiGenerated() == b.aiGenerated()
                && Objects.equals(a.width(), b.width()) && Objects.equals(a.height(), b.height())
                && Objects.equals(a.durationMs(), b.durationMs());
    }

    private static boolean sameJson(String a, String b) {
        return a == null || b == null ? a == b : json(a).equals(json(b));
    }

    /** LocalizedText as canonical JSON text, or null; the same rules as the database (V003). */
    static String localized(JsonNode node, String field) {
        if (node == null || node.isNull() || node.isMissingNode()) return null;
        if (!node.isObject()) throw MediaException.invalid("invalid-localized-text", field + " {\"az\": \"…\"} obyekti olmalıdır.");
        Map<String, String> values = new LinkedHashMap<>();
        for (var e : node.properties()) {
            if (!e.getValue().isString()) throw MediaException.invalid("invalid-localized-text", field + "." + e.getKey() + " mətn olmalıdır.");
            if (e.getValue().stringValue().length() > MAX_TEXT) throw MediaException.invalid("invalid-localized-text", field + " çox uzundur.");
            values.put(e.getKey(), e.getValue().stringValue());
        }
        try {
            return JsonMapper.shared().writeValueAsString(new LocalizedText(values).values());
        } catch (IllegalArgumentException e) {
            throw MediaException.invalid("invalid-localized-text", field + ": " + e.getMessage());
        }
    }

    private static String toJson(Object value) {
        return value == null ? null : JsonMapper.shared().writeValueAsString(value);
    }

    private static JsonNode json(String text) {
        return text == null ? null : JsonMapper.shared().readTree(text);
    }

    private static String text(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (!node.isString()) throw MediaException.invalid("invalid-field", "Mətn sahəsi gözlənilirdi.");
        return node.stringValue();
    }

    private static Integer integer(JsonNode node, String field) {
        if (node == null || node.isNull()) return null;
        if (!node.isIntegralNumber() || !node.canConvertToInt()) throw MediaException.invalid("invalid-number", field + " tam ədəd olmalıdır.");
        return node.intValue();
    }

    private static void positive(Integer v, String field) {
        if (v != null && v < 1) throw MediaException.invalid("invalid-number", field + " müsbət olmalıdır.");
    }

    private static boolean isHttpUrl(String s) {
        try {
            URI u = URI.create(s);
            return ("http".equals(u.getScheme()) || "https".equals(u.getScheme())) && u.getHost() != null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
