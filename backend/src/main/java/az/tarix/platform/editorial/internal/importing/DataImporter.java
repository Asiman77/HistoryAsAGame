package az.tarix.platform.editorial.internal.importing;

import az.tarix.platform.editorial.api.ContentImported;
import az.tarix.platform.editorial.api.DocumentStatus;
import az.tarix.platform.editorial.internal.content.ContentJson;
import az.tarix.platform.editorial.internal.domain.EditorialDocument;
import az.tarix.platform.editorial.internal.domain.EditorialRevision;
import az.tarix.platform.editorial.internal.domain.StatusTransition;
import az.tarix.platform.editorial.internal.domain.Workflow;
import az.tarix.platform.editorial.internal.importing.DataFolder.Doc;
import az.tarix.platform.editorial.internal.importing.MediaPermissions.MediaItem;
import az.tarix.platform.editorial.internal.persistence.DocumentRepository;
import az.tarix.platform.editorial.internal.persistence.RevisionRepository;
import az.tarix.platform.editorial.internal.persistence.TransitionRepository;
import az.tarix.platform.editorial.internal.validation.DocumentValidator;
import az.tarix.platform.editorial.internal.validation.ValidationIssue;
import az.tarix.platform.editorial.internal.validation.ValidationIssue.Level;
import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.identity.api.SystemAccounts;
import az.tarix.platform.media.api.MediaAssetChanged;
import az.tarix.platform.media.api.MediaRegistry;
import az.tarix.platform.media.api.MediaRegistry.LinkResult;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.PermissionStatus;
import az.tarix.platform.shared.schema.ContentSchemas;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

/**
 * Imports the frontend's {@code data/} folder as editorial documents (BACKEND_SPEC.md §16,
 * ADR-0013). Idempotent: content is compared by hash, so a second run changes nothing.
 *
 * <ol>
 *   <li>Every document is created or gets a new revision (author: the importer system account).
 *       A document someone has edited or is reviewing in the CMS is never overwritten.</li>
 *   <li>The files the data links to are registered in the media registry, with the permission
 *       ADR-0010 gives them; a path registered before is left alone (ADR-0017).</li>
 *   <li>Every imported document is validated, now that all of them exist (references resolve).</li>
 *   <li>Documents without errors are published directly (no review: the data is already public);
 *       the others stay drafts and are listed with their errors.</li>
 *   <li>One {@link ContentImported} event: the read model is rebuilt once.</li>
 * </ol>
 * All of it is one transaction; a dry run rolls it back and reports what would happen.
 */
@Service
public class DataImporter {

    private static final Logger log = LoggerFactory.getLogger(DataImporter.class);
    static final int MAX_ERRORS_PER_DOCUMENT = 5;

    public enum Outcome {
        /** New document. */
        CREATED,
        /** New revision of a document the importer wrote before. */
        UPDATED,
        /** Same content as the current revision. */
        UNCHANGED,
        /** Changed in the data, but edited, under review or renamed in the CMS: left alone. */
        CONFLICT,
        /** Archived in the CMS: left alone. */
        ARCHIVED
    }

    public record DocumentResult(DocumentType type, String slug, Outcome outcome, DocumentStatus status, Integer revisionNo,
                                 List<String> files, List<ValidationIssue> errors) {}

    public record Report(boolean dryRun, Instant startedAt, Duration took, int documents, Map<Outcome, Integer> outcomes,
                         int published, int drafts, List<DocumentResult> results, List<String> sourceProblems,
                         Map<PermissionStatus, Integer> media, List<MediaItem> mediaPending, LinkResult mediaRegistry) {}

    private final ImportProperties props;
    private final DocumentRepository documents;
    private final RevisionRepository revisions;
    private final TransitionRepository transitions;
    private final DocumentValidator validator;
    private final ContentSchemas schemas;
    private final SystemAccounts systemAccounts;
    private final MediaRegistry media;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public DataImporter(ImportProperties props, DocumentRepository documents, RevisionRepository revisions,
                        TransitionRepository transitions, DocumentValidator validator, ContentSchemas schemas,
                        SystemAccounts systemAccounts, MediaRegistry media, ApplicationEventPublisher events, Clock clock) {
        this.props = props;
        this.documents = documents;
        this.revisions = revisions;
        this.transitions = transitions;
        this.validator = validator;
        this.schemas = schemas;
        this.systemAccounts = systemAccounts;
        this.media = media;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public Report run(CurrentUser admin, boolean dryRun) {
        if (props.dataPath() == null) throw new IllegalStateException("platform.import.data-dir təyin olunmayıb");
        Instant start = clock.instant();
        DataFolder.Result folder = DataFolder.read(props.dataPath(), props.builtTerritoriesPath());
        UUID importer = systemAccounts.importer();

        // 1. Documents and revisions.
        List<Map.Entry<Doc, Imported>> imported = new ArrayList<>();
        for (Doc d : folder.documents()) {
            Imported i = upsert(d, importer, admin.id());
            // Order inside its shared file, for the static export (ADR-0019); not a content change.
            if (i.outcome() != Outcome.ARCHIVED) i.doc().placeAt(d.position());
            imported.add(Map.entry(d, i));
        }
        documents.flush();     // the validator's reference lookups use SQL

        // 1b. The files the data links to go into the media registry (ADR-0010, ADR-0017) before
        // validation, which checks permissions there. Registered paths are never overwritten.
        List<MediaItem> files = new ArrayList<>();
        for (Doc d : folder.documents()) files.addAll(MediaPermissions.of(d));
        LinkResult linked = media.registerLinked(files.stream().filter(MediaItem::registrable).map(MediaItem::linked).toList(),
                importer);

        // 2. + 3. Validate and publish.
        int published = 0;
        List<DocumentResult> results = new ArrayList<>();
        for (Map.Entry<Doc, Imported> e : imported) {
            Doc d = e.getKey();
            Imported i = e.getValue();
            List<ValidationIssue> errors = List.of();
            if (i.publishable()) {
                errors = validator.validate(d.type(), d.slug(), d.content()).stream()
                        .filter(v -> v.level() == Level.ERROR).toList();
                boolean alreadyPublic = i.doc().status() == DocumentStatus.PUBLISHED
                        && i.doc().currentRevisionId().equals(i.doc().publishedRevisionId());
                if (errors.isEmpty() && !alreadyPublic) {
                    transitions.save(Workflow.importPublish(i.doc(), admin.id(), clock.instant()));
                    published++;
                }
            }
            results.add(new DocumentResult(d.type(), d.slug(), i.outcome(), i.doc().status(), i.revisionNo(), d.files(),
                    errors.stream().limit(MAX_ERRORS_PER_DOCUMENT).toList()));
        }
        documents.flush();

        // Media permission statuses as the data describes them (ADR-0010).
        Map<PermissionStatus, Integer> mediaStatuses = new EnumMap<>(PermissionStatus.class);
        List<MediaItem> pending = new ArrayList<>();
        for (MediaItem m : files) {
            mediaStatuses.merge(m.status(), 1, Integer::sum);
            if (m.status() == PermissionStatus.PENDING || m.status() == PermissionStatus.DENIED) pending.add(m);
        }

        Map<Outcome, Integer> outcomes = new EnumMap<>(Outcome.class);
        results.forEach(r -> outcomes.merge(r.outcome(), 1, Integer::sum));
        int drafts = (int) results.stream().filter(r -> r.status() != DocumentStatus.PUBLISHED).count();
        Report report = new Report(dryRun, start, Duration.between(start, clock.instant()), results.size(), outcomes,
                published, drafts, results, folder.problems(), mediaStatuses, pending, linked);

        if (dryRun) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        } else if (published > 0) {
            events.publishEvent(new ContentImported(published));     // the rebuild also picks up new media
        } else if (linked.registered() > 0) {
            // Nothing new to publish, but published paths now resolve through the registry.
            events.publishEvent(new MediaAssetChanged(null));
        }
        log.info("data import dryRun={} documents={} outcomes={} published={} drafts={} problems={} mediaRegistered={}", dryRun,
                results.size(), outcomes, published, drafts, folder.problems().size(), linked.registered());
        return report;
    }

    /** What step 1 did to one document. {@code publishable}: the importer owns its current revision. */
    record Imported(EditorialDocument doc, Outcome outcome, Integer revisionNo, boolean publishable) {}

    private Imported upsert(Doc d, UUID importer, UUID actor) {
        Instant now = clock.instant();
        String json = ContentJson.write(d.content());
        byte[] hash = ContentJson.hash(d.content());
        String note = "İdxal: " + String.join(", ", d.files());
        String title = title(d);
        EditorialDocument doc = documents.findByTypeAndSlug(d.type(), d.slug()).orElse(null);
        // Renamed in the CMS: the data still has the old id. Left alone, not created again under the old slug.
        if (doc == null) {
            EditorialDocument renamed = documents.redirectOf(d.type().name(), d.slug())
                    .flatMap(newSlug -> documents.findByTypeAndSlug(d.type(), newSlug)).orElse(null);
            if (renamed != null) {
                Integer no = revisions.findById(renamed.currentRevisionId()).map(EditorialRevision::revisionNo).orElse(null);
                return new Imported(renamed, Outcome.CONFLICT, no, false);
            }
        }
        if (doc == null) {
            doc = documents.save(new EditorialDocument(d.type(), d.slug(), importer, now));
            EditorialRevision rev = revisions.save(new EditorialRevision(doc.id(), 1, schemas.schemaVersion(), json, hash,
                    importer, note, now));
            log(Workflow.importRevision(doc, rev, title, actor, now));
            return new Imported(doc, Outcome.CREATED, 1, true);
        }
        if (doc.status() == DocumentStatus.ARCHIVED) return new Imported(doc, Outcome.ARCHIVED, null, false);
        EditorialRevision current = revisions.findById(doc.currentRevisionId()).orElseThrow();
        boolean ours = current.authorId().equals(importer)
                && (doc.status() == DocumentStatus.DRAFT || doc.status() == DocumentStatus.PUBLISHED);
        if (Arrays.equals(hash, current.contentHash())) {
            return new Imported(doc, Outcome.UNCHANGED, current.revisionNo(), ours);
        }
        if (!ours) return new Imported(doc, Outcome.CONFLICT, current.revisionNo(), false);
        int no = revisions.maxRevisionNo(doc.id()) + 1;
        EditorialRevision rev = revisions.save(new EditorialRevision(doc.id(), no, schemas.schemaVersion(), json, hash,
                importer, note, now));
        log(Workflow.importRevision(doc, rev, title, actor, now));
        return new Imported(doc, Outcome.UPDATED, no, true);
    }

    private void log(StatusTransition entry) {
        if (entry != null) transitions.save(entry);
    }

    private static String title(Doc d) {
        String t = d.type().titlePointer().map(p -> ContentJson.text(d.content(), p)).orElse(null);
        return t == null ? null : t.length() > 500 ? t.substring(0, 500) : t.strip();
    }
}
