package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.editorial.internal.domain.EditorialDocument;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<EditorialDocument, UUID> {

    boolean existsByTypeAndSlug(DocumentType type, String slug);

    Optional<EditorialDocument> findByTypeAndSlug(DocumentType type, String slug);
}
