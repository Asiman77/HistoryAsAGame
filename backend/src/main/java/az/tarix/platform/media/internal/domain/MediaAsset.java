package az.tarix.platform.media.internal.domain;

import az.tarix.platform.media.api.AssetType;
import az.tarix.platform.shared.domain.PermissionStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

/**
 * A registered file with its licence and permission (BACKEND_SPEC.md §7.4, ADR-0017). The
 * write model of the media module; public reads go through {@code MediaFiles}. LocalizedText
 * fields are JSON text, parsed by the services (Jackson 3), stored as jsonb.
 */
@Entity
@Table(name = "media_asset")
public class MediaAsset {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "storage_key", nullable = false, updatable = false)
    private String storageKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Origin origin;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type", nullable = false, updatable = false)
    private AssetType mediaType;

    @Column(name = "mime_type", updatable = false)
    private String mimeType;

    @Column(name = "size_bytes", updatable = false)
    private Long sizeBytes;

    private Integer width;

    private Integer height;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(updatable = false)
    private byte[] checksum;

    @JdbcTypeCode(SqlTypes.JSON)
    private String title;

    @JdbcTypeCode(SqlTypes.JSON)
    private String caption;

    @Column(nullable = false)
    private String license;

    @Column(name = "source_url")
    private String sourceUrl;

    @Column(name = "rights_holder")
    private String rightsHolder;

    @Enumerated(EnumType.STRING)
    @Column(name = "permission_status", nullable = false)
    private PermissionStatus permissionStatus;

    @Column(name = "is_ai_generated", nullable = false)
    private boolean aiGenerated;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_disclosure_label")
    private String aiDisclosureLabel;

    @Column(name = "uploaded_by", updatable = false)
    private UUID uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected MediaAsset() {}

    /** The file's own facts, fixed at registration. */
    public record FileFacts(String storageKey, Origin origin, AssetType mediaType, String mimeType, Long sizeBytes,
                            byte[] checksum) {}

    /** What editors describe and may change later. JSON fields are LocalizedText as JSON text, or null. */
    public record Description(String title, String caption, String license, String sourceUrl, String rightsHolder,
                              boolean aiGenerated, String aiDisclosureLabel, Integer width, Integer height, Integer durationMs) {}

    public MediaAsset(FileFacts file, Description d, PermissionStatus status, UUID uploadedBy, Instant now) {
        this.storageKey = file.storageKey();
        this.origin = file.origin();
        this.mediaType = file.mediaType();
        this.mimeType = file.mimeType();
        this.sizeBytes = file.sizeBytes();
        this.checksum = file.checksum();
        describe(d);
        this.permissionStatus = status;
        this.uploadedBy = uploadedBy;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Replaces the description and the status (already decided by {@link PermissionPolicy}). */
    public void update(Description d, PermissionStatus status, Instant now) {
        describe(d);
        this.permissionStatus = status;
        this.updatedAt = now;
    }

    private void describe(Description d) {
        this.title = d.title();
        this.caption = d.caption();
        this.license = d.license();
        this.sourceUrl = d.sourceUrl();
        this.rightsHolder = d.rightsHolder();
        this.aiGenerated = d.aiGenerated();
        this.aiDisclosureLabel = d.aiDisclosureLabel();
        this.width = d.width();
        this.height = d.height();
        this.durationMs = d.durationMs();
    }

    public Description description() {
        return new Description(title, caption, license, sourceUrl, rightsHolder, aiGenerated, aiDisclosureLabel, width, height,
                durationMs);
    }

    /** How content refers to this asset: {@code media:<id>} (ADR-0017). */
    public String ref() {
        return "media:" + id;
    }

    public UUID id() {
        return id;
    }

    public String storageKey() {
        return storageKey;
    }

    public Origin origin() {
        return origin;
    }

    public AssetType mediaType() {
        return mediaType;
    }

    public String mimeType() {
        return mimeType;
    }

    public Long sizeBytes() {
        return sizeBytes;
    }

    public byte[] checksum() {
        return checksum == null ? null : checksum.clone();
    }

    public PermissionStatus permissionStatus() {
        return permissionStatus;
    }

    public UUID uploadedBy() {
        return uploadedBy;
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
