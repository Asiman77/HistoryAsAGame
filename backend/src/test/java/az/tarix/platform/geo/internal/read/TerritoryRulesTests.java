package az.tarix.platform.geo.internal.read;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.geo.api.Territories.MembershipSpan;
import az.tarix.platform.geo.api.Territories.MembershipSpan.Kind;
import az.tarix.platform.geo.api.Territories.SnapshotPick;
import az.tarix.platform.geo.internal.read.JdbcTerritories.Seen;
import az.tarix.platform.geo.internal.read.JdbcTerritories.Snapshot;
import az.tarix.platform.shared.domain.Certainty;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The year rules of the political map, the same as the frontend's {@code snapshotForYear} / {@code placeMembership}. */
class TerritoryRulesTests {

    static final Snapshot Y1520 = new Snapshot("y1520", 1520);
    static final Snapshot Y1700 = new Snapshot("y1700", 1700);

    @Test
    void aSnapshotCoversItsYearAndThirtyMore() {
        assertThat(JdbcTerritories.choose(1520, Y1520, Y1700)).isEqualTo(new SnapshotPick("y1520", 1520, true, null, null));
        assertThat(JdbcTerritories.choose(1550, Y1520, Y1700).covered()).isTrue();
        assertThat(JdbcTerritories.choose(1551, Y1520, Y1700).covered()).isFalse();
    }

    @Test
    void inAGapTheNearestSnapshotIsOfferedWithJumpYears() {
        assertThat(JdbcTerritories.choose(1600, Y1520, Y1700)).isEqualTo(new SnapshotPick("y1520", 1520, false, 1550, 1700));
        assertThat(JdbcTerritories.choose(1650, Y1520, Y1700)).isEqualTo(new SnapshotPick("y1700", 1700, false, 1550, 1700));
        // Equally far: the earlier one, as in the frontend.
        assertThat(JdbcTerritories.choose(1610, Y1520, Y1700).slug()).isEqualTo("y1520");
    }

    @Test
    void beforeTheFirstAndWithoutAnySnapshot() {
        assertThat(JdbcTerritories.choose(1300, null, Y1520)).isEqualTo(new SnapshotPick("y1520", 1520, false, null, 1520));
        assertThat(JdbcTerritories.choose(1300, null, null)).isEqualTo(SnapshotPick.NONE);
        // After the last one, beyond its reach.
        assertThat(JdbcTerritories.choose(1800, Y1700, null)).isEqualTo(new SnapshotPick("y1700", 1700, false, 1730, null));
    }

    static Seen held(int year, String polity, String capital) {
        return new Seen(year, Certainty.APPROXIMATE, polity, null, "#000000", capital, null);
    }

    static String describe(MembershipSpan s) {
        return s.kind() == Kind.GAP ? "gap " + s.fromYear() + "-" + s.toYear()
                : s.politySlug() + " " + s.fromYear() + "-" + s.toYear() + (s.capital() ? " capital" : "");
    }

    @Test
    void consecutiveSnapshotsWithTheSameOwnerMerge() {
        List<MembershipSpan> spans = JdbcTerritories.spans("tebriz", List.of(
                held(1440, "qaraqoyunlu", "tebriz"), held(1460, "qaraqoyunlu", "tebriz"), held(1468, "agqoyunlu", null),
                held(1472, "agqoyunlu", "tebriz")));
        // The capital flag splits a span; the last snapshot reaches only its own year.
        assertThat(spans.stream().map(TerritoryRulesTests::describe))
                .containsExactly("qaraqoyunlu 1440-1467 capital", "agqoyunlu 1468-1471", "agqoyunlu 1472-1472 capital");
    }

    @Test
    void stretchesNoSnapshotReachesBecomeGaps() {
        List<MembershipSpan> spans = JdbcTerritories.spans("x", List.of(held(1520, "safavid", null), held(1700, "safavid", null)));
        assertThat(spans.stream().map(TerritoryRulesTests::describe)).containsExactly("safavid 1520-1550", "gap 1551-1699",
                "safavid 1700-1700");
    }

    @Test
    void aSnapshotWithoutAnOwnerLeavesNoSpan() {
        List<MembershipSpan> spans = JdbcTerritories.spans("x", List.of(held(1520, null, null), held(1530, "safavid", null)));
        assertThat(spans.stream().map(TerritoryRulesTests::describe)).containsExactly("safavid 1530-1530");
    }

    @Test
    void onlyTheYearsThePlaceExistedRemainWithoutEdgeGaps() {
        List<MembershipSpan> spans = JdbcTerritories.spans("shusha", List.of(held(1700, "safavid", null),
                held(1750, "karabakh-kh", "shusha"), held(1800, "karabakh-kh", "shusha")));
        assertThat(spans.stream().map(TerritoryRulesTests::describe))
                .containsExactly("safavid 1700-1730", "gap 1731-1749", "karabakh-kh 1750-1780 capital", "gap 1781-1799",
                        "karabakh-kh 1800-1800 capital");
        assertThat(JdbcTerritories.clip(spans, 1752, 2020).stream().map(TerritoryRulesTests::describe))
                .containsExactly("karabakh-kh 1752-1780 capital", "gap 1781-1799", "karabakh-kh 1800-1800 capital");
        assertThat(JdbcTerritories.clip(spans, 1735, 1790).stream().map(TerritoryRulesTests::describe))
                .containsExactly("karabakh-kh 1750-1780 capital");
    }
}
