package az.tarix.platform.identity.internal.service;

import az.tarix.platform.identity.api.Role;
import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.domain.RefreshToken;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import az.tarix.platform.identity.internal.persistence.RefreshTokenRepository;
import az.tarix.platform.identity.internal.service.AuthenticationFailedException.Reason;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Login, refresh-token rotation with reuse detection, and logout.
 *
 * <p>Access tokens are short-lived JWTs; refresh tokens are opaque, single-use and rotate on
 * every refresh. If a refresh token that was already used is presented again, someone else
 * may hold a copy: the whole family (that login session) is revoked.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final AppUserRepository users;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder passwords;
    private final JwtEncoder jwt;
    private final IdentityProperties props;
    private final Clock clock;
    /** Compared against when the e-mail is unknown, so both paths take the same time. */
    private final String dummyHash;

    public AuthService(AppUserRepository users, RefreshTokenRepository tokens, PasswordEncoder passwords,
                       JwtEncoder jwt, IdentityProperties props, Clock clock) {
        this.users = users;
        this.tokens = tokens;
        this.passwords = passwords;
        this.jwt = jwt;
        this.props = props;
        this.clock = clock;
        this.dummyHash = passwords.encode(RefreshTokenCodec.newToken());
    }

    public record TokenPair(String accessToken, long accessExpiresIn, String refreshToken, long refreshExpiresIn) {}

    @Transactional
    public TokenPair login(String email, String password) {
        AppUser user = users.findByEmail(AppUser.normalizeEmail(email)).orElse(null);
        if (user == null || user.passwordHash() == null) {
            passwords.matches(password, dummyHash);
            throw fail(Reason.BAD_CREDENTIALS);
        }
        if (!passwords.matches(password, user.passwordHash())) {
            throw fail(Reason.BAD_CREDENTIALS);
        }
        if (!user.enabled()) {
            throw fail(Reason.ACCOUNT_DISABLED);
        }
        Instant now = clock.instant();
        if (passwords.upgradeEncoding(user.passwordHash())) {
            user.changePasswordHash(passwords.encode(password), now);
        }
        return issue(user, UUID.randomUUID(), now).pair();
    }

    /** Exchanges a refresh token for a new pair. Commits the family revocation even when it fails. */
    @Transactional(noRollbackFor = AuthenticationFailedException.class)
    public TokenPair refresh(String refreshToken) {
        if (!RefreshTokenCodec.looksValid(refreshToken)) throw fail(Reason.TOKEN_INVALID);
        RefreshToken current = tokens.findForUpdate(RefreshTokenCodec.hash(refreshToken))
                .orElseThrow(() -> fail(Reason.TOKEN_INVALID));
        Instant now = clock.instant();
        if (current.isRevoked()) {
            int revoked = tokens.revokeFamily(current.familyId(), now);
            log.warn("Refresh token reuse detected; revoked {} token(s) of the session", revoked);
            throw fail(Reason.TOKEN_REUSED);
        }
        if (current.isExpired(now)) throw fail(Reason.TOKEN_EXPIRED);

        AppUser user = users.findById(current.userId()).orElseThrow(() -> fail(Reason.TOKEN_INVALID));
        if (!user.canLogIn()) {
            tokens.revokeFamily(current.familyId(), now);
            throw fail(Reason.ACCOUNT_DISABLED);
        }
        Issued next = issue(user, current.familyId(), now);
        current.rotate(now, next.refreshId());
        return next.pair();
    }

    /** Ends the session of this refresh token. Unknown tokens are ignored (idempotent). */
    @Transactional
    public void logout(String refreshToken) {
        if (!RefreshTokenCodec.looksValid(refreshToken)) return;
        tokens.findForUpdate(RefreshTokenCodec.hash(refreshToken))
                .ifPresent(t -> tokens.revokeFamily(t.familyId(), clock.instant()));
    }

    private record Issued(TokenPair pair, UUID refreshId) {}

    private Issued issue(AppUser user, UUID family, Instant now) {
        String refresh = RefreshTokenCodec.newToken();
        RefreshToken stored = tokens.save(new RefreshToken(
                user.id(), family, RefreshTokenCodec.hash(refresh), now, now.plus(props.refreshTokenTtl())));
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(props.issuer())
                .subject(user.id().toString())
                .issuedAt(now)
                .expiresAt(now.plus(props.accessTokenTtl()))
                .id(UUID.randomUUID().toString())
                .claim("roles", user.roles().stream().map(Role::name).sorted().toList())
                .build();
        String access = jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new Issued(new TokenPair(access, props.accessTokenTtl().toSeconds(), refresh,
                props.refreshTokenTtl().toSeconds()), stored.id());
    }

    private static AuthenticationFailedException fail(Reason reason) {
        log.info("Authentication failed: {}", reason);
        return new AuthenticationFailedException(reason);
    }
}
