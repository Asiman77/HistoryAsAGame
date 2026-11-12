package az.tarix.platform.editorial.internal.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.UuidGenerator;

/**
 * A review remark on one revision, optionally on one field ({@code fieldPath} is a JSON
 * Pointer into the content, the same format the validation report uses).
 */
@Entity
@Table(name = "review_comment")
public class ReviewComment {

    public static final int MAX_BODY = 10_000;
    public static final int MAX_PATH = 500;

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "revision_id", nullable = false, updatable = false)
    private UUID revisionId;

    @Column(name = "field_path", updatable = false)
    private String fieldPath;

    @Column(nullable = false)
    private String body;

    @Column(name = "author_id", nullable = false, updatable = false)
    private UUID authorId;

    @Column(nullable = false)
    private boolean resolved;

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected ReviewComment() {}

    public ReviewComment(UUID revisionId, String fieldPath, String body, UUID authorId, Instant now) {
        this.revisionId = revisionId;
        this.fieldPath = checkPath(fieldPath);
        this.body = checkBody(body);
        this.authorId = authorId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Only the author may reword a comment. */
    public void edit(String newBody, UUID actor, Instant now) {
        if (!authorId.equals(actor)) throw new NotPermittedException("Şərhi yalnız onun müəllifi dəyişə bilər.");
        this.body = checkBody(newBody);
        this.updatedAt = now;
    }

    public void resolve(boolean value, UUID actor, Instant now) {
        if (value == resolved) return;
        this.resolved = value;
        this.resolvedBy = value ? actor : null;
        this.resolvedAt = value ? now : null;
        this.updatedAt = now;
    }

    private static String checkBody(String body) {
        if (body == null || body.isBlank()) throw new IllegalArgumentException("Şərh boş ola bilməz.");
        if (body.length() > MAX_BODY) throw new IllegalArgumentException("Şərh " + MAX_BODY + " simvoldan uzundur.");
        return body.strip();
    }

    private static String checkPath(String path) {
        if (path == null || path.isEmpty()) return null;
        if (!path.startsWith("/") || path.length() > MAX_PATH) {
            throw new IllegalArgumentException("fieldPath JSON Pointer olmalıdır (məs. /events/3/title/az).");
        }
        return path;
    }

    public UUID id() {
        return id;
    }

    public UUID revisionId() {
        return revisionId;
    }

    public String fieldPath() {
        return fieldPath;
    }

    public String body() {
        return body;
    }

    public UUID authorId() {
        return authorId;
    }

    public boolean resolved() {
        return resolved;
    }

    public UUID resolvedBy() {
        return resolvedBy;
    }

    public Instant resolvedAt() {
        return resolvedAt;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public long version() {
        return version;
    }
}
