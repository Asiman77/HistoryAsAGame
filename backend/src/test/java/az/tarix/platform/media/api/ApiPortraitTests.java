package az.tarix.platform.media.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Same cases as the frontend's {@code pickPortrait}. */
class ApiPortraitTests {

    static ApiPortrait portrait(int from, int to) {
        return new ApiPortrait(from, to, "AI_ILLUSTRATION", null, null, null, null, null, null, null, null, from + "-" + to);
    }

    final List<ApiPortrait> portraits = List.of(portrait(0, 6), portrait(7, 13), portrait(14, 22), portrait(30, 37));

    @Test
    void theRangeContainingTheAgeWins() {
        assertThat(ApiPortrait.pick(portraits, 0).promptId()).isEqualTo("0-6");
        assertThat(ApiPortrait.pick(portraits, 13).promptId()).isEqualTo("7-13");
        assertThat(ApiPortrait.pick(portraits, 14).promptId()).isEqualTo("14-22");
    }

    @Test
    void otherwiseTheNearestRangeAndTheFirstOnATie() {
        assertThat(ApiPortrait.pick(portraits, 24).promptId()).isEqualTo("14-22");
        assertThat(ApiPortrait.pick(portraits, 26).promptId()).isEqualTo("14-22");   // 4 years from both: the first wins
        assertThat(ApiPortrait.pick(portraits, 28).promptId()).isEqualTo("30-37");
        assertThat(ApiPortrait.pick(portraits, 60).promptId()).isEqualTo("30-37");
    }

    @Test
    void noPortraitsNoPick() {
        assertThat(ApiPortrait.pick(List.of(), 10)).isNull();
    }
}
