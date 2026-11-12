package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.editorial.internal.domain.StatusTransition;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;

public interface TransitionRepository extends ListCrudRepository<StatusTransition, UUID> {

    @Query("select t from StatusTransition t where t.documentId = :documentId order by t.createdAt, t.id")
    List<StatusTransition> forDocument(UUID documentId);
}
