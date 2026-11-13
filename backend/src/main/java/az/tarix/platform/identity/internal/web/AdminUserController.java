package az.tarix.platform.identity.internal.web;

import az.tarix.platform.identity.api.CurrentUserProvider;
import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.service.AccountService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Accounts, managed by an ADMIN. There is no sign-up and no e-mail: the admin sets the first
 * password and gives it to the person, who changes it with {@code POST /api/v1/auth/password}.
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
class AdminUserController {

    private final AccountService accounts;
    private final CurrentUserProvider currentUser;

    AdminUserController(AccountService accounts, CurrentUserProvider currentUser) {
        this.accounts = accounts;
        this.currentUser = currentUser;
    }

    record UserView(UUID id, String email, String displayName, List<Role> roles, boolean enabled, Instant createdAt,
                    Instant updatedAt) {
        static UserView of(AppUser u) {
            return new UserView(u.id(), u.email(), u.displayName(), u.roles().stream().sorted().toList(), u.enabled(),
                    u.createdAt(), u.updatedAt());
        }
    }

    record CreateUser(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 120) String displayName,
                      @NotEmpty Set<Role> roles, @NotBlank @Size(max = 128) String password) {}

    /** Only the fields given change. */
    record UpdateUser(@Size(min = 1, max = 120) String displayName, Set<Role> roles, Boolean enabled) {}

    record SetPassword(@NotBlank @Size(max = 128) String password) {}

    /** All people's accounts (staff accounts are few, so no paging), filtered by e-mail/name and role. */
    @GetMapping
    ResponseEntity<List<UserView>> list(@RequestParam(required = false) String q, @RequestParam(required = false) Role role) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(accounts.list(q, role).stream().map(UserView::of).toList());
    }

    @GetMapping("/{id}")
    ResponseEntity<UserView> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(UserView.of(accounts.get(id)));
    }

    @PostMapping
    ResponseEntity<UserView> create(@Valid @RequestBody CreateUser body) {
        AppUser user = accounts.create(body.email(), body.displayName(), body.roles(), body.password());
        return ResponseEntity.created(URI.create("/api/v1/admin/users/" + user.id())).cacheControl(CacheControl.noStore())
                .body(UserView.of(user));
    }

    @PatchMapping("/{id}")
    ResponseEntity<UserView> update(@PathVariable UUID id, @Valid @RequestBody UpdateUser body) {
        AppUser user = accounts.update(currentUser.require().id(), id, body.displayName(), body.roles(), body.enabled());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(UserView.of(user));
    }

    /** Sets a new password (e.g. a forgotten one) and ends the user's sessions. */
    @PutMapping("/{id}/password")
    ResponseEntity<Void> setPassword(@PathVariable UUID id, @Valid @RequestBody SetPassword body) {
        accounts.setPassword(currentUser.require().id(), id, body.password());
        return ResponseEntity.noContent().build();
    }
}
