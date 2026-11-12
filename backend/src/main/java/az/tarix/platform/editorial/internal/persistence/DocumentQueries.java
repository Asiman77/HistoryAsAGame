package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.editorial.api.DocumentStatus;
import az.tarix.platform.shared.content.DocumentType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** The document list with filters (native SQL: search uses {@code az_fold} and trigrams, ADR-0003). */
@Component
public class DocumentQueries {

    /** One row of the document list. */
    public record DocumentRow(UUID id, String docType, String slug, String title, String status, UUID createdBy,
                              Instant createdAt, Instant updatedAt, long version, Integer revisionNo,
                              Integer publishedRevisionNo) {}

    public record Filter(DocumentType type, DocumentStatus status, String q, UUID createdBy, int limit, int offset) {}

    static final String LIST = """
            SELECT d.id, d.doc_type, d.slug, d.title, d.status, d.created_by, d.created_at, d.updated_at, d.version,
                   cur.revision_no AS revision_no, pub.revision_no AS published_revision_no
            FROM editorial_document d
            LEFT JOIN editorial_revision cur ON cur.id = d.current_revision_id
            LEFT JOIN editorial_revision pub ON pub.id = d.published_revision_id
            WHERE (CAST(:type AS varchar) IS NULL OR d.doc_type = :type)
              AND (CAST(:status AS varchar) IS NULL OR d.status = :status)
              AND (CAST(:createdBy AS uuid) IS NULL OR d.created_by = :createdBy)
              AND (CAST(:q AS text) IS NULL
                   OR d.slug LIKE lower(:pattern)
                   OR az_fold(d.title) LIKE az_fold(:pattern)
                   OR az_fold(:q) <% az_fold(d.title))
            ORDER BY d.updated_at DESC, d.id
            LIMIT :limit OFFSET :offset""";

    private final JdbcClient jdbc;

    DocumentQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<DocumentRow> list(Filter f) {
        String q = f.q() == null || f.q().isBlank() ? null : f.q().strip();
        return jdbc.sql(LIST)
                .param("type", f.type() == null ? null : f.type().name())
                .param("status", f.status() == null ? null : f.status().name())
                .param("createdBy", f.createdBy())
                .param("q", q)
                .param("pattern", q == null ? null : "%" + likeEscape(q) + "%")
                .param("limit", f.limit())
                .param("offset", f.offset())
                .query((rs, n) -> new DocumentRow(rs.getObject("id", UUID.class), rs.getString("doc_type"), rs.getString("slug"),
                        rs.getString("title"), rs.getString("status"), rs.getObject("created_by", UUID.class),
                        rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
                        rs.getLong("version"), (Integer) rs.getObject("revision_no"), (Integer) rs.getObject("published_revision_no")))
                .list();
    }

    /** The search text as a literal inside a LIKE pattern (backslash is PostgreSQL's default escape). */
    static String likeEscape(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
