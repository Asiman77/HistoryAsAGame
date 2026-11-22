package az.tarix.platform.publishing.internal;

import az.tarix.platform.editorial.api.PublishedContents;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.content.MissingDependencyException;
import az.tarix.platform.shared.content.ProjectionWriter;
import az.tarix.platform.shared.content.PublishedContent;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PreviewSource;
import az.tarix.platform.shared.read.ReadContext;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Editorial preview (BACKEND_SPEC.md §11): how a revision would look in the public API once
 * published. The revision is projected by the same writers as a publish, inside a transaction
 * that is always rolled back, and read back through the modules' {@link PreviewSource}s. Other
 * requests never see the rows (MVCC), the content version does not move and nothing is cached.
 */
@Service
public class PreviewService {

    /** The preview: which revision, and its public representations by name (e.g. {@code profile}, {@code steps}). */
    public record Preview(UUID documentId, DocumentType type, String slug, int revisionNo, Map<String, Object> parts) {}

    /** No such document or revision. */
    public static class NoSuchRevision extends RuntimeException {
        NoSuchRevision(String message) {
            super(message);
        }
    }

    /** The revision cannot be projected (e.g. a theme variant without its parent, a polygon PostGIS rejects). */
    public static class NotPreviewable extends RuntimeException {
        NotPreviewable(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private final PublishedContents contents;
    private final List<ProjectionWriter> writers;
    private final List<PreviewSource> sources;
    private final JdbcClient jdbc;
    private final TransactionTemplate tx;

    PreviewService(PublishedContents contents, List<ProjectionWriter> writers, List<PreviewSource> sources, JdbcClient jdbc,
                   PlatformTransactionManager transactions) {
        this.contents = contents;
        this.writers = List.copyOf(writers);
        this.sources = List.copyOf(sources);
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(transactions);
    }

    /** {@code revisionNo}: a revision of the document, or the current one when null. */
    public Preview preview(UUID documentId, Integer revisionNo, Lang lang) {
        return tx.execute(status -> {
            status.setRollbackOnly();
            // The same locks as a publish of this document, so a concurrent projection does not interleave.
            jdbc.sql(Projector.LOCK_ALL_SHARED).param("ns", Projector.LOCK_NAMESPACE + 1).query(Object.class).list();
            jdbc.sql(Projector.LOCK_DOCUMENT).param("ns", Projector.LOCK_NAMESPACE).param("doc", documentId).query(Object.class).list();
            PublishedContent c = contents.revision(documentId, revisionNo).orElseThrow(() -> new NoSuchRevision(
                    revisionNo == null ? "Sənəd tapılmadı." : "Sənədin " + revisionNo + " nömrəli revision-ı tapılmadı."));
            try {
                for (ProjectionWriter w : writers) w.delete(documentId);
                for (ProjectionWriter w : writers) w.write(c);
                for (ProjectionWriter w : writers) w.afterChanges();
            } catch (MissingDependencyException | DataAccessException e) {
                throw new NotPreviewable("Bu revision proyeksiya oluna bilmir: " + e.getMessage(), e);
            }
            long version = jdbc.sql("SELECT value FROM content_version WHERE id = 1").query(Long.class).single();
            ReadContext ctx = new ReadContext(version, lang).asPreview();
            Map<String, Object> parts = new LinkedHashMap<>();
            for (PreviewSource s : sources) parts.putAll(s.preview(c.type(), c.slug(), ctx));
            return new Preview(c.documentId(), c.type(), c.slug(), c.revisionNo(), parts);
        });
    }
}
