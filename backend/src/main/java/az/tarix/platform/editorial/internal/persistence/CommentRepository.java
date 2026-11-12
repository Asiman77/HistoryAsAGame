package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.editorial.internal.domain.ReviewComment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentRepository extends JpaRepository<ReviewComment, UUID> {

    /** All comments on all revisions of a document, oldest first. */
    @Query("""
            select c from ReviewComment c where c.revisionId in
                (select r.id from EditorialRevision r where r.documentId = :documentId)
            order by c.createdAt, c.id""")
    List<ReviewComment> forDocument(UUID documentId);
}
