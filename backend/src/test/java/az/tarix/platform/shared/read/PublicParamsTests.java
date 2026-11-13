package az.tarix.platform.shared.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class PublicParamsTests {

    @Test
    void yearsAreRequiredAndBounded() {
        assertThat(PublicParams.year("year", 1514)).isEqualTo(1514);
        assertThat(PublicParams.year("year", 0)).isZero();
        assertThatThrownBy(() -> PublicParams.year("year", null)).isInstanceOf(InvalidParameterException.class)
                .extracting(e -> ((InvalidParameterException) e).parameter()).isEqualTo("year");
        assertThatThrownBy(() -> PublicParams.year("year", PublicParams.MAX_YEAR + 1)).isInstanceOf(InvalidParameterException.class);
        assertThatThrownBy(() -> PublicParams.year("year", PublicParams.MIN_YEAR - 1)).isInstanceOf(InvalidParameterException.class);
    }

    @Test
    void coordinatesStayOnTheGlobe() {
        assertThat(PublicParams.latitude("lat", -90.0)).isEqualTo(-90);
        assertThat(PublicParams.longitude("lng", 180.0)).isEqualTo(180);
        assertThatThrownBy(() -> PublicParams.latitude("lat", 90.5)).isInstanceOf(InvalidParameterException.class);
        assertThatThrownBy(() -> PublicParams.longitude("lng", Double.NaN)).isInstanceOf(InvalidParameterException.class);
        assertThatThrownBy(() -> PublicParams.longitude("lng", null)).isInstanceOf(InvalidParameterException.class);
    }
}
