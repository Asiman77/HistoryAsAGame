package az.tarix.platform.identity.internal.service;

import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import java.time.Clock;
import java.util.EnumSet;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first ADMIN from {@code ADMIN_EMAIL} / {@code ADMIN_PASSWORD} when that
 * account does not exist yet. An existing account is never changed (the variables cannot
 * be used to reset a password). There is no default password anywhere in the code.
 */
@Component
class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AppUserRepository users;
    private final PasswordEncoder passwords;
    private final IdentityProperties props;
    private final Clock clock;

    AdminBootstrap(AppUserRepository users, PasswordEncoder passwords, IdentityProperties props, Clock clock) {
        this.users = users;
        this.passwords = passwords;
        this.props = props;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        IdentityProperties.Admin admin = props.admin();
        if (!admin.configured()) {
            if (!users.existsEnabledWithRole(Role.ADMIN)) {
                log.warn("No ADMIN account exists and ADMIN_EMAIL is not set; editorial administration is unavailable");
            }
            return;
        }
        String email = AppUser.normalizeEmail(admin.email());
        if (users.findByEmail(email).isPresent()) {
            log.debug("Bootstrap admin already exists; nothing to do");
            return;
        }
        List<String> problems = PasswordPolicy.check(admin.password(), email);
        if (!problems.isEmpty()) {
            throw new IllegalStateException("ADMIN_PASSWORD does not meet the password policy: " + String.join(", ", problems));
        }
        users.save(new AppUser(email, admin.displayName(), passwords.encode(admin.password()),
                EnumSet.of(Role.ADMIN), clock.instant()));
        log.info("Created the bootstrap ADMIN account");
    }
}
