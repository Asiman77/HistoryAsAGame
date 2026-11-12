package az.tarix.platform.editorial.internal.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

/**
 * An immutable snapshot of a document's content. Edits and reverts always add a revision;
 * nothing is overwritten, so the history and diffs stay complete.
 */
@Entity
@Immutable
@Table(name = "editorial_revision")
public class EditorialRevision {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "revision_no", nullable = false)
    private int revisionNo;

    @Column(name = "schema_version", nullable = false)
    private int schemaVersion;

    /** The content as JSON text; parsed by the services (Jackson 3), stored as jsonb. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String content;

    @Column(name = "content_hash", nullable = false)
    private byte[] contentHash;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "change_note")
    private String changeNote;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected EditorialRevision() {}

    public EditorialRevision(UUID documentId, int revisionNo, int schemaVersion, String content, byte[] contentHash,
                      UUID authorId, String changeNote, Instant now) {
        this.documentId = documentId;
        this.revisionNo = revisionNo;
        this.schemaVersion = schemaVersion;
        this.content = content;
        this.contentHash = contentHash.clone();
        this.authorId = authorId;
        this.changeNote = changeNote;
        this.createdAt = now;
    }

    public UUID id() {
        return id;
    }

    public UUID documentId() {
        return documentId;
    }

    public int revisionNo() {
        return revisionNo;
    }

    public int schemaVersion() {
        return schemaVersion;
    }

    public String content() {
        return content;
    }

    public byte[] contentHash() {
        return contentHash.clone();
    }

    public UUID authorId() {
        return authorId;
    }

    public String changeNote() {
        return changeNote;
    }

    public Instant createdAt() {
        return createdAt;
    }
}
