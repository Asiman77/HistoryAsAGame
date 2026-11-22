package az.tarix.platform.editorial.internal.domain;

import static az.tarix.platform.editorial.api.DocumentStatus.APPROVED;
import static az.tarix.platform.editorial.api.DocumentStatus.ARCHIVED;
import static az.tarix.platform.editorial.api.DocumentStatus.CHANGES_REQUESTED;
import static az.tarix.platform.editorial.api.DocumentStatus.IN_REVIEW;
import static az.tarix.platform.editorial.api.DocumentStatus.PUBLISHED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.identity.api.Role;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The status machine and permission table of BACKEND_SPEC.md §8.1–8.2. */
class WorkflowTests {

    static final Instant NOW = Instant.parse("2026-11-12T10:00:00Z");

    final CurrentUser author = user(Role.AUTHOR);
    final CurrentUser otherAuthor = user(Role.AUTHOR);
    final CurrentUser reviewer = user(Role.REVIEWER);
    final CurrentUser admin = user(Role.ADMIN);
    final CurrentUser teacher = user(Role.TEACHER);

    static CurrentUser user(Role role) {
        return new CurrentUser(UUID.randomUUID(), Set.of(role));
    }

    EditorialDocument draftBy(CurrentUser creator) {
        return new EditorialDocument(DocumentType.PLACE, "tebriz", creator.id(), NOW);
    }

    StatusTransition apply(EditorialDocument doc, Action action, CurrentUser actor, List<UUID> authors) {
        return Workflow.apply(doc, action, actor, action == Action.REQUEST_CHANGES ? "düzəldin" : null, authors, NOW);
    }

    @Test
    void onlyAdminsRenameAndTheLogNamesBothSlugs() {
        EditorialDocument doc = draftBy(author);
        assertThatThrownBy(() -> Workflow.rename(doc, "tabriz", reviewer, NOW)).isInstanceOf(NotPermittedException.class);
        StatusTransition entry = Workflow.rename(doc, "tabriz", admin, NOW);
        assertThat(entry.action()).isEqualTo(Action.RENAME);
        assertThat(entry.comment()).isEqualTo("tebriz → tabriz");
        assertThat(doc.slug()).isEqualTo("tabriz");
        apply(doc, Action.ARCHIVE, admin, List.of());
        assertThatThrownBy(() -> Workflow.rename(doc, "x", admin, NOW)).isInstanceOf(WorkflowViolationException.class);
    }

    @Test
    void reviewersAndAdminsAssignWithoutChangingTheStatus() {
        EditorialDocument doc = draftBy(author);
        apply(doc, Action.SUBMIT, author, List.of(author.id()));
        StatusTransition assigned = Workflow.assign(doc, reviewer.id(), admin, NOW);
        assertThat(assigned.action()).isEqualTo(Action.ASSIGN);
        assertThat(assigned.fromStatus()).isEqualTo(IN_REVIEW);
        assertThat(assigned.toStatus()).isEqualTo(IN_REVIEW);
        assertThat(doc.assigneeId()).isEqualTo(reviewer.id());
        assertThat(Workflow.assign(doc, reviewer.id(), reviewer, NOW)).isNull();          // nothing changed
        assertThat(Workflow.assign(doc, null, reviewer, NOW).comment()).isEqualTo("təyinat götürüldü");
        assertThat(doc.assigneeId()).isNull();
        assertThatThrownBy(() -> Workflow.assign(doc, reviewer.id(), author, NOW)).isInstanceOf(NotPermittedException.class);
        assertThatThrownBy(() -> Workflow.assign(doc, reviewer.id(), teacher, NOW)).isInstanceOf(NotPermittedException.class);
        apply(doc, Action.ARCHIVE, admin, List.of());
        assertThatThrownBy(() -> Workflow.assign(doc, reviewer.id(), admin, NOW)).isInstanceOf(WorkflowViolationException.class);
    }

    @Test
    void happyPathFromDraftToPublished() {
        EditorialDocument doc = draftBy(author);
        List<UUID> authors = List.of(author.id());
        assertThat(apply(doc, Action.SUBMIT, author, authors).toStatus()).isEqualTo(IN_REVIEW);
        assertThat(apply(doc, Action.APPROVE, reviewer, authors).toStatus()).isEqualTo(APPROVED);
        StatusTransition published = apply(doc, Action.PUBLISH, admin, authors);
        assertThat(published.fromStatus()).isEqualTo(APPROVED);
        assertThat(published.toStatus()).isEqualTo(PUBLISHED);
        assertThat(published.actorId()).isEqualTo(admin.id());
        assertThat(doc.status()).isEqualTo(PUBLISHED);
    }

    @Test
    void reviewerCanSendItBackAndTheAuthorResubmits() {
        EditorialDocument doc = draftBy(author);
        apply(doc, Action.SUBMIT, author, List.of(author.id()));
        StatusTransition back = apply(doc, Action.REQUEST_CHANGES, reviewer, List.of(author.id()));
        assertThat(back.toStatus()).isEqualTo(CHANGES_REQUESTED);
        assertThat(back.comment()).isEqualTo("düzəldin");
        assertThat(apply(doc, Action.SUBMIT, author, List.of(author.id())).toStatus()).isEqualTo(IN_REVIEW);
    }

    @Test
    void requestingChangesNeedsAComment() {
        EditorialDocument doc = draftBy(author);
        apply(doc, Action.SUBMIT, author, List.of(author.id()));
        assertThatThrownBy(() -> Workflow.apply(doc, Action.REQUEST_CHANGES, reviewer, " ", List.of(), NOW))
                .isInstanceOf(WorkflowViolationException.class);
    }

    @Test
    void nobodyApprovesTheirOwnWorkNotEvenAnAdmin() {
        EditorialDocument doc = draftBy(reviewer);
        apply(doc, Action.SUBMIT, reviewer, List.of(reviewer.id()));
        assertThatThrownBy(() -> apply(doc, Action.APPROVE, reviewer, List.of(reviewer.id())))
                .isInstanceOf(NotPermittedException.class);

        EditorialDocument mixed = draftBy(author);
        apply(mixed, Action.SUBMIT, author, List.of(author.id(), admin.id()));
        // The admin wrote one of the unpublished revisions: they may not approve either.
        assertThatThrownBy(() -> apply(mixed, Action.APPROVE, admin, List.of(author.id(), admin.id())))
                .isInstanceOf(NotPermittedException.class);
        assertThat(apply(mixed, Action.APPROVE, reviewer, List.of(author.id(), admin.id())).toStatus()).isEqualTo(APPROVED);
    }

    @Test
    void authorsCannotReviewPublishOrArchive() {
        EditorialDocument doc = draftBy(author);
        apply(doc, Action.SUBMIT, author, List.of(author.id()));
        assertThatThrownBy(() -> apply(doc, Action.APPROVE, otherAuthor, List.of(author.id()))).isInstanceOf(NotPermittedException.class);
        assertThatThrownBy(() -> apply(doc, Action.REQUEST_CHANGES, otherAuthor, List.of())).isInstanceOf(NotPermittedException.class);
        apply(doc, Action.APPROVE, reviewer, List.of(author.id()));
        assertThatThrownBy(() -> apply(doc, Action.PUBLISH, reviewer, List.of())).isInstanceOf(NotPermittedException.class);
        assertThatThrownBy(() -> apply(doc, Action.ARCHIVE, reviewer, List.of())).isInstanceOf(NotPermittedException.class);
    }

    @Test
    void authorsOnlyTouchTheirOwnDocuments() {
        EditorialDocument doc = draftBy(author);
        assertThat(Workflow.canEdit(author, doc)).isTrue();
        assertThat(Workflow.canEdit(otherAuthor, doc)).isFalse();
        assertThat(Workflow.canEdit(reviewer, doc)).isTrue();
        assertThat(Workflow.canEdit(admin, doc)).isTrue();
        assertThatThrownBy(() -> apply(doc, Action.SUBMIT, otherAuthor, List.of())).isInstanceOf(NotPermittedException.class);
    }

    @Test
    void teachersHaveNoEditorialAccess() {
        assertThat(Workflow.canRead(teacher)).isFalse();
        assertThatThrownBy(() -> Workflow.requireRead(teacher)).isInstanceOf(NotPermittedException.class);
    }

    @Test
    void transitionsOutOfOrderAreConflicts() {
        EditorialDocument doc = draftBy(author);
        assertThatThrownBy(() -> apply(doc, Action.APPROVE, reviewer, List.of())).isInstanceOf(WorkflowViolationException.class);
        assertThatThrownBy(() -> apply(doc, Action.PUBLISH, admin, List.of())).isInstanceOf(WorkflowViolationException.class);
        apply(doc, Action.SUBMIT, author, List.of());
        assertThatThrownBy(() -> apply(doc, Action.SUBMIT, author, List.of())).isInstanceOf(WorkflowViolationException.class);
    }

    @Test
    void archivedIsTerminal() {
        EditorialDocument doc = draftBy(author);
        assertThat(apply(doc, Action.ARCHIVE, admin, List.of()).toStatus()).isEqualTo(ARCHIVED);
        assertThatThrownBy(() -> apply(doc, Action.SUBMIT, author, List.of())).isInstanceOf(WorkflowViolationException.class);
        assertThatThrownBy(() -> Workflow.requireRevisable(doc, admin)).isInstanceOf(WorkflowViolationException.class);
    }

    @Test
    void apiActionNames() {
        assertThat(Action.fromApi("request_changes")).isEqualTo(Action.REQUEST_CHANGES);
        assertThatThrownBy(() -> Action.fromApi("edit")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Action.fromApi("SUBMIT")).isInstanceOf(IllegalArgumentException.class);
    }
}
