package az.tarix.platform.editorial.internal.service;

import az.tarix.platform.editorial.api.ContentArchived;
import az.tarix.platform.editorial.api.ContentPublished;
import az.tarix.platform.editorial.api.DocumentType;
import az.tarix.platform.editorial.internal.content.ContentJson;
import az.tarix.platform.editorial.internal.content.JsonPatch;
import az.tarix.platform.editorial.internal.domain.Action;
import az.tarix.platform.editorial.internal.domain.EditorialDocument;
import az.tarix.platform.editorial.internal.domain.EditorialRevision;
import az.tarix.platform.editorial.internal.domain.StatusTransition;
import az.tarix.platform.editorial.internal.domain.Workflow;
import az.tarix.platform.editorial.internal.domain.WorkflowViolationException;
import az.tarix.platform.editorial.internal.persistence.DocumentQueries;
import az.tarix.platform.editorial.internal.persistence.DocumentQueries.DocumentRow;
import az.tarix.platform.editorial.internal.persistence.DocumentRepository;
import az.tarix.platform.editorial.internal.persistence.RevisionRepository;
import az.tarix.platform.editorial.internal.persistence.RevisionSummary;
import az.tarix.platform.editorial.internal.persistence.TransitionRepository;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.ContentTooLarge;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.NotFound;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.PreconditionFailed;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.PublishBlocked;
import az.tarix.platform.editorial.internal.validation.DocumentValidator;
import az.tarix.platform.editorial.internal.validation.ValidationReport;
import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.shared.domain.Slugs;
import az.tarix.platform.shared.schema.ContentSchemas;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;

/**
 * Documents and their revisions: create, edit (always a new revision), revert, history, diff,
 * the validation report and workflow transitions (BACKEND_SPEC.md §8, §11).
 */
@Service
public class DocumentService {

    /** Largest accepted content, as JSON text. Built territory snapshots are the biggest (≈ 30 KB today). */
    public static final int MAX_CONTENT_CHARS = 5 * 1024 * 1024;
    static final int MAX_TITLE = 500;
    static final int MAX_NOTE = 2_000;

    static final String REDIRECTED = "SELECT count(*) > 0 FROM slug_redirect WHERE doc_type = :type AND old_slug = :slug";

    /** A document with its current revision. */
    public record DocumentView(EditorialDocument document, EditorialRevision current, Integer publishedRevisionNo) {}

    private final DocumentRepository documents;
    private final RevisionRepository revisions;
    private final TransitionRepository transitions;
    private final DocumentQueries queries;
    private final DocumentValidator validator;
    private final ContentSchemas schemas;
    private final ApplicationEventPublisher events;
    private final JdbcClient jdbc;
    private final Clock clock;

    public DocumentService(DocumentRepository documents, RevisionRepository revisions, TransitionRepository transitions,
                           DocumentQueries queries, DocumentValidator validator, ContentSchemas schemas,
                           ApplicationEventPublisher events, JdbcClient jdbc, Clock clock) {
        this.documents = documents;
        this.revisions = revisions;
        this.transitions = transitions;
        this.queries = queries;
        this.validator = validator;
        this.schemas = schemas;
        this.events = events;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    // --- reading ------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DocumentRow> list(CurrentUser actor, DocumentQueries.Filter filter) {
        Workflow.requireRead(actor);
        return queries.list(filter);
    }

    @Transactional(readOnly = true)
    public DocumentView get(CurrentUser actor, UUID id) {
        Workflow.requireRead(actor);
        return view(load(id));
    }

    @Transactional(readOnly = true)
    public List<RevisionSummary> history(CurrentUser actor, UUID id) {
        Workflow.requireRead(actor);
        return revisions.history(load(id).id());
    }

    @Transactional(readOnly = true)
    public EditorialRevision revision(CurrentUser actor, UUID id, int revisionNo) {
        Workflow.requireRead(actor);
        return revisionOf(load(id), revisionNo);
    }

    @Transactional(readOnly = true)
    public List<StatusTransition> transitions(CurrentUser actor, UUID id) {
        Workflow.requireRead(actor);
        return transitions.forDocument(load(id).id());
    }

    /** RFC 6902 patch that turns revision {@code from} into revision {@code to}. */
    @Transactional(readOnly = true)
    public ArrayNode diff(CurrentUser actor, UUID id, int from, int to) {
        Workflow.requireRead(actor);
        EditorialDocument doc = load(id);
        return JsonPatch.diff(ContentJson.parse(revisionOf(doc, from).content()), ContentJson.parse(revisionOf(doc, to).content()));
    }

    /** The pre-publish report for a revision (the current one when {@code revisionNo} is null). */
    @Transactional(readOnly = true)
    public ValidationReport validate(CurrentUser actor, UUID id, Integer revisionNo) {
        Workflow.requireRead(actor);
        EditorialDocument doc = load(id);
        EditorialRevision rev = revisionNo == null ? current(doc) : revisionOf(doc, revisionNo);
        return report(doc, rev);
    }

    // --- writing ------------------------------------------------------------------------------

    @Transactional
    public DocumentView create(CurrentUser actor, DocumentType type, String slug, JsonNode content, String changeNote) {
        Workflow.requireRead(actor);
        String json = checkContent(content);
        if (slug == null || slug.isBlank()) {
            slug = type.idPointer().map(p -> ContentJson.text(content, p)).orElse(null);
            if (slug == null) throw new IllegalArgumentException("slug göstərilməyib və kontentdə id yoxdur.");
        }
        if (!Slugs.isValid(slug)) throw new IllegalArgumentException("Etibarsız slug: " + slug);
        if (documents.existsByTypeAndSlug(type, slug)) {
            throw new WorkflowViolationException("duplicate-slug", "%s tipində '%s' slug-ı artıq var.".formatted(type, slug));
        }
        if (jdbc.sql(REDIRECTED).param("type", type.name()).param("slug", slug).query(Boolean.class).single()) {
            throw new WorkflowViolationException("slug-redirected",
                    "'%s' köhnə slug kimi yönləndirilir; başqa slug seçin.".formatted(slug));
        }
        Instant now = clock.instant();
        EditorialDocument doc = documents.save(new EditorialDocument(type, slug, actor.id(), now));
        EditorialRevision rev = revisions.save(new EditorialRevision(doc.id(), 1, schemas.schemaVersion(), json,
                ContentJson.hash(content), actor.id(), note(changeNote), now));
        log(Workflow.revise(doc, rev, title(type, content), actor, now));
        return view(documents.saveAndFlush(doc), rev);
    }

    /** {@code PUT}: a new revision. Unchanged content adds nothing and returns the document as it is. */
    @Transactional
    public DocumentView update(CurrentUser actor, UUID id, Long expectedVersion, JsonNode content, String changeNote) {
        Workflow.requireRead(actor);
        EditorialDocument doc = load(id);
        requireVersion(doc, expectedVersion, true);
        Workflow.requireRevisable(doc, actor);
        String json = checkContent(content);
        byte[] hash = ContentJson.hash(content);
        EditorialRevision current = current(doc);
        if (Arrays.equals(hash, current.contentHash())) return view(doc, current);
        return addRevision(doc, actor, json, hash, content, note(changeNote));
    }

    /** A new revision with the content of revision {@code to}; history is never rewritten. */
    @Transactional
    public DocumentView revert(CurrentUser actor, UUID id, Long expectedVersion, int to) {
        Workflow.requireRead(actor);
        EditorialDocument doc = load(id);
        requireVersion(doc, expectedVersion, false);
        Workflow.requireRevisable(doc, actor);
        EditorialRevision target = revisionOf(doc, to);
        EditorialRevision current = current(doc);
        if (target.id().equals(current.id())) return view(doc, current);
        JsonNode content = ContentJson.parse(target.content());
        return addRevision(doc, actor, target.content(), target.contentHash(), content, "Revision %d-ə qayıdış".formatted(to));
    }

    @Transactional
    public DocumentView transition(CurrentUser actor, UUID id, Long expectedVersion, Action action, String comment) {
        Workflow.requireRead(actor);
        EditorialDocument doc = load(id);
        requireVersion(doc, expectedVersion, false);
        boolean wasPublished = doc.publishedRevisionId() != null;
        int publishedNo = wasPublished ? revisions.findById(doc.publishedRevisionId()).map(EditorialRevision::revisionNo).orElse(0) : 0;
        List<UUID> authors = revisions.authorsAfter(doc.id(), publishedNo);
        Instant now = clock.instant();
        StatusTransition entry = Workflow.apply(doc, action, actor, comment, authors, now);
        EditorialRevision current = current(doc);
        if (action == Action.PUBLISH) {
            ValidationReport report = report(doc, current);
            if (!report.publishable()) throw new PublishBlocked(report);
        }
        log(entry);
        documents.saveAndFlush(doc);
        if (action == Action.PUBLISH) {
            events.publishEvent(new ContentPublished(doc.id(), doc.type(), doc.slug(), current.id(), current.revisionNo()));
        } else if (action == Action.ARCHIVE) {
            events.publishEvent(new ContentArchived(doc.id(), doc.type(), doc.slug(), wasPublished));
        }
        return view(doc, current);
    }

    // --- helpers ------------------------------------------------------------------------------

    private DocumentView addRevision(EditorialDocument doc, CurrentUser actor, String json, byte[] hash, JsonNode content,
                                     String changeNote) {
        Instant now = clock.instant();
        int no = revisions.maxRevisionNo(doc.id()) + 1;
        EditorialRevision rev = revisions.save(new EditorialRevision(doc.id(), no, schemas.schemaVersion(), json, hash,
                actor.id(), changeNote, now));
        log(Workflow.revise(doc, rev, title(doc.type(), content), actor, now));
        return view(documents.saveAndFlush(doc), rev);
    }

    private ValidationReport report(EditorialDocument doc, EditorialRevision rev) {
        return new ValidationReport(rev.revisionNo(), rev.schemaVersion(),
                validator.validate(doc.type(), doc.slug(), ContentJson.parse(rev.content())));
    }

    private void log(StatusTransition entry) {
        if (entry != null) transitions.save(entry);
    }

    EditorialDocument load(UUID id) {
        return documents.findById(id).orElseThrow(() -> new NotFound("Sənəd tapılmadı: " + id));
    }

    private EditorialRevision current(EditorialDocument doc) {
        return revisions.findById(doc.currentRevisionId()).orElseThrow(() -> new IllegalStateException("current revision missing"));
    }

    private EditorialRevision revisionOf(EditorialDocument doc, int no) {
        return revisions.findByDocumentIdAndRevisionNo(doc.id(), no)
                .orElseThrow(() -> new NotFound("Revision tapılmadı: " + no));
    }

    private DocumentView view(EditorialDocument doc) {
        return view(doc, current(doc));
    }

    private DocumentView view(EditorialDocument doc, EditorialRevision current) {
        Integer publishedNo = doc.publishedRevisionId() == null ? null
                : doc.publishedRevisionId().equals(current.id()) ? current.revisionNo()
                : revisions.findById(doc.publishedRevisionId()).map(EditorialRevision::revisionNo).orElse(null);
        return new DocumentView(doc, current, publishedNo);
    }

    /**
     * Optimistic locking (BACKEND_SPEC.md §11): {@code If-Match} must name the version the
     * client read. Mandatory for edits, optional (checked when given) for other writes.
     */
    private static void requireVersion(EditorialDocument doc, Long expected, boolean mandatory) {
        if (expected == null) {
            if (mandatory) throw new PreconditionFailed(true, doc.version(), "If-Match başlığı (sənədin versiyası) tələb olunur.");
            return;
        }
        if (expected != doc.version()) {
            throw new PreconditionFailed(false, doc.version(),
                    "Sənəd siz oxuyandan sonra dəyişib (versiya %d, sizdəki %d).".formatted(doc.version(), expected));
        }
    }

    private static String checkContent(JsonNode content) {
        if (content == null || !content.isObject()) throw new IllegalArgumentException("content JSON obyekti olmalıdır.");
        String json = ContentJson.write(content);
        if (json.length() > MAX_CONTENT_CHARS) {
            throw new ContentTooLarge("Kontent %d simvoldan böyükdür.".formatted(MAX_CONTENT_CHARS));
        }
        return json;
    }

    private static String title(DocumentType type, JsonNode content) {
        String title = type.titlePointer().map(p -> ContentJson.text(content, p)).orElse(null);
        if (title == null || title.isBlank()) return null;
        title = title.strip();
        return title.length() > MAX_TITLE ? title.substring(0, MAX_TITLE) : title;
    }

    private static String note(String changeNote) {
        if (changeNote == null || changeNote.isBlank()) return null;
        if (changeNote.length() > MAX_NOTE) throw new IllegalArgumentException("changeNote " + MAX_NOTE + " simvoldan uzundur.");
        return changeNote.strip();
    }
}
