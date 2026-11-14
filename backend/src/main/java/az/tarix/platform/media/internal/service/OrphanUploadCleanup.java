package az.tarix.platform.media.internal.service;

import az.tarix.platform.media.internal.persistence.MediaAssetRepository;
import az.tarix.platform.media.internal.storage.MediaProperties;
import az.tarix.platform.media.internal.storage.ObjectStorage;
import az.tarix.platform.media.internal.storage.ObjectStorage.Listed;
import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Deletes uploaded objects that were never registered (the editor abandoned the upload, or
 * registration refused it before deleting failed). Only objects older than
 * {@code platform.media.orphan-ttl} are touched, so an upload in progress is never removed.
 */
@Component
class OrphanUploadCleanup {

    private static final Logger log = LoggerFactory.getLogger(OrphanUploadCleanup.class);

    private final ObjectStorage storage;
    private final MediaAssetRepository assets;
    private final MediaProperties props;
    private final Clock clock;

    OrphanUploadCleanup(ObjectStorage storage, MediaAssetRepository assets, MediaProperties props, Clock clock) {
        this.storage = storage;
        this.assets = assets;
        this.props = props;
        this.clock = clock;
    }

    @Scheduled(cron = "${platform.media.orphan-cleanup-cron:0 30 3 * * *}")
    void scheduled() {
        try {
            run(clock.instant().minus(props.orphanTtl()));
        } catch (RuntimeException e) {
            log.warn("orphan upload cleanup failed; next run tries again", e);
        }
    }

    /** Deletes unregistered uploads last modified before {@code olderThan}; returns how many. */
    int run(Instant olderThan) {
        int[] deleted = {0};
        storage.list("uploads/", page -> {
            List<Listed> old = page.stream().filter(o -> o.lastModified().isBefore(olderThan)).toList();
            if (old.isEmpty()) return;
            Set<String> registered = new HashSet<>();
            assets.findByStorageKeyIn(old.stream().map(Listed::key).toList()).forEach(a -> registered.add(a.storageKey()));
            for (Listed o : old) {
                if (registered.contains(o.key())) continue;
                storage.delete(o.key());
                deleted[0]++;
            }
        });
        if (deleted[0] > 0) log.info("deleted {} unregistered uploads older than {}", deleted[0], olderThan);
        return deleted[0];
    }
}
