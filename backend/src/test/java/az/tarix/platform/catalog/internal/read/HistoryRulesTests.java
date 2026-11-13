package az.tarix.platform.catalog.internal.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.catalog.internal.read.CompareReader.Intersection;
import az.tarix.platform.catalog.internal.read.CompareReader.Lane;
import az.tarix.platform.catalog.internal.read.CompareReader.LaneEvent;
import az.tarix.platform.catalog.internal.read.CompareReader.Reason;
import az.tarix.platform.catalog.internal.read.HistoryIndex.IndexEvent;
import az.tarix.platform.catalog.internal.read.HistoryIndex.IndexLocation;
import az.tarix.platform.chronology.api.Chronology;
import az.tarix.platform.chronology.api.Chronology.Era;
import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.DatePrecision;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.ApiDate;
import az.tarix.platform.shared.read.EntityLinks;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.Lang;
import java.time.MonthDay;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Rules of the cross-simulation queries that need no database. */
class HistoryRulesTests {

    // --- eras ------------------------------------------------------------------------------

    static final Era AGQOYUNLU = new Era("agqoyunlu", null, 1378, 1503, "turkman-tebriz", null);
    static final Era SEFEVI = new Era("sefevi", null, 1501, 1736, "sefevi", null);

    @Test
    void ofOverlappingErasTheOneThatBeganLastWins() {
        assertThat(Chronology.eraFor(List.of(AGQOYUNLU, SEFEVI), 1500)).isEqualTo(AGQOYUNLU);
        assertThat(Chronology.eraFor(List.of(AGQOYUNLU, SEFEVI), 1502)).isEqualTo(SEFEVI);
        assertThat(Chronology.eraFor(List.of(SEFEVI, AGQOYUNLU), 1502)).isEqualTo(SEFEVI);
        assertThat(Chronology.eraFor(List.of(AGQOYUNLU, SEFEVI), 1300)).isNull();
    }

    // --- on this day -----------------------------------------------------------------------

    @Test
    void onThisDayTakesRealCalendarDaysIncludingTheLeapDay() {
        assertThat(TimelineReader.monthDay(2, 29)).isEqualTo(MonthDay.of(2, 29));
        assertThat(TimelineReader.monthDay(12, 31)).isEqualTo(MonthDay.of(12, 31));
        assertThatThrownBy(() -> TimelineReader.monthDay(2, 30)).isInstanceOf(InvalidParameterException.class);
        assertThatThrownBy(() -> TimelineReader.monthDay(6, 31)).isInstanceOf(InvalidParameterException.class);
        assertThatThrownBy(() -> TimelineReader.monthDay(0, 1)).isInstanceOf(InvalidParameterException.class);
        assertThatThrownBy(() -> TimelineReader.monthDay(null, 1)).isInstanceOf(InvalidParameterException.class);
    }

    // --- compare ---------------------------------------------------------------------------

    @Test
    void compareTakesASimulationOwnerAsTypeAndSlug() {
        assertThat(CompareReader.parse("a", "person:shah-ismayil")).isEqualTo(new EntityLinks.Target(EntityType.PERSON, "shah-ismayil"));
        assertThat(CompareReader.parse("a", " STATE:afshar ")).isEqualTo(new EntityLinks.Target(EntityType.STATE, "afshar"));
        for (String bad : new String[] {null, "", "shah-ismayil", "person:", "person:a:b", "nobody:x", "place:tebriz"}) {
            assertThatThrownBy(() -> CompareReader.parse("a", bad)).as(bad).isInstanceOf(InvalidParameterException.class);
        }
    }

    @Test
    void distanceIsTheFrontendsGreatCircle() {
        // Təbriz – Ərdəbil, about 175 km.
        assertThat(CompareReader.distanceKm(38.08, 46.2919, 38.2498, 48.2933)).isBetween(170.0, 180.0);
        assertThat(CompareReader.distanceKm(38, 46, 38, 46)).isZero();
    }

    static IndexEvent event(String stepKey, int year, String place, double lat, double lng) {
        return new IndexEvent("person:x:" + stepKey, EntityType.PERSON, "x", null, HistoryIndex.Category.PERSON, stepKey, null, null,
                null, null, new ApiDate(year, null, null, DatePrecision.YEAR, Certainty.EXACT, null, null),
                new IndexLocation(place, null, lat, lng, null), null, null, null);
    }

    static Lane lane(LaneEvent... events) {
        return new Lane(EntityType.PERSON, "x", null, events[0].event().date().year(), events[events.length - 1].event().date().year(),
                List.of(events));
    }

    static final EntityLinks.Resolved NO_NAMES = new EntityLinks.Resolved(Map.of(), Map.of());

    @Test
    void stepsMeetAtTheSamePlaceOrWithin25KmInTheSameYear() {
        Lane a = lane(new LaneEvent(event("a1", 1514, "tebriz", 38.08, 46.29), List.of()),
                new LaneEvent(event("a2", 1520, null, 40.0, 45.0), List.of()));
        Lane b = lane(new LaneEvent(event("b1", 1514, "tebriz", 38.30, 46.29), List.of()),   // same place, 24 km away
                new LaneEvent(event("b2", 1515, "tebriz", 38.08, 46.29), List.of()),         // same place, another year
                new LaneEvent(event("b3", 1520, null, 40.2, 45.0), List.of()));              // no place, 22 km away
        List<Intersection> meet = CompareReader.intersections(a, b, NO_NAMES, Lang.AZ);
        assertThat(meet).extracting(i -> i.a() + "/" + i.b()).containsExactly("a1/b1", "a2/b3");
        assertThat(meet.get(0).place()).isEqualTo("tebriz");
        assertThat(meet.get(1).place()).isNull();
        assertThat(meet.get(1).distanceKm()).isLessThan(25);

        Lane far = lane(new LaneEvent(event("c1", 1520, null, 40.3, 45.0), List.of()));     // 33 km
        assertThat(CompareReader.intersections(a, far, NO_NAMES, Lang.AZ)).isEmpty();
    }

    @Test
    void aSharedBattleMeetsWhateverTheYearAndIsListedOnceWithThePlace() {
        Lane a = lane(new LaneEvent(event("a1", 1738, "kandahar", 31.6, 65.7), List.of("kandahar-1738")));
        Lane b = lane(new LaneEvent(event("b1", 1738, "kandahar", 31.6, 65.7), List.of("kandahar-1738")),
                new LaneEvent(event("b2", 1740, null, 0, 0), List.of("kandahar-1738")));
        List<Intersection> meet = CompareReader.intersections(a, b, NO_NAMES, Lang.AZ);
        assertThat(meet).hasSize(2);
        assertThat(meet.get(0).reasons()).containsExactly(Reason.PLACE, Reason.BATTLE);
        assertThat(meet.get(1).reasons()).containsExactly(Reason.BATTLE);
        assertThat(meet.get(1).battle().slug()).isEqualTo("kandahar-1738");
        assertThat(meet.get(1).battle().available()).isFalse();
    }

    @Test
    void lanesOverlapOnlyWhenTheirYearsDo() {
        Lane a = lane(new LaneEvent(event("a1", 1425, null, 0, 0), List.of()), new LaneEvent(event("a2", 1478, null, 0, 0), List.of()));
        Lane b = lane(new LaneEvent(event("b1", 1487, null, 0, 0), List.of()), new LaneEvent(event("b2", 1524, null, 0, 0), List.of()));
        Lane c = lane(new LaneEvent(event("c1", 1470, null, 0, 0), List.of()), new LaneEvent(event("c2", 1490, null, 0, 0), List.of()));
        assertThat(CompareReader.overlap(a, b)).isNull();
        assertThat(CompareReader.overlap(a, c)).isEqualTo(new CompareReader.Overlap(1470, 1478));
    }
}
