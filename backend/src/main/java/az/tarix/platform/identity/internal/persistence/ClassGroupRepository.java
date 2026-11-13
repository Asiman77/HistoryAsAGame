package az.tarix.platform.identity.internal.persistence;

import az.tarix.platform.identity.internal.domain.ClassGroup;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.ListCrudRepository;

public interface ClassGroupRepository extends ListCrudRepository<ClassGroup, UUID> {

    /** {@code code} must already be normalized (upper case). */
    Optional<ClassGroup> findByCode(String code);

    List<ClassGroup> findByTeacherIdOrderByCreatedAt(UUID teacherId);

    long countByTeacherId(UUID teacherId);

    boolean existsByCode(String code);
}
