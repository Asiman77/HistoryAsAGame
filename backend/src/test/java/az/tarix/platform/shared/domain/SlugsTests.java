package az.tarix.platform.shared.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class SlugsTests {

    @Test
    void validatesTheSlugPattern() {
        assertThat(Slugs.isValid("shah-ismayil")).isTrue();
        assertThat(Slugs.isValid("y1501")).isTrue();
        assertThat(Slugs.isValid("Shah-Ismayil")).isFalse();
        assertThat(Slugs.isValid("shah--ismayil")).isFalse();
        assertThat(Slugs.isValid("-shah")).isFalse();
        assertThat(Slugs.isValid("şah")).isFalse();
        assertThat(Slugs.isValid("a".repeat(121))).isFalse();
        assertThat(Slugs.isValid(null)).isFalse();
    }

    @Test
    void transliteratesAzerbaijaniLetters() {
        // Matches existing slugs in data/: shah-ismayil, efshar, sefevi, muasir, chaldiran, mughan.
        assertThat(Slugs.suggest("Şah İsmayıl")).isEqualTo("shah-ismayil");
        assertThat(Slugs.suggest("Əfşar")).isEqualTo("efshar");
        assertThat(Slugs.suggest("Səfəvi")).isEqualTo("sefevi");
        assertThat(Slugs.suggest("Müasir")).isEqualTo("muasir");
        assertThat(Slugs.suggest("Çaldıran döyüşü (1514)")).isEqualTo("chaldiran-doyushu-1514");
        assertThat(Slugs.suggest("Muğan qurultayı")).isEqualTo("mughan-qurultayi");
        assertThat(Slugs.suggest("ŞUŞA")).isEqualTo("shusha");
    }

    @Test
    void dropsOtherAccentsAndPunctuation() {
        assertThat(Slugs.suggest("  Erzincan / Erzurum — 1473!  ")).isEqualTo("erzincan-erzurum-1473");
        assertThat(Slugs.suggest("Contarini’s journey")).isEqualTo("contarini-s-journey");
        assertThat(Slugs.suggest("Bagration-Mukhrani, Élise")).isEqualTo("bagration-mukhrani-elise");
    }

    @Test
    void keepsSuggestionsWithinTheLengthLimit() {
        String slug = Slugs.suggest("söz ".repeat(60));
        assertThat(slug.length()).isLessThanOrEqualTo(120);
        assertThat(Slugs.isValid(slug)).isTrue();
    }

    @Test
    void refusesTitlesWithoutLettersOrDigits() {
        assertThatThrownBy(() -> Slugs.suggest("—")).isInstanceOf(IllegalArgumentException.class);
    }
}
