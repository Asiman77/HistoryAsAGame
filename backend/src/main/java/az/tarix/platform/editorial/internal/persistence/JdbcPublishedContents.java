package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.editorial.api.PublishedContents;
import az.tarix.platform.editorial.internal.content.ContentJson;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.content.PublishedContent;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class JdbcPublishedContents implements PublishedContents {

    static final String PUBLISHED = """
            SELECT d.id, d.doc_type, d.slug, r.id AS revision_id, r.revision_no, r.content
            FROM editorial_document d JOIN editorial_revision r ON r.id = d.published_revision_id
            WHERE d.id = :id AND d.status <> 'ARCHIVED'""";

    static final String CURRENT = """
            SELECT d.id, d.doc_type, d.slug, r.id AS revision_id, r.revision_no, r.content
            FROM editorial_document d JOIN editorial_revision r ON r.id = d.current_revision_id
            WHERE d.id = :id""";

    static final String NUMBERED = """
            SELECT d.id, d.doc_type, d.slug, r.id AS revision_id, r.revision_no, r.content
            FROM editorial_document d JOIN editorial_revision r ON r.document_id = d.id AND r.revision_no = :no
            WHERE d.id = :id""";

    static final String ALL = """
            SELECT id FROM editorial_document
            WHERE published_revision_id IS NOT NULL AND status <> 'ARCHIVED'
            ORDER BY doc_type, slug""";

    static final String ALL_CONTENTS = """
            SELECT d.id, d.doc_type, d.slug, d.position, r.id AS revision_id, r.revision_no, r.content
            FROM editorial_document d JOIN editorial_revision r ON r.id = d.published_revision_id
            WHERE d.status <> 'ARCHIVED'
            ORDER BY d.position NULLS LAST, d.created_at, d.slug""";

    private final JdbcClient jdbc;

    JdbcPublishedContents(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<PublishedContent> of(UUID documentId) {
        return jdbc.sql(PUBLISHED).param("id", documentId).query((rs, n) -> new PublishedContent(
                rs.getObject("id", UUID.class), DocumentType.valueOf(rs.getString("doc_type")), rs.getString("slug"),
                rs.getObject("revision_id", UUID.class), rs.getInt("revision_no"), ContentJson.parse(rs.getString("content"))))
                .optional();
    }

    @Override
    public Optional<PublishedContent> revision(UUID documentId, Integer revisionNo) {
        var sql = revisionNo == null ? jdbc.sql(CURRENT) : jdbc.sql(NUMBERED).param("no", revisionNo);
        return sql.param("id", documentId).query((rs, n) -> new PublishedContent(
                rs.getObject("id", UUID.class), DocumentType.valueOf(rs.getString("doc_type")), rs.getString("slug"),
                rs.getObject("revision_id", UUID.class), rs.getInt("revision_no"), ContentJson.parse(rs.getString("content"))))
                .optional();
    }

    @Override
    public List<UUID> publishedDocumentIds() {
        return jdbc.sql(ALL).query(UUID.class).list();
    }

    @Override
    public List<Positioned> allPublished() {
        return jdbc.sql(ALL_CONTENTS).query((rs, n) -> new Positioned(new PublishedContent(rs.getObject("id", UUID.class),
                DocumentType.valueOf(rs.getString("doc_type")), rs.getString("slug"), rs.getObject("revision_id", UUID.class),
                rs.getInt("revision_no"), ContentJson.parse(rs.getString("content"))), (Integer) rs.getObject("position"))).list();
    }
}
