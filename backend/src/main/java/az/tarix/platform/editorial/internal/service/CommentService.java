package az.tarix.platform.editorial.internal.service;

import az.tarix.platform.editorial.internal.domain.EditorialDocument;
import az.tarix.platform.editorial.internal.domain.NotPermittedException;
import az.tarix.platform.editorial.internal.domain.ReviewComment;
import az.tarix.platform.editorial.internal.domain.Workflow;
import az.tarix.platform.editorial.internal.persistence.CommentRepository;
import az.tarix.platform.editorial.internal.persistence.RevisionRepository;
import az.tarix.platform.editorial.internal.persistence.RevisionSummary;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.NotFound;
import az.tarix.platform.identity.api.CurrentUser;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Review comments on revisions (BACKEND_SPEC.md §11). Every editorial role may comment. */
@Service
public class CommentService {

    /** A comment with the number of the revision it was written on. */
    public record CommentView(ReviewComment comment, int revisionNo) {}

    private final DocumentService documents;
    private final RevisionRepository revisions;
    private final CommentRepository comments;
    private final Clock clock;

    public CommentService(DocumentService documents, RevisionRepository revisions, CommentRepository comments, Clock clock) {
        this.documents = documents;
        this.revisions = revisions;
        this.comments = comments;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<CommentView> list(CurrentUser actor, UUID documentId) {
        Workflow.requireRead(actor);
        EditorialDocument doc = documents.load(documentId);
        Map<UUID, Integer> numbers = revisionNumbers(doc.id());
        return comments.forDocument(doc.id()).stream().map(c -> new CommentView(c, numbers.get(c.revisionId()))).toList();
    }

    /** Adds a comment to revision {@code revisionNo}, or to the current revision when null. */
    @Transactional
    public CommentView add(CurrentUser actor, UUID documentId, Integer revisionNo, String fieldPath, String body) {
        Workflow.requireRead(actor);
        EditorialDocument doc = documents.load(documentId);
        UUID revisionId = revisionNo == null ? doc.currentRevisionId()
                : revisions.findByDocumentIdAndRevisionNo(doc.id(), revisionNo)
                        .orElseThrow(() -> new NotFound("Revision tapılmadı: " + revisionNo)).id();
        ReviewComment comment = comments.saveAndFlush(new ReviewComment(revisionId, fieldPath, body, actor.id(), clock.instant()));
        return new CommentView(comment, revisionNumbers(doc.id()).get(revisionId));
    }

    /**
     * Rewords (author only) and/or resolves a comment. Resolving is allowed to the comment's
     * author and to whoever may edit the document.
     */
    @Transactional
    public CommentView update(CurrentUser actor, UUID documentId, UUID commentId, String body, Boolean resolved) {
        Workflow.requireRead(actor);
        EditorialDocument doc = documents.load(documentId);
        Map<UUID, Integer> numbers = revisionNumbers(doc.id());
        ReviewComment comment = comments.findById(commentId)
                .filter(c -> numbers.containsKey(c.revisionId()))
                .orElseThrow(() -> new NotFound("Şərh tapılmadı: " + commentId));
        if (body != null) comment.edit(body, actor.id(), clock.instant());
        if (resolved != null) {
            if (!comment.authorId().equals(actor.id()) && !Workflow.canEdit(actor, doc)) {
                throw new NotPermittedException("Şərhi yalnız onun müəllifi və ya sənədi redaktə edə bilən həll edə bilər.");
            }
            comment.resolve(resolved, actor.id(), clock.instant());
        }
        return new CommentView(comments.saveAndFlush(comment), numbers.get(comment.revisionId()));
    }

    private Map<UUID, Integer> revisionNumbers(UUID documentId) {
        return revisions.history(documentId).stream().collect(Collectors.toMap(RevisionSummary::id, RevisionSummary::revisionNo));
    }
}
