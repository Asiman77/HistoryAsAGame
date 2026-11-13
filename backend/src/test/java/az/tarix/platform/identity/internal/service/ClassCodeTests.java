package az.tarix.platform.identity.internal.service;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.identity.api.ClassGroups;
import java.time.Clock;
import java.util.HashSet;
import java.util.Set;
import java.util.SplittableRandom;
import org.junit.jupiter.api.Test;

class ClassCodeTests {

    @Test
    void codesUseSixCharactersWithoutLookAlikes() {
        ClassService service = new ClassService(null, Clock.systemUTC(), new SplittableRandom(42));
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            String code = service.newCode();
            assertThat(code).hasSize(6).matches("[A-HJKMNP-Z2-9]{6}").doesNotContain("0", "O", "1", "I", "L");
            seen.add(code);
        }
        assertThat(seen).hasSizeGreaterThan(9_990);
        assertThat(ClassGroups.ALPHABET).hasSize(31);
    }

    @Test
    void typedCodesAreNormalizedAndNonsenseIsRejected() {
        assertThat(ClassGroups.normalize(" k7mq2x ")).isEqualTo("K7MQ2X");
        assertThat(ClassGroups.normalize("K7MQ2")).isNull();
        assertThat(ClassGroups.normalize("K7MQ2XY")).isNull();
        assertThat(ClassGroups.normalize("K0MQ2X")).isNull();
        assertThat(ClassGroups.normalize("K7MQ2'")).isNull();
        assertThat(ClassGroups.normalize(null)).isNull();
    }
}
