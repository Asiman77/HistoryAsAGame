package az.tarix.platform.catalog.internal.read;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.catalog.internal.read.WorldEventReader.WorldEventView;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The frontend's pickWorldEvents (src/lib/worldContext.ts), on the same kind of cases. */
class WorldEventRulesTests {

    static WorldEventView e(String slug, int year, Integer end, String region) {
        return new WorldEventView(slug, year, end, region, null, null, List.of());
    }

    @Test
    void theGapIsZeroInsideTheSpanAndCountsYearsOutside() {
        WorldEventView voyages = e("zheng-he-voyages", 1405, 1433, "ASIA");
        assertThat(WorldEventReader.gap(voyages, 1420)).isZero();
        assertThat(WorldEventReader.gap(voyages, 1400)).isEqualTo(5);
        assertThat(WorldEventReader.gap(voyages, 1440)).isEqualTo(7);
    }

    @Test
    void nearestFirstOneRegionEachThenTheRestChronologically() {
        List<WorldEventView> events = List.of(
                e("a-europe", 1510, null, "EUROPE"),
                e("b-europe", 1514, null, "EUROPE"),
                e("c-asia", 1520, null, "ASIA"),
                e("d-africa", 1530, null, "AFRICA"),     // 16 years away: outside the window
                e("e-americas", 1513, null, "AMERICAS"));
        // Nearest: b (0), e (1), a (4), c (6). Regions first: b, e, then c (ASIA) before a second EUROPE.
        assertThat(WorldEventReader.pick(1514, events, 3)).extracting(WorldEventView::slug)
                .containsExactly("e-americas", "b-europe", "c-asia");
        assertThat(WorldEventReader.pick(1514, events, 4)).extracting(WorldEventView::slug)
                .containsExactly("a-europe", "e-americas", "b-europe", "c-asia");
        assertThat(WorldEventReader.pick(1300, events, 3)).isEmpty();
    }
}
