package az.tarix.platform.identity.internal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class IdentityPropertiesTests {

    static final IdentityProperties.Admin NO_ADMIN = new IdentityProperties.Admin(null, null, "Administrator");
    static final String GOOD_SECRET = Base64.getEncoder().encodeToString(new byte[32]);

    static IdentityProperties props(String secret) {
        return new IdentityProperties(secret, "tarix-platform", Duration.ofMinutes(15), Duration.ofDays(14), NO_ADMIN);
    }

    @Test
    void requiresAJwtSecretOfAtLeast256Bits() {
        assertThatThrownBy(() -> props(null)).hasMessageContaining("JWT_SECRET is not set");
        assertThatThrownBy(() -> props("")).hasMessageContaining("JWT_SECRET is not set");
        assertThatThrownBy(() -> props(Base64.getEncoder().encodeToString(new byte[31]))).hasMessageContaining("32 bytes");
        assertThatThrownBy(() -> props("not base64 !!")).hasMessageContaining("Base64");
        assertThat(props(GOOD_SECRET).jwtSecretBytes()).hasSize(32);
    }

    @Test
    void requiresSensibleLifetimes() {
        assertThatThrownBy(() -> new IdentityProperties(GOOD_SECRET, "i", Duration.ZERO, Duration.ofDays(1), NO_ADMIN))
                .hasMessageContaining("lifetimes");
        assertThatThrownBy(() -> new IdentityProperties(GOOD_SECRET, "i", Duration.ofHours(2), Duration.ofHours(1), NO_ADMIN))
                .hasMessageContaining("lifetimes");
    }

    @Test
    void adminIsOptional() {
        assertThat(NO_ADMIN.configured()).isFalse();
        assertThat(new IdentityProperties.Admin("a@b.az", "x", "A").configured()).isTrue();
    }
}
