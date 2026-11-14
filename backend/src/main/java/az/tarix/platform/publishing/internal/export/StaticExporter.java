package az.tarix.platform.publishing.internal.export;

import az.tarix.platform.editorial.api.PublishedContents;
import az.tarix.platform.media.api.PublicContentStore;
import az.tarix.platform.shared.read.ContentVersion;
import az.tarix.platform.shared.read.MediaFiles;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes the static export (BACKEND_SPEC.md §15, ADR-0019): every file under
 * {@code v<contentVersion>/}, then {@code latest.json} pointing at it. Versioned files never
 * change and are cached for a year; only the manifest is revalidated. The manifest is written
 * last, so a reader never sees a half-written version.
 */
@Service
public class StaticExporter {

    private static final Logger log = LoggerFactory.getLogger(StaticExporter.class);

    static final String MANIFEST = "latest.json";
    static final String IMMUTABLE = "public, max-age=31536000, immutable";
    static final String REVALIDATE = "no-cache";

    /** What the manifest says. {@code files}: paths relative to {@code prefix}. */
    public record Manifest(long contentVersion, String prefix, Instant generatedAt, int fileCount, List<String> files) {}

    public record Report(long contentVersion, int files, long bytes, Duration took) {}

    private final PublishedContents contents;
    private final MediaFiles media;
    private final ContentVersion contentVersion;
    private final PublicContentStore store;
    private final Clock clock;

    StaticExporter(PublishedContents contents, MediaFiles media, ContentVersion contentVersion, PublicContentStore store, Clock clock) {
        this.contents = contents;
        this.media = media;
        this.contentVersion = contentVersion;
        this.store = store;
        this.clock = clock;
    }

    /** The export as files, without writing anything (also what the tests check). */
    @Transactional(readOnly = true)
    public Snapshot build() {
        long version = contentVersion.current();
        return new Snapshot(version, ExportLayout.build(contents.allPublished(), media.at(version)));
    }

    public record Snapshot(long contentVersion, Map<String, JsonNode> files) {}

    /** Builds and writes the current version. */
    public synchronized Report export() {
        Instant start = clock.instant();
        Snapshot s = build();
        String prefix = "v" + s.contentVersion() + "/";
        long bytes = 0;
        List<String> paths = new ArrayList<>(s.files().keySet());
        for (Map.Entry<String, JsonNode> f : s.files().entrySet()) {
            byte[] body = JsonMapper.shared().writeValueAsBytes(f.getValue());
            store.put(prefix + f.getKey(), body, "application/json", IMMUTABLE);
            bytes += body.length;
        }
        Manifest m = new Manifest(s.contentVersion(), prefix, clock.instant(), paths.size(), paths);
        store.put(MANIFEST, JsonMapper.shared().writeValueAsBytes(m), "application/json", REVALIDATE);
        Duration took = Duration.between(start, clock.instant());
        log.info("static export written contentVersion={} files={} bytes={} took={}", s.contentVersion(), paths.size(), bytes, took);
        return new Report(s.contentVersion(), paths.size(), bytes, took);
    }

    /** The content version of the last written export, or -1 when there is none or it cannot be read. */
    public long exportedVersion() {
        try {
            byte[] manifest = store.get(MANIFEST);
            if (manifest == null) return -1;
            return JsonMapper.shared().readTree(new String(manifest, StandardCharsets.UTF_8)).path("contentVersion").asLong(-1);
        } catch (RuntimeException e) {
            log.warn("could not read the export manifest", e);
            return -1;
        }
    }

    public long currentVersion() {
        return contentVersion.current();
    }
}
