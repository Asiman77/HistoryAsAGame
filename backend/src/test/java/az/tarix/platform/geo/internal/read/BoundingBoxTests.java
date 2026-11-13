package az.tarix.platform.geo.internal.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.geo.internal.read.PlaceReader.BoundingBox;
import az.tarix.platform.shared.read.InvalidParameterException;
import org.junit.jupiter.api.Test;

class BoundingBoxTests {

    @Test
    void parsesMinLngMinLatMaxLngMaxLat() {
        assertThat(BoundingBox.parse("44.5, 38, 50.9,42.1")).isEqualTo(new BoundingBox(44.5, 38, 50.9, 42.1));
        assertThat(BoundingBox.parse(null)).isNull();
        assertThat(BoundingBox.parse(" ")).isNull();
    }

    @Test
    void rejectsMalformedOrInvertedBoxes() {
        for (String bad : new String[] {"1,2,3", "a,2,3,4", "1,2,3,NaN", "-181,0,0,0", "0,-91,0,0", "10,0,5,1", "0,10,1,5"}) {
            assertThatThrownBy(() -> BoundingBox.parse(bad)).as(bad).isInstanceOf(InvalidParameterException.class);
        }
    }
}
