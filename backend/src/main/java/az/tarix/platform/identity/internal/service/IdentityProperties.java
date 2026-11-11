package az.tarix.platform.identity.internal.service;

import java.time.Duration;
import java.util.Base64;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code platform.identity.*}. Secrets come only from the environment
 * ({@code JWT_SECRET}, {@code ADMIN_EMAIL}, {@code ADMIN_PASSWORD}); there are no defaults
 * for them, and startup fails without a JWT secret.
 *
 * @param jwtSecret       Base64 HMAC key for access tokens, at least 256 bits
 * @param issuer          {@code iss} claim of access tokens
 * @param accessTokenTtl  access token lifetime (15 minutes)
 * @param refreshTokenTtl refresh token lifetime (14 days), renewed on each rotation
 * @param admin           first admin account, created at startup if it does not exist
 */
@ConfigurationProperties("platform.identity")
public record IdentityProperties(
        String jwtSecret,
        @DefaultValue("tarix-platform") String issuer,
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue("14d") Duration refreshTokenTtl,
        @DefaultValue Admin admin) {

    public static final int MIN_SECRET_BYTES = 32;

    public IdentityProperties {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET is not set (Base64, at least 32 bytes; e.g. `openssl rand -base64 48`)");
        }
        if (secretBytes(jwtSecret).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("JWT_SECRET must decode to at least " + MIN_SECRET_BYTES + " bytes");
        }
        if (accessTokenTtl.isNegative() || accessTokenTtl.isZero() || refreshTokenTtl.compareTo(accessTokenTtl) <= 0) {
            throw new IllegalStateException("token lifetimes must be positive and refresh > access");
        }
    }

    public byte[] jwtSecretBytes() {
        return secretBytes(jwtSecret);
    }

    private static byte[] secretBytes(String secret) {
        try {
            return Base64.getDecoder().decode(secret.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("JWT_SECRET is not valid Base64", e);
        }
    }

    /** Bootstrap admin; both values empty means "do not create one". */
    public record Admin(String email, String password, @DefaultValue("Administrator") String displayName) {

        public boolean configured() {
            return email != null && !email.isBlank();
        }
    }
}
