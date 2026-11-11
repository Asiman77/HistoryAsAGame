package az.tarix.platform.identity.internal.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class RefreshTokenCodecTests {

    @Test
    void generatesUniqueUrlSafeTokensOf256Bits() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            String token = RefreshTokenCodec.newToken();
            assertThat(RefreshTokenCodec.looksValid(token)).isTrue();
            assertThat(seen.add(token)).isTrue();
        }
    }

    @Test
    void hashesWithSha256() {
        String token = RefreshTokenCodec.newToken();
        assertThat(RefreshTokenCodec.hash(token)).hasSize(32).isEqualTo(RefreshTokenCodec.hash(token));
        assertThat(RefreshTokenCodec.hash(token)).isNotEqualTo(RefreshTokenCodec.hash(RefreshTokenCodec.newToken()));
    }

    @Test
    void rejectsMalformedTokensBeforeTheDatabase() {
        assertThat(RefreshTokenCodec.looksValid(null)).isFalse();
        assertThat(RefreshTokenCodec.looksValid("abc")).isFalse();
        assertThat(RefreshTokenCodec.looksValid("'; DROP TABLE refresh_token; --".repeat(2))).isFalse();
    }
}
