package az.tarix.platform.editorial.internal.domain;

import az.tarix.platform.editorial.api.DocumentStatus;
import az.tarix.platform.shared.content.DocumentType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.UuidGenerator;

/**
 * One unit of content (a person with its life, a place, a theme…). Holds the workflow state
 * and points at its revisions: the current one being edited or reviewed, and the one that is
 * public. Status changes go through {@link Workflow}, which also checks permissions.
 */
@Entity
@Table(name = "editorial_document")
public class EditorialDocument {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false, updatable = false)
    private DocumentType type;

    /** Changed only by {@link Workflow#rename} (the old one then redirects, BACKEND_SPEC.md §5.5). */
    @Column(nullable = false)
    private String slug;

    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentStatus status;

    @Column(name = "current_revision_id")
    private UUID currentRevisionId;

    @Column(name = "published_revision_id")
    private UUID publishedRevisionId;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** The reviewer or admin expected to review it; null: nobody in particular. */
    @Column(name = "assignee_id")
    private UUID assigneeId;

    /** Order inside the shared data file it is exported to (ADR-0019); null: after the others. */
    private Integer position;

    @Version
    private long version;

    protected EditorialDocument() {}

    public EditorialDocument(DocumentType type, String slug, UUID createdBy, Instant now) {
        this.type = type;
        this.slug = slug;
        this.createdBy = createdBy;
        this.status = DocumentStatus.DRAFT;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** A new revision became current. */
    void revisionAdded(EditorialRevision revision, String title, Instant now) {
        this.currentRevisionId = revision.id();
        this.title = title;
        this.updatedAt = now;
    }

    void moveTo(DocumentStatus to, Instant now) {
        this.status = to;
        this.updatedAt = now;
    }

    void renameTo(String newSlug, Instant now) {
        this.slug = newSlug;
        this.updatedAt = now;
    }

    void assignTo(UUID assignee, Instant now) {
        this.assigneeId = assignee;
        this.updatedAt = now;
    }

    void markPublished(UUID revisionId, Instant now) {
        this.publishedRevisionId = revisionId;
        moveTo(DocumentStatus.PUBLISHED, now);
    }

    public UUID id() {
        return id;
    }

    public DocumentType type() {
        return type;
    }

    public String slug() {
        return slug;
    }

    public String title() {
        return title;
    }

    public DocumentStatus status() {
        return status;
    }

    public UUID currentRevisionId() {
        return currentRevisionId;
    }

    public UUID publishedRevisionId() {
        return publishedRevisionId;
    }

    public UUID createdBy() {
        return createdBy;
    }

    public UUID assigneeId() {
        return assigneeId;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public Integer position() {
        return position;
    }

    /** Set by the importer from the file order; not a content change (no revision). */
    public void placeAt(Integer position) {
        this.position = position;
    }

    public long version() {
        return version;
    }
}
