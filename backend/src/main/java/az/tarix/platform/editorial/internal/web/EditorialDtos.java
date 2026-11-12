package az.tarix.platform.editorial.internal.web;

import az.tarix.platform.editorial.api.DocumentStatus;
import az.tarix.platform.editorial.api.DocumentType;
import az.tarix.platform.editorial.internal.content.ContentJson;
import az.tarix.platform.editorial.internal.domain.EditorialDocument;
import az.tarix.platform.editorial.internal.domain.EditorialRevision;
import az.tarix.platform.editorial.internal.domain.ReviewComment;
import az.tarix.platform.editorial.internal.domain.StatusTransition;
import az.tarix.platform.editorial.internal.persistence.DocumentQueries.DocumentRow;
import az.tarix.platform.editorial.internal.persistence.RevisionSummary;
import az.tarix.platform.editorial.internal.service.CommentService.CommentView;
import az.tarix.platform.editorial.internal.service.DocumentService.DocumentView;
import az.tarix.platform.editorial.internal.validation.ValidationIssue;
import az.tarix.platform.editorial.internal.validation.ValidationReport;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

/** Request and response bodies of the editorial API. */
final class EditorialDtos {

    private EditorialDtos() {}

    // --- requests -----------------------------------------------------------------------------

    record CreateDocument(@NotNull DocumentType type, @Size(max = 120) String slug, @NotNull JsonNode content,
                          @Size(max = 2000) String changeNote) {}

    record UpdateDocument(@NotNull JsonNode content, @Size(max = 2000) String changeNote) {}

    record TransitionRequest(@NotBlank String action, @Size(max = 10_000) String comment) {}

    record CreateComment(Integer revisionNo, @Size(max = ReviewComment.MAX_PATH) String fieldPath,
                         @NotBlank @Size(max = ReviewComment.MAX_BODY) String body) {}

    record UpdateComment(@Size(max = ReviewComment.MAX_BODY) String body, Boolean resolved) {}

    // --- responses ----------------------------------------------------------------------------

    record DocumentSummary(UUID id, DocumentType type, String slug, String title, DocumentStatus status, long version,
                           Integer revisionNo, Integer publishedRevisionNo, UUID createdBy, Instant createdAt,
                           Instant updatedAt) {

        static DocumentSummary of(DocumentRow r) {
            return new DocumentSummary(r.id(), DocumentType.valueOf(r.docType()), r.slug(), r.title(),
                    DocumentStatus.valueOf(r.status()), r.version(), r.revisionNo(), r.publishedRevisionNo(),
                    r.createdBy(), r.createdAt(), r.updatedAt());
        }
    }

    record RevisionInfo(int revisionNo, int schemaVersion, UUID authorId, String changeNote, Instant createdAt) {

        static RevisionInfo of(EditorialRevision r) {
            return new RevisionInfo(r.revisionNo(), r.schemaVersion(), r.authorId(), r.changeNote(), r.createdAt());
        }

        static RevisionInfo of(RevisionSummary r) {
            return new RevisionInfo(r.revisionNo(), r.schemaVersion(), r.authorId(), r.changeNote(), r.createdAt());
        }
    }

    /**
     * A document and its current revision. {@code publishedRevisionNo} is the public version;
     * when it differs from {@code revision.revisionNo}, the public site still shows the older one.
     */
    record DocumentResponse(UUID id, DocumentType type, String slug, String title, DocumentStatus status, long version,
                            Integer publishedRevisionNo, UUID createdBy, Instant createdAt, Instant updatedAt,
                            RevisionInfo revision, JsonNode content) {

        static DocumentResponse of(DocumentView v) {
            EditorialDocument d = v.document();
            return new DocumentResponse(d.id(), d.type(), d.slug(), d.title(), d.status(), d.version(),
                    v.publishedRevisionNo(), d.createdBy(), d.createdAt(), d.updatedAt(), RevisionInfo.of(v.current()),
                    ContentJson.parse(v.current().content()));
        }
    }

    record RevisionResponse(RevisionInfo revision, JsonNode content) {

        static RevisionResponse of(EditorialRevision r) {
            return new RevisionResponse(RevisionInfo.of(r), ContentJson.parse(r.content()));
        }
    }

    record ValidationResponse(int revisionNo, int schemaVersion, boolean publishable, long errors, long warnings,
                              long infos, List<ValidationIssue> issues) {

        static ValidationResponse of(ValidationReport r) {
            return new ValidationResponse(r.revisionNo(), r.schemaVersion(), r.publishable(),
                    r.count(ValidationIssue.Level.ERROR), r.count(ValidationIssue.Level.WARNING),
                    r.count(ValidationIssue.Level.INFO), r.issues());
        }
    }

    record TransitionResponse(String action, DocumentStatus fromStatus, DocumentStatus toStatus, UUID actorId,
                              String comment, Instant createdAt) {

        static TransitionResponse of(StatusTransition t) {
            return new TransitionResponse(t.action().apiName(), t.fromStatus(), t.toStatus(), t.actorId(), t.comment(),
                    t.createdAt());
        }
    }

    record CommentResponse(UUID id, int revisionNo, String fieldPath, String body, UUID authorId, boolean resolved,
                           UUID resolvedBy, Instant resolvedAt, Instant createdAt, Instant updatedAt) {

        static CommentResponse of(CommentView v) {
            ReviewComment c = v.comment();
            return new CommentResponse(c.id(), v.revisionNo(), c.fieldPath(), c.body(), c.authorId(), c.resolved(),
                    c.resolvedBy(), c.resolvedAt(), c.createdAt(), c.updatedAt());
        }
    }
}
