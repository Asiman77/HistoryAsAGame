package az.tarix.platform.identity.internal.service;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** Password hashing and access token signing/verification. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(IdentityProperties.class)
class TokenConfiguration {

    /** Clock skew tolerated when checking exp/nbf of access tokens. */
    static final Duration CLOCK_SKEW = Duration.ofSeconds(30);

    /**
     * Argon2id with the OWASP minimum (m = 19 MiB, t = 2, p = 1), 16-byte salt, 32-byte hash.
     * Stored hashes carry their parameters, so they can be raised later; older hashes are
     * upgraded on the next successful login.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new Argon2PasswordEncoder(16, 32, 1, 19 * 1024, 2);
    }

    @Bean
    JwtEncoder jwtEncoder(IdentityProperties props) {
        return new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(key(props)));
    }

    @Bean
    JwtDecoder jwtDecoder(IdentityProperties props, Clock clock) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key(props)).macAlgorithm(MacAlgorithm.HS256).build();
        JwtTimestampValidator timestamps = new JwtTimestampValidator(CLOCK_SKEW);
        timestamps.setClock(clock);
        List<OAuth2TokenValidator<Jwt>> validators = List.of(
                timestamps,
                new JwtIssuerValidator(props.issuer()),
                // Refuse tokens without an expiry; ours always have one.
                new JwtClaimValidator<Object>("exp", exp -> exp != null),
                new JwtClaimValidator<Object>("sub", sub -> sub != null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        return decoder;
    }

    private static SecretKey key(IdentityProperties props) {
        return new SecretKeySpec(props.jwtSecretBytes(), "HmacSHA256");
    }
}
