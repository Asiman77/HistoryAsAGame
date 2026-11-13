package az.tarix.platform.identity.internal.web;

import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.identity.api.CurrentUserProvider;
import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import az.tarix.platform.identity.internal.service.AccountService;
import az.tarix.platform.identity.internal.service.AuthService;
import az.tarix.platform.identity.internal.service.AuthService.TokenPair;
import az.tarix.platform.identity.internal.service.AuthenticationFailedException;
import az.tarix.platform.identity.internal.service.LoginRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Token endpoints for editors, reviewers, admins and teachers. Tokens travel in the body
 * (no cookies), so the API stays usable from the CMS, scripts and a mobile client alike.
 */
@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

    static final URI AUTH_FAILED = URI.create("https://tarixin-icinde.az/problems/authentication-failed");
    static final URI TOO_MANY_REQUESTS = URI.create("https://tarixin-icinde.az/problems/too-many-requests");

    private final AuthService auth;
    private final CurrentUserProvider currentUser;
    private final AppUserRepository users;
    private final LoginRateLimiter limiter;
    private final AccountService accounts;

    AuthController(AuthService auth, CurrentUserProvider currentUser, AppUserRepository users, LoginRateLimiter limiter,
                   AccountService accounts) {
        this.auth = auth;
        this.currentUser = currentUser;
        this.users = users;
        this.limiter = limiter;
        this.accounts = accounts;
    }

    record LoginRequest(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 128) String password) {}

    record RefreshRequest(@NotBlank @Size(max = 64) String refreshToken) {}

    /** OAuth 2.0-style token response (RFC 6749 §5.1 field names, camelCase). */
    record TokenResponse(String accessToken, String tokenType, long expiresIn, String refreshToken, long refreshExpiresIn) {
        static TokenResponse of(TokenPair p) {
            return new TokenResponse(p.accessToken(), "Bearer", p.accessExpiresIn(), p.refreshToken(), p.refreshExpiresIn());
        }
    }

    record Me(UUID id, String email, String displayName, List<Role> roles) {}

    /**
     * Rate limited per client address and per account (BACKEND_SPEC.md §13) before the password
     * is even checked, so throttled attempts cost no Argon2 work.
     */
    @PostMapping("/login")
    ResponseEntity<?> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        Optional<Duration> wait = limiter.tryAttempt(request.getRemoteAddr(), body.email());
        if (wait.isPresent()) return tooManyAttempts(wait.get());
        return tokens(auth.login(body.email(), body.password()));
    }

    /** 429 with {@code Retry-After} (RFC 6585 §4). The same answer whichever limit was hit. */
    static ResponseEntity<ProblemDetail> tooManyAttempts(Duration wait) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS,
                "Too many login attempts. Try again in " + wait.toSeconds() + " seconds.");
        problem.setType(TOO_MANY_REQUESTS);
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.RETRY_AFTER, Long.toString(wait.toSeconds())).body(problem);
    }

    @PostMapping("/refresh")
    ResponseEntity<TokenResponse> refresh(@Valid @RequestBody RefreshRequest body) {
        return tokens(auth.refresh(body.refreshToken()));
    }

    /** Revokes the session of the refresh token. Always 204, so it reveals nothing. */
    @PostMapping("/logout")
    ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest body) {
        auth.logout(body.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    ResponseEntity<Me> me() {
        CurrentUser user = currentUser.require();
        return users.findById(user.id())
                .map(u -> ResponseEntity.ok().cacheControl(CacheControl.noStore())
                        .body(new Me(u.id(), u.email(), u.displayName(), u.roles().stream().sorted().toList())))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    record ChangePassword(@NotBlank @Size(max = 128) String currentPassword, @NotBlank @Size(max = 128) String newPassword) {}

    /**
     * Changes the caller's own password. All their sessions end, this one included: the client
     * logs in again with the new password. Counts as a login attempt for rate limiting, since
     * it checks a password.
     */
    @PostMapping("/password")
    ResponseEntity<?> changePassword(@Valid @RequestBody ChangePassword body, HttpServletRequest request) {
        UUID id = currentUser.require().id();
        String email = users.findById(id).map(u -> u.email()).orElse(id.toString());
        Optional<Duration> wait = limiter.tryAttempt(request.getRemoteAddr(), email);
        if (wait.isPresent()) return tooManyAttempts(wait.get());
        accounts.changeOwnPassword(id, body.currentPassword(), body.newPassword());
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(AuthenticationFailedException.class)
    ResponseEntity<ProblemDetail> failed(AuthenticationFailedException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED,
                "The e-mail, password or refresh token is not valid.");
        problem.setType(AUTH_FAILED);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore()).body(problem);
    }

    /** Token responses must never be cached (RFC 6749 §5.1). */
    private static ResponseEntity<TokenResponse> tokens(TokenPair pair) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Pragma", "no-cache")
                .body(TokenResponse.of(pair));
    }
}
