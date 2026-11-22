package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.editorial.internal.domain.EditorialDocument;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<EditorialDocument, UUID> {

    boolean existsByTypeAndSlug(DocumentType type, String slug);

    Optional<EditorialDocument> findByTypeAndSlug(DocumentType type, String slug);

    /** Where a renamed slug points now ({@code slug_redirect}); empty when it was never renamed. */
    @Query(value = "SELECT new_slug FROM slug_redirect WHERE doc_type = :type AND old_slug = :slug", nativeQuery = true)
    Optional<String> redirectOf(@Param("type") String type, @Param("slug") String slug);
}
