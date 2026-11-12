package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.editorial.internal.domain.EditorialRevision;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;

public interface RevisionRepository extends ListCrudRepository<EditorialRevision, UUID> {

    Optional<EditorialRevision> findByDocumentIdAndRevisionNo(UUID documentId, int revisionNo);

    @Query("select coalesce(max(r.revisionNo), 0) from EditorialRevision r where r.documentId = :documentId")
    int maxRevisionNo(UUID documentId);

    /** The history without the (possibly large) content, newest first. */
    @Query("""
            select new az.tarix.platform.editorial.internal.persistence.RevisionSummary(
                r.id, r.revisionNo, r.schemaVersion, r.authorId, r.changeNote, r.createdAt)
            from EditorialRevision r where r.documentId = :documentId order by r.revisionNo desc""")
    List<RevisionSummary> history(UUID documentId);

    /** Authors of the revisions after {@code afterNo}: they may not approve (nobody approves their own work). */
    @Query("select distinct r.authorId from EditorialRevision r where r.documentId = :documentId and r.revisionNo > :afterNo")
    List<UUID> authorsAfter(UUID documentId, int afterNo);
}
