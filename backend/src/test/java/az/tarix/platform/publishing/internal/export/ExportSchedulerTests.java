package az.tarix.platform.publishing.internal.export;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.publishing.internal.export.ExportScheduler.ExportProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/** Publishes close together become one export; a steady stream still exports (BACKEND_SPEC.md §9.6). */
class ExportSchedulerTests {

    static final Instant T0 = Instant.parse("2026-11-14T10:00:00Z");

    /** A clock the test moves. */
    static final class MovingClock extends Clock {
        Instant now = T0;

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }

        void plus(int seconds) {
            now = now.plusSeconds(seconds);
        }
    }

    final MovingClock clock = new MovingClock();
    final ExportScheduler scheduler = new ExportScheduler(null,
            new ExportProperties(true, Duration.ofSeconds(30), Duration.ofMinutes(5)), clock);

    @Test
    void nothingPendingNothingToDo() {
        assertThat(scheduler.due(clock.instant())).isFalse();
    }

    @Test
    void waitsForThirtyQuietSeconds() {
        scheduler.changed();
        clock.plus(20);
        scheduler.changed();                 // a second publish resets the quiet time
        clock.plus(20);
        assertThat(scheduler.due(clock.instant())).isFalse();
        clock.plus(10);
        assertThat(scheduler.due(clock.instant())).isTrue();
        assertThat(scheduler.pending()).isNull();
        assertThat(scheduler.due(clock.instant())).isFalse();     // one export for both publishes
    }

    @Test
    void aSteadyStreamStillExportsAfterTheMaximumDelay() {
        scheduler.changed();
        for (int i = 0; i < 14; i++) {       // a publish every 20 s for 4 min 40 s
            clock.plus(20);
            scheduler.changed();
            assertThat(scheduler.due(clock.instant())).isFalse();
        }
        clock.plus(20);
        scheduler.changed();
        assertThat(scheduler.due(clock.instant())).isTrue();
    }

    @Test
    void disabledIgnoresChanges() {
        ExportScheduler off = new ExportScheduler(null, new ExportProperties(false, Duration.ofSeconds(30), Duration.ofMinutes(5)), clock);
        off.changed();
        clock.plus(3600);
        assertThat(off.due(clock.instant())).isFalse();
    }
}
