package az.tarix.platform.identity.internal.service;

import az.tarix.platform.identity.api.Accounts;
import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class JpaAccounts implements Accounts {

    private final AppUserRepository users;

    JpaAccounts(AppUserRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Set<Role>> activeRoles(UUID userId) {
        return users.findById(userId).filter(AppUser::enabled).map(AppUser::roles);
    }
}
