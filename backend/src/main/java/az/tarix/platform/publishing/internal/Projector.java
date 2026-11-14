package az.tarix.platform.publishing.internal;

import az.tarix.platform.editorial.api.PublishedContents;
import az.tarix.platform.publishing.api.ContentProjected;
import az.tarix.platform.shared.content.MissingDependencyException;
import az.tarix.platform.shared.content.ProjectionWriter;
import az.tarix.platform.shared.content.PublishedContent;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Brings the read model in line with the editorial documents (BACKEND_SPEC.md §9, ADR-0012).
 *
 * <p>Projecting a document always writes its <em>current</em> public revision, whatever event
 * triggered it: a late or repeated event projects the same state again, so the order in which
 * events are processed does not matter and retries are harmless. All writers run in one
 * transaction: a failure leaves the old rows in place and the event in the registry.
 */
@Service
public class Projector {

    private static final Logger log = LoggerFactory.getLogger(Projector.class);

    /** Advisory lock namespace: (NAMESPACE, hash of the document id) per document, (NAMESPACE + 1, 0) for rebuilds. */
    static final int LOCK_NAMESPACE = 0x7461;
    static final String LOCK_DOCUMENT = "SELECT pg_advisory_xact_lock(:ns, hashtext(CAST(:doc AS text)))";
    static final String LOCK_ALL_SHARED = "SELECT pg_advisory_xact_lock_shared(:ns, 0)";
    static final String LOCK_ALL_EXCLUSIVE = "SELECT pg_advisory_xact_lock(:ns, 0)";
    static final String NEXT_VERSION = "UPDATE content_version SET value = value + 1 WHERE id = 1 RETURNING value";

    /** What a rebuild did. {@code deferred}: documents whose dependency never appeared (e.g. a theme without its parent). */
    public record RebuildReport(int documents, List<String> deferred, long contentVersion, Duration took) {}

    private final PublishedContents contents;
    private final List<ProjectionWriter> writers;
    private final JdbcClient jdbc;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public Projector(PublishedContents contents, List<ProjectionWriter> writers, JdbcClient jdbc,
                     ApplicationEventPublisher events, Clock clock) {
        this.contents = contents;
        this.writers = List.copyOf(writers);
        this.jdbc = jdbc;
        this.events = events;
        this.clock = clock;
    }

    /** Projects the document's current public revision, or removes its rows when it has none (archived). */
    @Transactional
    public long project(UUID documentId) {
        jdbc.sql(LOCK_ALL_SHARED).param("ns", LOCK_NAMESPACE + 1).query(Object.class).list();
        jdbc.sql(LOCK_DOCUMENT).param("ns", LOCK_NAMESPACE).param("doc", documentId).query(Object.class).list();
        Optional<PublishedContent> content = contents.of(documentId);
        for (ProjectionWriter w : writers) w.delete(documentId);
        content.ifPresent(c -> {
            for (ProjectionWriter w : writers) w.write(c);
        });
        for (ProjectionWriter w : writers) w.afterChanges();
        long version = nextVersion();
        log.info("projected document={} revision={} contentVersion={}", documentId,
                content.map(PublishedContent::revisionNo).orElse(null), version);
        events.publishEvent(new ContentProjected(documentId, version));
        return version;
    }

    /**
     * Rebuilds the whole read model from the public revisions (BACKEND_SPEC.md §4.2). Documents
     * whose dependency is not projected yet are retried in later passes, so the order of
     * documents does not matter.
     */
    @Transactional
    public RebuildReport rebuild() {
        Instant start = clock.instant();
        jdbc.sql(LOCK_ALL_EXCLUSIVE).param("ns", LOCK_NAMESPACE + 1).query(Object.class).list();
        for (ProjectionWriter w : writers) w.deleteAll();
        List<PublishedContent> pending = new ArrayList<>();
        for (UUID id : contents.publishedDocumentIds()) contents.of(id).ifPresent(pending::add);
        int written = 0;
        List<String> deferred = new ArrayList<>();
        while (!pending.isEmpty()) {
            List<PublishedContent> next = new ArrayList<>();
            deferred.clear();
            for (PublishedContent c : pending) {
                try {
                    for (ProjectionWriter w : writers) w.write(c);
                    written++;
                } catch (MissingDependencyException e) {
                    for (ProjectionWriter w : writers) w.delete(c.documentId());
                    next.add(c);
                    deferred.add(c.type() + ":" + c.slug() + " — " + e.getMessage());
                }
            }
            if (next.size() == pending.size()) break;     // no progress: the rest cannot be projected
            pending = next;
        }
        for (ProjectionWriter w : writers) w.afterChanges();
        long version = nextVersion();
        Duration took = Duration.between(start, clock.instant());
        log.info("projection rebuilt documents={} deferred={} contentVersion={} took={}", written, deferred.size(), version, took);
        events.publishEvent(new ContentProjected(null, version));
        return new RebuildReport(written, List.copyOf(deferred), version, took);
    }

    /**
     * Moves the content version on without changing rows: something the public API reads at
     * request time changed (a media licence or permission, ADR-0017). Reported like a rebuild,
     * since any document may use the changed file.
     */
    @Transactional
    public long touch() {
        jdbc.sql(LOCK_ALL_SHARED).param("ns", LOCK_NAMESPACE + 1).query(Object.class).list();
        long version = nextVersion();
        log.info("content version moved on contentVersion={}", version);
        events.publishEvent(new ContentProjected(null, version));
        return version;
    }

    private long nextVersion() {
        return jdbc.sql(NEXT_VERSION).query(Long.class).single();
    }
}
