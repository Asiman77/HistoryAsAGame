package az.tarix.platform.identity.internal.persistence;

import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;

public interface AppUserRepository extends ListCrudRepository<AppUser, UUID> {

    /** {@code email} must already be normalized ({@link AppUser#normalizeEmail}). */
    Optional<AppUser> findByEmail(String email);

    @Query("select count(u) > 0 from AppUser u join u.roles r where r = :role and u.enabled = true")
    boolean existsEnabledWithRole(Role role);
}
