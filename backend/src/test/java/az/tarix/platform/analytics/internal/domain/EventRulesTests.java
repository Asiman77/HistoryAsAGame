package az.tarix.platform.analytics.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.analytics.internal.domain.EventRules.Accepted;
import az.tarix.platform.analytics.internal.domain.EventRules.Rejected;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Which fields each event type may carry, and how it is stored (BACKEND_SPEC.md §12). */
class EventRulesTests {

    static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");

    static IncomingEvent event(String type, String ownerType, String ownerSlug, String stepKey) {
        return new IncomingEvent(type, NOW, ownerType, ownerSlug, stepKey, null, null, null, null, null, null, null, null, null);
    }

    static IncomingEvent quiz(Integer question, Boolean correct) {
        return new IncomingEvent("quiz_answered", NOW, "person", "shah-ismayil", "ismayil-chaldiran", question, correct, null, null,
                null, null, null, null, null);
    }

    @Test
    void aStepEventNeedsItsOwnerAndStep() throws Rejected {
        Accepted a = EventRules.check(event("step_viewed", "Person", "shah-ismayil", "ismayil-birth"), NOW);
        assertThat(a).extracting(Accepted::type, Accepted::ownerType, Accepted::ownerSlug, Accepted::stepKey, Accepted::detail)
                .containsExactly(EventType.STEP_VIEWED, "PERSON", "shah-ismayil", "ismayil-birth", "");
        assertThatThrownBy(() -> EventRules.check(event("step_viewed", "person", "shah-ismayil", null), NOW))
                .hasMessageContaining("needs stepKey");
        assertThatThrownBy(() -> EventRules.check(event("simulation_started", null, null, null), NOW))
                .hasMessageContaining("needs ownerType");
        assertThatThrownBy(() -> EventRules.check(event("step_viewed", "battle", "chaldiran", "x"), NOW))
                .hasMessageContaining("person, conflict or state");
        assertThatThrownBy(() -> EventRules.check(event("step_viewed", "person", "Şah İsmayıl", "x"), NOW))
                .hasMessageContaining("not a slug");
        assertThatThrownBy(() -> EventRules.check(event("page_viewed", null, null, null), NOW)).hasMessageContaining("unknown type");
    }

    @Test
    void quizAnswersKeepOnlyTheQuestionAndCorrectness() throws Rejected {
        Accepted a = EventRules.check(quiz(1, false), NOW);
        assertThat(a.detail()).isEqualTo("q1");
        assertThat(a.payload()).isEqualTo(Map.of("correct", false));
        assertThatThrownBy(() -> EventRules.check(quiz(null, true), NOW)).hasMessageContaining("questionIndex is required");
        assertThatThrownBy(() -> EventRules.check(quiz(7, true), NOW)).hasMessageContaining("questionIndex 0–4");
        assertThatThrownBy(() -> EventRules.check(quiz(0, null), NOW)).hasMessageContaining("correct is required");
    }

    @Test
    void aFieldOfAnotherTypeIsRefused() {
        IncomingEvent viewedWithAnswer = new IncomingEvent("step_viewed", NOW, "person", "shah-ismayil", "ismayil-birth", null, true,
                null, null, null, null, null, null, null);
        assertThatThrownBy(() -> EventRules.check(viewedWithAnswer, NOW)).hasMessage("step_viewed has no correct");
        IncomingEvent sliderWithOwner = new IncomingEvent("time_slider_used", NOW, "person", "shah-ismayil", null, null, null, null,
                null, null, null, null, null, 1501);
        assertThatThrownBy(() -> EventRules.check(sliderWithOwner, NOW)).hasMessage("time_slider_used has no owner");
    }

    @Test
    void detailsOfTheOtherTypes() throws Rejected {
        assertThat(EventRules.check(new IncomingEvent("choice_made", NOW, "state", "afshar", "nadir-delhi", null, null, 2, null, null,
                null, null, null, null), NOW).detail()).isEqualTo("o2");
        assertThat(EventRules.check(new IncomingEvent("mode_switched", NOW, null, null, null, null, null, null, "learn", null, null,
                null, null, null), NOW).detail()).isEqualTo("learn");
        assertThatThrownBy(() -> EventRules.check(new IncomingEvent("mode_switched", NOW, null, null, null, null, null, null, "quiz",
                null, null, null, null, null), NOW)).hasMessageContaining("story or learn");
        assertThat(EventRules.check(new IncomingEvent("cross_link_followed", NOW, "person", "shah-ismayil", "ismayil-chaldiran", null,
                null, null, null, null, "Battle", "chaldiran", null, null), NOW).detail()).isEqualTo("battle:chaldiran");
        assertThat(EventRules.check(new IncomingEvent("legend_toggle", NOW, null, null, null, null, null, null, null, null, null, null,
                false, null), NOW).detail()).isEqualTo("hidden");
        assertThat(EventRules.check(new IncomingEvent("time_slider_used", NOW, null, null, null, null, null, null, null, null, null,
                null, null, 1501), NOW).detail()).isEqualTo("1501");
        Accepted completed = EventRules.check(new IncomingEvent("simulation_completed", NOW, "conflict", "karabakh-war-2020", null, null,
                null, null, null, 600_000L, null, null, null, null), NOW);
        assertThat(completed.payload()).isEqualTo(Map.of("durationMs", 600_000L));
        assertThatThrownBy(() -> EventRules.check(new IncomingEvent("simulation_completed", NOW, "conflict", "karabakh-war-2020", null,
                null, null, null, null, 7_200_000L, null, null, null, null), NOW)).hasMessageContaining("durationMs");
    }

    @Test
    void implausibleClientTimesBecomeTheReceivingTime() {
        assertThat(EventRules.occurredAt(NOW.minus(Duration.ofHours(47)), NOW)).isEqualTo(NOW.minus(Duration.ofHours(47)));
        assertThat(EventRules.occurredAt(NOW.minus(Duration.ofDays(3)), NOW)).isEqualTo(NOW);
        assertThat(EventRules.occurredAt(NOW.plus(Duration.ofHours(1)), NOW)).isEqualTo(NOW);
        assertThat(EventRules.occurredAt(null, NOW)).isEqualTo(NOW);
    }
}
