package az.tarix.platform.identity.internal.service;

import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.api.SystemAccounts;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import java.time.Clock;
import java.util.EnumSet;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** System accounts: no password (cannot log in) and no roles. */
@Component
class JpaSystemAccounts implements SystemAccounts {

    /** {@code .invalid} (RFC 2606): never a real mailbox. */
    static final String IMPORTER_EMAIL = "importer@system.invalid";

    private final AppUserRepository users;
    private final Clock clock;

    JpaSystemAccounts(AppUserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    @Override
    @Transactional
    public UUID importer() {
        return users.findByEmail(IMPORTER_EMAIL)
                .orElseGet(() -> users.save(new AppUser(IMPORTER_EMAIL, "Data importer", null, EnumSet.noneOf(Role.class), clock.instant())))
                .id();
    }
}
