package az.tarix.platform.shared.domain;

import static az.tarix.platform.shared.domain.Certainty.APPROXIMATE;
import static az.tarix.platform.shared.domain.Certainty.DISPUTED;
import static az.tarix.platform.shared.domain.Certainty.EXACT;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;

class HistoricalDateTests {

    @Test
    void derivesPrecisionFromTheGivenParts() {
        assertThat(HistoricalDate.of(1501, null, null, EXACT).precision()).isEqualTo(DatePrecision.YEAR);
        assertThat(HistoricalDate.of(1501, 7, null, EXACT).precision()).isEqualTo(DatePrecision.MONTH);
        assertThat(HistoricalDate.of(1501, 7, 17, EXACT).precision()).isEqualTo(DatePrecision.DAY);
    }

    @Test
    void rejectsDatesThatDoNotExist() {
        assertThatThrownBy(() -> HistoricalDate.of(1514, 2, 31, EXACT)).hasMessageContaining("no such day");
        assertThatThrownBy(() -> HistoricalDate.of(1514, 4, 31, EXACT)).hasMessageContaining("no such day");
        assertThatThrownBy(() -> HistoricalDate.of(1514, 13, null, EXACT)).hasMessageContaining("month");
        assertThatThrownBy(() -> HistoricalDate.of(1514, 0, null, EXACT)).hasMessageContaining("month");
        assertThatThrownBy(() -> HistoricalDate.of(1514, null, 5, EXACT)).hasMessageContaining("needs a month");
    }

    @Test
    void appliesProlepticGregorianLeapYearsIncludingBc() {
        assertThat(HistoricalDate.of(1600, 2, 29, EXACT).isLeapYear()).isTrue();
        assertThatThrownBy(() -> HistoricalDate.of(1700, 2, 29, EXACT)).hasMessageContaining("no such day");
        assertThat(HistoricalDate.of(2020, 2, 29, EXACT)).isNotNull();
        // Astronomical numbering: year 0 = 1 BC and -4 = 5 BC are leap years.
        assertThat(HistoricalDate.of(0, 2, 29, EXACT)).isNotNull();
        assertThat(HistoricalDate.of(-4, 2, 29, EXACT)).isNotNull();
        assertThatThrownBy(() -> HistoricalDate.of(-1, 2, 29, EXACT)).hasMessageContaining("no such day");
    }

    @Test
    void rejectsPrecisionThatContradictsTheParts() {
        assertThatThrownBy(() -> new HistoricalDate(1501, 7, null, DatePrecision.DAY, EXACT)).hasMessageContaining("precision");
        assertThatThrownBy(() -> new HistoricalDate(1501, 7, 1, DatePrecision.YEAR, EXACT)).hasMessageContaining("precision");
    }

    @Test
    void sortKeyOrdersChronologicallyAcrossEras() {
        HistoricalDate a = HistoricalDate.of(-501, 12, 31, EXACT);
        HistoricalDate b = HistoricalDate.of(-500, 1, 1, EXACT);
        HistoricalDate c = HistoricalDate.of(-500, 3, null, EXACT);
        HistoricalDate d = HistoricalDate.of(0, 6, null, EXACT);
        HistoricalDate e = HistoricalDate.of(1501, null, null, APPROXIMATE);
        HistoricalDate f = HistoricalDate.of(1501, 7, 17, EXACT);
        HistoricalDate g = HistoricalDate.of(2020, 11, 8, EXACT);
        assertThat(List.of(g, c, e, a, f, b, d).stream().sorted(Comparator.comparingLong(HistoricalDate::sortKey)))
                .containsExactly(a, b, c, d, e, f, g);
        assertThat(f.sortKey()).isEqualTo(15_010_717L);
    }

    @Test
    void comparesOnlyAtTheCommonPrecision() {
        HistoricalDate year = HistoricalDate.ofYear(1488, EXACT);
        HistoricalDate day = HistoricalDate.of(1488, 7, 9, EXACT);
        assertThat(year.compareAtCommonPrecision(day)).isZero();
        assertThat(day.compareAtCommonPrecision(HistoricalDate.of(1488, 8, null, EXACT))).isNegative();
        assertThat(day.compareAtCommonPrecision(HistoricalDate.ofYear(1487, EXACT))).isPositive();
    }

    /** Same cases as tests/unit/dates.test.ts, so backend and frontend ages agree. */
    @Test
    void ageMatchesTheFrontend() {
        HistoricalDate birth = HistoricalDate.of(1487, 7, 17, EXACT);
        assertThat(HistoricalDate.ageAt(birth, HistoricalDate.of(1501, 7, 1, EXACT)))
                .isEqualTo(new HistoricalDate.Age(13, false));
        assertThat(HistoricalDate.ageAt(birth, HistoricalDate.of(1501, 7, 20, EXACT)))
                .isEqualTo(new HistoricalDate.Age(14, false));
        assertThat(HistoricalDate.ageAt(birth, HistoricalDate.ofYear(1501, EXACT)).approximate()).isTrue();
        assertThat(HistoricalDate.ageAt(HistoricalDate.ofYear(1423, DISPUTED), HistoricalDate.of(1478, 1, null, EXACT)))
                .isEqualTo(new HistoricalDate.Age(55, true));
    }

    @Test
    void ageIsNeverNegative() {
        assertThat(HistoricalDate.ageAt(HistoricalDate.ofYear(1500, EXACT), HistoricalDate.ofYear(1490, EXACT)).years()).isZero();
    }
}
