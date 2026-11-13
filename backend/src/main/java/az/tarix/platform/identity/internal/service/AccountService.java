package az.tarix.platform.identity.internal.service;

import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import az.tarix.platform.identity.internal.persistence.RefreshTokenRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Accounts of editors, reviewers, admins and teachers: created and managed by an ADMIN
 * (students have no accounts). Every change that narrows what a user may do (disabled,
 * roles changed, password set) ends that user's sessions, so it applies at the latest when the
 * current access token expires (15 minutes). Logs carry account ids, never e-mails or passwords.
 */
@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final AppUserRepository users;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder passwords;
    private final Clock clock;

    AccountService(AppUserRepository users, RefreshTokenRepository tokens, PasswordEncoder passwords, Clock clock) {
        this.users = users;
        this.tokens = tokens;
        this.passwords = passwords;
        this.clock = clock;
    }

    /** People's accounts (system accounts left out), by e-mail; {@code q} matches e-mail or name, {@code role} filters. */
    @Transactional(readOnly = true)
    public List<AppUser> list(String q, Role role) {
        String needle = q == null || q.isBlank() ? null : q.strip().toLowerCase(Locale.ROOT);
        return users.findAll().stream()
                .filter(u -> !u.isSystem())
                .filter(u -> role == null || u.roles().contains(role))
                .filter(u -> needle == null || u.email().contains(needle)
                        || u.displayName().toLowerCase(Locale.ROOT).contains(needle))
                .sorted(Comparator.comparing(AppUser::email))
                .toList();
    }

    @Transactional(readOnly = true)
    public AppUser get(UUID id) {
        return person(id);
    }

    @Transactional
    public AppUser create(String email, String displayName, Set<Role> roles, String password) {
        String normalized = AppUser.normalizeEmail(email);
        requireRoles(roles);
        requirePassword(password, normalized);
        if (users.findByEmail(normalized).isPresent()) {
            throw AccountException.conflict("duplicate-email", "Bu e-poçtla hesab artıq var.");
        }
        AppUser user = users.save(new AppUser(normalized, displayName.strip(), passwords.encode(password), roles, clock.instant()));
        log.info("Account {} created with roles {}", user.id(), roles);
        return user;
    }

    /**
     * Changes what is given (null = unchanged). An admin cannot disable themselves or drop their
     * own ADMIN role, and the last enabled admin cannot be disabled or demoted: someone must
     * always be able to manage accounts.
     */
    @Transactional
    public AppUser update(UUID actor, UUID id, String displayName, Set<Role> roles, Boolean enabled) {
        AppUser user = person(id);
        Instant now = clock.instant();
        boolean losesAdmin = user.roles().contains(Role.ADMIN)
                && ((roles != null && !roles.contains(Role.ADMIN)) || Boolean.FALSE.equals(enabled));
        if (losesAdmin && actor.equals(id)) {
            throw AccountException.conflict("self-lockout", "Öz ADMIN hüququnuzu ala və ya hesabınızı söndürə bilməzsiniz.");
        }
        if (losesAdmin && user.enabled() && enabledAdmins() <= 1) {
            throw AccountException.conflict("last-admin", "Sonuncu aktiv ADMIN hesabı qalmalıdır.");
        }
        boolean endSessions = false;
        if (displayName != null) user.rename(displayName.strip(), now);
        if (roles != null && !roles.equals(user.roles())) {
            requireRoles(roles);
            user.changeRoles(roles, now);
            endSessions = true;
        }
        if (enabled != null && enabled != user.enabled()) {
            if (enabled) user.enable(now);
            else user.disable(now);
            endSessions |= !enabled;
        }
        if (endSessions) tokens.revokeAllOf(user.id(), now);
        log.info("Account {} updated by {} (roles {}, enabled {})", id, actor, user.roles(), user.enabled());
        return user;
    }

    /** An admin sets a new password (e.g. a forgotten one); the user's sessions end. */
    @Transactional
    public void setPassword(UUID actor, UUID id, String password) {
        AppUser user = person(id);
        requirePassword(password, user.email());
        Instant now = clock.instant();
        user.changePasswordHash(passwords.encode(password), now);
        tokens.revokeAllOf(user.id(), now);
        log.info("Password of account {} set by {}", id, actor);
    }

    /** A user changes their own password; every session of theirs ends, they log in again. */
    @Transactional
    public void changeOwnPassword(UUID id, String current, String next) {
        AppUser user = users.findById(id).filter(AppUser::canLogIn)
                .orElseThrow(() -> AccountException.notFound("Hesab tapılmadı."));
        if (!passwords.matches(current, user.passwordHash())) {
            throw AccountException.invalid("wrong-password", "Hazırkı şifrə düz deyil.", List.of());
        }
        requirePassword(next, user.email());
        Instant now = clock.instant();
        user.changePasswordHash(passwords.encode(next), now);
        tokens.revokeAllOf(user.id(), now);
        log.info("Account {} changed its password", id);
    }

    private AppUser person(UUID id) {
        return users.findById(id).filter(u -> !u.isSystem()).orElseThrow(() -> AccountException.notFound("Hesab tapılmadı."));
    }

    private long enabledAdmins() {
        return users.findAll().stream().filter(u -> u.enabled() && u.roles().contains(Role.ADMIN)).count();
    }

    private static void requireRoles(Set<Role> roles) {
        if (roles == null || roles.isEmpty()) {
            throw AccountException.invalid("invalid-roles", "Ən azı bir rol lazımdır.", List.of());
        }
    }

    private static void requirePassword(String password, String email) {
        List<String> problems = PasswordPolicy.check(password, email);
        if (!problems.isEmpty()) throw AccountException.invalid("invalid-password", "Şifrə qaydalara uyğun deyil.", problems);
    }
}
