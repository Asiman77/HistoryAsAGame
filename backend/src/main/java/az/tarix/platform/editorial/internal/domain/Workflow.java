package az.tarix.platform.editorial.internal.domain;

import static az.tarix.platform.editorial.api.DocumentStatus.APPROVED;
import static az.tarix.platform.editorial.api.DocumentStatus.ARCHIVED;
import static az.tarix.platform.editorial.api.DocumentStatus.CHANGES_REQUESTED;
import static az.tarix.platform.editorial.api.DocumentStatus.DRAFT;
import static az.tarix.platform.editorial.api.DocumentStatus.IN_REVIEW;
import static az.tarix.platform.editorial.api.DocumentStatus.PUBLISHED;

import az.tarix.platform.editorial.api.DocumentStatus;
import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.identity.api.Role;
import java.time.Instant;
import java.util.Collection;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * The status machine and the permission table of BACKEND_SPEC.md §8.1–8.2, in one place.
 *
 * <pre>
 * DRAFT ─submit─► IN_REVIEW ─approve─► APPROVED ─publish─► PUBLISHED
 *   ▲  ◄─submit─┐     │ request_changes
 *   │           └ CHANGES_REQUESTED
 *   └── any new revision (edit, revert) of a non-draft document; the published revision stays public
 * any status except ARCHIVED ─archive─► ARCHIVED (ADMIN; terminal)
 * </pre>
 *
 * Every change returns a {@link StatusTransition} for the audit log. Nobody approves their
 * own work: the approver must not have written any revision since the last published one.
 */
public final class Workflow {

    private Workflow() {}

    // --- permissions -------------------------------------------------------------------------

    /** Anyone with an editorial role may read documents, revisions, reports and comments. */
    public static boolean canRead(CurrentUser user) {
        return user.hasAnyRole(Role.AUTHOR, Role.REVIEWER, Role.ADMIN);
    }

    /** AUTHOR: only documents they created; REVIEWER and ADMIN: any document. */
    public static boolean canEdit(CurrentUser user, EditorialDocument doc) {
        if (user.hasAnyRole(Role.REVIEWER, Role.ADMIN)) return true;
        return user.hasRole(Role.AUTHOR) && doc.createdBy().equals(user.id());
    }

    public static void requireRead(CurrentUser user) {
        if (!canRead(user)) throw new NotPermittedException("Redaksiya rolu tələb olunur.");
    }

    public static void requireEdit(CurrentUser user, EditorialDocument doc) {
        if (!canEdit(user, doc)) throw new NotPermittedException("Müəllif yalnız öz sənədlərini redaktə edə bilər.");
    }

    // --- revisions ---------------------------------------------------------------------------

    /** Whether {@code actor} may add a revision now; check before writing one. */
    public static void requireRevisable(EditorialDocument doc, CurrentUser actor) {
        if (doc.status() == ARCHIVED) throw new WorkflowViolationException("archived", "Arxivlənmiş sənəd dəyişdirilə bilməz.");
        requireEdit(actor, doc);
    }

    /**
     * Makes {@code revision} the current one. A document that was in review, approved,
     * returned or published goes back to DRAFT: whatever was reviewed is no longer what is
     * there. The public version (if any) is untouched until the next publish.
     *
     * @return the log entry, or null when the document was already a draft
     */
    public static StatusTransition revise(EditorialDocument doc, EditorialRevision revision, String title,
                                          CurrentUser actor, Instant now) {
        requireRevisable(doc, actor);
        boolean first = doc.currentRevisionId() == null;
        DocumentStatus from = doc.status();
        doc.revisionAdded(revision, title, now);
        if (first) return new StatusTransition(doc.id(), revision.id(), Action.CREATE, null, DRAFT, actor.id(), null, now);
        if (from == DRAFT) return null;
        doc.moveTo(DRAFT, now);
        return new StatusTransition(doc.id(), revision.id(), Action.EDIT, from, DRAFT, actor.id(),
                revision.changeNote(), now);
    }

    // --- data import (ADR-0013) ---------------------------------------------------------------

    /**
     * Makes an imported revision current. The importer is a system account without roles, so
     * the permission checks of {@link #revise} do not apply; the caller (an ADMIN-only
     * endpoint) is recorded as the actor. Same status rules as {@link #revise}.
     */
    public static StatusTransition importRevision(EditorialDocument doc, EditorialRevision revision, String title,
                                                  UUID actorId, Instant now) {
        if (doc.status() == ARCHIVED) throw new WorkflowViolationException("archived", "Arxivlənmiş sənəd dəyişdirilə bilməz.");
        boolean first = doc.currentRevisionId() == null;
        DocumentStatus from = doc.status();
        doc.revisionAdded(revision, title, now);
        if (first) return new StatusTransition(doc.id(), revision.id(), Action.CREATE, null, DRAFT, actorId, revision.changeNote(), now);
        if (from == DRAFT) return null;
        doc.moveTo(DRAFT, now);
        return new StatusTransition(doc.id(), revision.id(), Action.EDIT, from, DRAFT, actorId, revision.changeNote(), now);
    }

    /** Publishes the current revision of an imported document without review; logged as {@code import}. */
    public static StatusTransition importPublish(EditorialDocument doc, UUID actorId, Instant now) {
        if (doc.status() == ARCHIVED) throw new WorkflowViolationException("archived", "Arxivlənmiş sənəd dərc oluna bilməz.");
        DocumentStatus from = doc.status();
        doc.markPublished(doc.currentRevisionId(), now);
        return new StatusTransition(doc.id(), doc.currentRevisionId(), Action.IMPORT, from, PUBLISHED, actorId,
                "data/ idxalı (rəysiz)", now);
    }

    // --- transitions -------------------------------------------------------------------------

    /**
     * Applies a workflow action.
     *
     * @param authorsSincePublished authors of every revision after the published one (all
     *                              revisions if never published); none of them may approve
     */
    public static StatusTransition apply(EditorialDocument doc, Action action, CurrentUser actor, String comment,
                                         Collection<UUID> authorsSincePublished, Instant now) {
        DocumentStatus from = doc.status();
        if (from == ARCHIVED) throw new WorkflowViolationException("archived", "Arxivlənmiş sənəd üzərində əməliyyat aparılmır.");
        DocumentStatus to = switch (action) {
            case SUBMIT -> {
                requireEdit(actor, doc);
                requireFrom(action, from, Set.of(DRAFT, CHANGES_REQUESTED));
                yield IN_REVIEW;
            }
            case REQUEST_CHANGES -> {
                requireRole(actor, "Dəyişiklik tələbi yalnız rəyçi və ya admin üçündür.", Role.REVIEWER, Role.ADMIN);
                requireFrom(action, from, Set.of(IN_REVIEW));
                if (comment == null || comment.isBlank()) {
                    throw new WorkflowViolationException("comment-required", "Dəyişiklik tələb edərkən şərh yazılmalıdır.");
                }
                yield CHANGES_REQUESTED;
            }
            case APPROVE -> {
                requireRole(actor, "Təsdiq yalnız rəyçi və ya admin üçündür.", Role.REVIEWER, Role.ADMIN);
                requireFrom(action, from, Set.of(IN_REVIEW));
                if (authorsSincePublished.contains(actor.id())) {
                    throw new NotPermittedException("Heç kim öz yazdığı revision-ı təsdiqləyə bilməz.");
                }
                yield APPROVED;
            }
            case PUBLISH -> {
                requireRole(actor, "Dərc yalnız admin üçündür.", Role.ADMIN);
                requireFrom(action, from, Set.of(APPROVED));
                yield PUBLISHED;
            }
            case ARCHIVE -> {
                requireRole(actor, "Arxivləmə yalnız admin üçündür.", Role.ADMIN);
                yield ARCHIVED;
            }
            case CREATE, EDIT, IMPORT, ASSIGN, RENAME -> throw new IllegalArgumentException(action + " is not a workflow action");
        };
        if (to == PUBLISHED) doc.markPublished(doc.currentRevisionId(), now);
        else doc.moveTo(to, now);
        return new StatusTransition(doc.id(), doc.currentRevisionId(), action, from, to, actor.id(), blankToNull(comment), now);
    }

    // --- review assignment ---------------------------------------------------------------------

    /**
     * Assigns the document to a reviewer (or takes the assignment away with null). Reviewers and
     * admins assign; whether the assignee may review is checked by the caller, which knows the
     * accounts. The status does not change.
     *
     * @return the log entry, or null when nothing changed
     */
    public static StatusTransition assign(EditorialDocument doc, UUID assignee, CurrentUser actor, Instant now) {
        requireRole(actor, "Rəyçi təyinatı yalnız rəyçi və ya admin üçündür.", Role.REVIEWER, Role.ADMIN);
        if (doc.status() == ARCHIVED) throw new WorkflowViolationException("archived", "Arxivlənmiş sənəd dəyişdirilə bilməz.");
        if (Objects.equals(doc.assigneeId(), assignee)) return null;
        doc.assignTo(assignee, now);
        return new StatusTransition(doc.id(), doc.currentRevisionId(), Action.ASSIGN, doc.status(), doc.status(), actor.id(),
                assignee == null ? "təyinat götürüldü" : "təyin olundu: " + assignee, now);
    }

    // --- rename --------------------------------------------------------------------------------

    /**
     * Changes the slug (BACKEND_SPEC.md §5.5: after publishing only with a redirect, which the
     * caller writes). Admins only; the content's id follows in a new revision added by the caller.
     */
    public static StatusTransition rename(EditorialDocument doc, String newSlug, CurrentUser actor, Instant now) {
        requireRole(actor, "Slug-ı yalnız admin dəyişə bilər.", Role.ADMIN);
        if (doc.status() == ARCHIVED) throw new WorkflowViolationException("archived", "Arxivlənmiş sənəd dəyişdirilə bilməz.");
        String old = doc.slug();
        doc.renameTo(newSlug, now);
        return new StatusTransition(doc.id(), doc.currentRevisionId(), Action.RENAME, doc.status(), doc.status(), actor.id(),
                old + " → " + newSlug, now);
    }

    private static void requireFrom(Action action, DocumentStatus from, Set<DocumentStatus> allowed) {
        if (!allowed.contains(from)) {
            throw new WorkflowViolationException("invalid-transition",
                    "'%s' əməliyyatı %s statusunda mümkün deyil.".formatted(action.apiName(), from));
        }
    }

    private static void requireRole(CurrentUser actor, String message, Role... roles) {
        if (!actor.hasAnyRole(roles)) throw new NotPermittedException(message);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
