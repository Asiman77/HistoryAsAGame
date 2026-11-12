package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.editorial.internal.validation.ReferenceLookup;
import java.util.Locale;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Looks references up among editorial documents (see {@link ReferenceLookup}). */
@Component
class JdbcReferenceLookup implements ReferenceLookup {

    static final String FIND = """
            SELECT published_revision_id IS NOT NULL AS published
            FROM editorial_document
            WHERE doc_type = :type AND slug = :slug AND status <> 'ARCHIVED'""";

    /** A PLANNED_ENTITY whose current content announces this type and slug. */
    static final String PLANNED = """
            SELECT count(*) > 0
            FROM editorial_document d JOIN editorial_revision r ON r.id = d.current_revision_id
            WHERE d.doc_type = 'PLANNED_ENTITY' AND d.slug = :slug AND d.status <> 'ARCHIVED'
              AND r.content -> 'entity' ->> 'type' = :type""";

    private final JdbcClient jdbc;

    JdbcReferenceLookup(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Target find(DocumentType type, String slug) {
        Optional<Boolean> published = jdbc.sql(FIND).param("type", type.name()).param("slug", slug)
                .query(Boolean.class).optional();
        if (published.isPresent()) return published.get() ? Target.PUBLISHED : Target.UNPUBLISHED;
        boolean planned = jdbc.sql(PLANNED).param("slug", slug).param("type", type.name().toLowerCase(Locale.ROOT))
                .query(Boolean.class).single();
        return planned ? Target.PLANNED : Target.MISSING;
    }
}
