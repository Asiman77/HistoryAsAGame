package az.tarix.platform;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.editorial.DataDocuments.Doc;
import az.tarix.platform.publishing.internal.Projector;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Today's whole data/ folder as published documents, projected once: what the public API
 * tests read. Rows are written directly (no review flow), owned by a user of the given e-mail
 * domain so {@link #remove} can delete it again.
 */
public final class PublishedData {

    private PublishedData() {}

    public static void publishAll(JdbcClient jdbc, Projector projector, String ownerDomain) {
        UUID owner = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:email, 'owner') RETURNING id")
                .param("email", "owner@" + ownerDomain).query(UUID.class).single();
        for (Doc d : DataDocuments.all()) seedPublished(jdbc, d, owner);
        assertThat(projector.rebuild().deferred()).isEmpty();
    }

    public static void remove(JdbcClient jdbc, String ownerDomain) {
        TestDatabase.clearContent(jdbc);
        jdbc.sql("DELETE FROM app_user WHERE email LIKE :pattern").param("pattern", "%@" + ownerDomain).update();
    }

    static void seedPublished(JdbcClient jdbc, Doc d, UUID owner) {
        UUID doc = jdbc.sql("""
                INSERT INTO editorial_document (doc_type, slug, status, created_by, created_at, updated_at)
                VALUES (:type, :slug, 'PUBLISHED', :owner, now(), now()) RETURNING id""")
                .param("type", d.type().name()).param("slug", d.slug()).param("owner", owner).query(UUID.class).single();
        UUID rev = jdbc.sql("""
                INSERT INTO editorial_revision (document_id, revision_no, schema_version, content, content_hash, author_id, created_at)
                VALUES (:doc, 1, 1, CAST(:content AS jsonb), sha256(convert_to(:content, 'UTF8')), :owner, now()) RETURNING id""")
                .param("doc", doc).param("content", d.content().toString()).param("owner", owner).query(UUID.class).single();
        jdbc.sql("UPDATE editorial_document SET current_revision_id = :rev, published_revision_id = :rev WHERE id = :doc")
                .param("rev", rev).param("doc", doc).update();
    }
}
