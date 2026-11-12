package az.tarix.platform.editorial.internal.domain;

import az.tarix.platform.editorial.api.DocumentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.UuidGenerator;

/** One line of the audit trail: who moved which document from where to where, and why. */
@Entity
@Immutable
@Table(name = "status_transition_log")
public class StatusTransition {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "revision_id")
    private UUID revisionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Action action;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status")
    private DocumentStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false)
    private DocumentStatus toStatus;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    private String comment;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected StatusTransition() {}

    StatusTransition(UUID documentId, UUID revisionId, Action action, DocumentStatus from, DocumentStatus to,
                     UUID actorId, String comment, Instant now) {
        this.documentId = documentId;
        this.revisionId = revisionId;
        this.action = action;
        this.fromStatus = from;
        this.toStatus = to;
        this.actorId = actorId;
        this.comment = comment;
        this.createdAt = now;
    }

    public UUID id() {
        return id;
    }

    public UUID documentId() {
        return documentId;
    }

    public UUID revisionId() {
        return revisionId;
    }

    public Action action() {
        return action;
    }

    public DocumentStatus fromStatus() {
        return fromStatus;
    }

    public DocumentStatus toStatus() {
        return toStatus;
    }

    public UUID actorId() {
        return actorId;
    }

    public String comment() {
        return comment;
    }

    public Instant createdAt() {
        return createdAt;
    }
}
