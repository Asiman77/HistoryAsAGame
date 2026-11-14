package az.tarix.platform.media.internal.service;

import az.tarix.platform.media.api.AssetType;
import az.tarix.platform.media.api.MediaRegistry;
import az.tarix.platform.media.internal.storage.MediaProperties;
import az.tarix.platform.shared.domain.PermissionStatus;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.MediaFiles;
import az.tarix.platform.shared.read.MediaIndex;
import az.tarix.platform.shared.read.MediaIndex.MediaFile;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * The registry for other modules: live lookups and linked-file registration
 * ({@link MediaRegistry}), and the per-version index of the public API ({@link MediaFiles}).
 */
@Component
class JdbcMediaRegistry implements MediaRegistry, MediaFiles {

    static final String ALL = """
            SELECT id, storage_key, origin, permission_status, license, source_url, rights_holder, is_ai_generated,
                   ai_disclosure_label
            FROM media_asset""";

    static final String FIND = """
            SELECT id, storage_key, media_type, permission_status, license, is_ai_generated
            FROM media_asset
            WHERE id IN (:ids) OR (origin = 'LINKED' AND storage_key IN (:keys))""";

    static final String INSERT_LINKED = """
            INSERT INTO media_asset (storage_key, origin, media_type, license, source_url, rights_holder, permission_status,
                                     is_ai_generated, ai_disclosure_label, uploaded_by, created_at, updated_at)
            VALUES (:key, 'LINKED', :type, :license, :sourceUrl, :rightsHolder, :status, :ai, CAST(:label AS jsonb), :by,
                    now(), now())
            ON CONFLICT (storage_key) DO NOTHING""";

    /** Never matches a real id; keeps {@code IN (...)} valid when a list is empty. */
    private static final UUID NO_ID = new UUID(0, 0);

    private record Snapshot(long version, MediaIndex index) {}

    private final JdbcClient jdbc;
    private final String objectBaseUrl;
    private final AtomicReference<Snapshot> snapshot = new AtomicReference<>();

    JdbcMediaRegistry(JdbcClient jdbc, MediaProperties props) {
        this.jdbc = jdbc;
        this.objectBaseUrl = props.objectBaseUrl();
    }

    @Override
    public MediaIndex at(long contentVersion) {
        Snapshot s = snapshot.get();
        if (s != null && s.version() == contentVersion) return s.index();
        MediaIndex index = load();
        // Keep the newest; a request still reading an older version gets a fresh index once.
        snapshot.accumulateAndGet(new Snapshot(contentVersion, index),
                (old, fresh) -> old == null || fresh.version() >= old.version() ? fresh : old);
        return index;
    }

    /** Drops the cached index (tests that change rows without a new content version). */
    void forget() {
        snapshot.set(null);
    }

    private MediaIndex load() {
        Map<String, MediaFile> byRef = new HashMap<>();
        jdbc.sql(ALL).query(rs -> {
            String key = rs.getString("storage_key");
            boolean linked = "LINKED".equals(rs.getString("origin"));
            MediaFile file = new MediaFile(linked ? key : url(key), PermissionStatus.valueOf(rs.getString("permission_status")),
                    rs.getString("license"), rs.getString("rights_holder"), rs.getString("source_url"),
                    rs.getBoolean("is_ai_generated"), JsonColumns.json(rs, "ai_disclosure_label"));
            byRef.put(MediaIndex.REF_PREFIX + rs.getObject("id", UUID.class), file);
            if (linked) byRef.put(key, file);
        });
        return new MediaIndex(byRef);
    }

    /** The public URL of an uploaded object, or null when no public base URL is known. */
    String url(String storageKey) {
        return objectBaseUrl == null ? null : objectBaseUrl + "/" + storageKey;
    }

    @Override
    public Map<String, RegisteredMedia> find(Collection<String> refs) {
        Set<UUID> ids = new HashSet<>();
        Set<String> keys = new HashSet<>();
        for (String ref : refs) {
            if (ref == null) continue;
            if (MediaIndex.isRegistryRef(ref)) {
                UUID id = parseId(ref.substring(MediaIndex.REF_PREFIX.length()));
                if (id != null) ids.add(id);
            } else {
                keys.add(ref);
            }
        }
        if (ids.isEmpty() && keys.isEmpty()) return Map.of();
        if (ids.isEmpty()) ids.add(NO_ID);
        if (keys.isEmpty()) keys.add("");
        Map<String, RegisteredMedia> out = new HashMap<>();
        jdbc.sql(FIND).param("ids", ids).param("keys", keys).query((rs, n) -> {
            UUID id = rs.getObject("id", UUID.class);
            RegisteredMedia m = new RegisteredMedia(id, rs.getString("storage_key"), AssetType.valueOf(rs.getString("media_type")),
                    PermissionStatus.valueOf(rs.getString("permission_status")), rs.getString("license"),
                    rs.getBoolean("is_ai_generated"));
            String byId = MediaIndex.REF_PREFIX + id;
            if (refs.contains(byId)) out.put(byId, m);
            if (refs.contains(m.storageKey())) out.put(m.storageKey(), m);
            return m;
        }).list();
        return out;
    }

    @Override
    public LinkResult registerLinked(List<LinkedFile> files, UUID registeredBy) {
        int registered = 0;
        Set<String> seen = new HashSet<>();
        List<LinkedFile> unique = new ArrayList<>();
        for (LinkedFile f : files) if (seen.add(f.path())) unique.add(f);
        for (LinkedFile f : unique) {
            registered += jdbc.sql(INSERT_LINKED).param("key", f.path()).param("type", f.type().name())
                    .param("license", f.license()).param("sourceUrl", f.sourceUrl()).param("rightsHolder", f.rightsHolder())
                    .param("status", f.status().name()).param("ai", f.aiGenerated())
                    .param("label", f.aiDisclosure() == null ? null : f.aiDisclosure().toString())
                    .param("by", registeredBy).update();
        }
        return new LinkResult(registered, unique.size() - registered);
    }

    private static UUID parseId(String s) {
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
