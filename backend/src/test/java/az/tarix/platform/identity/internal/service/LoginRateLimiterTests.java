package az.tarix.platform.identity.internal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.identity.internal.service.LoginLimitProperties.Limit;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class LoginRateLimiterTests {

    /** A clock the test moves by hand. */
    static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-14T10:00:00Z");

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

        void advance(Duration d) {
            now = now.plus(d);
        }
    }

    static LoginRateLimiter limiter(TestClock clock, long perAddress, long perAccount) {
        return new LoginRateLimiter(new LoginLimitProperties(new Limit(perAddress, Duration.ofMinutes(1)),
                new Limit(perAccount, Duration.ofMinutes(15)), 1000), clock);
    }

    @Test
    void anAccountGetsItsAttemptsThenWaitsForTheRefill() {
        TestClock clock = new TestClock();
        LoginRateLimiter limiter = limiter(clock, 100, 3);
        for (int i = 0; i < 3; i++) assertThat(limiter.tryAttempt("10.0.0.1", "a@test.invalid")).isEmpty();
        Duration wait = limiter.tryAttempt("10.0.0.1", "a@test.invalid").orElseThrow();
        // 3 attempts per 15 minutes: one comes back every 5 minutes.
        assertThat(wait).isBetween(Duration.ofMinutes(4), Duration.ofMinutes(5));

        // Another address does not help: the account's bucket is shared.
        assertThat(limiter.tryAttempt("10.0.0.2", "A@Test.Invalid ")).isPresent();
        // Another account is unaffected.
        assertThat(limiter.tryAttempt("10.0.0.1", "b@test.invalid")).isEmpty();

        clock.advance(Duration.ofMinutes(5));
        assertThat(limiter.tryAttempt("10.0.0.1", "a@test.invalid")).isEmpty();
        assertThat(limiter.tryAttempt("10.0.0.1", "a@test.invalid")).isPresent();
    }

    @Test
    void anAddressIsLimitedAcrossAccountsWithoutUsingTheirAttempts() {
        TestClock clock = new TestClock();
        LoginRateLimiter limiter = limiter(clock, 2, 5);
        assertThat(limiter.tryAttempt("10.0.0.9", "x1@test.invalid")).isEmpty();
        assertThat(limiter.tryAttempt("10.0.0.9", "x2@test.invalid")).isEmpty();
        Duration wait = limiter.tryAttempt("10.0.0.9", "victim@test.invalid").orElseThrow();
        assertThat(wait).isBetween(Duration.ofSeconds(1), Duration.ofSeconds(30));
        // The throttled attempt did not count against the victim's account.
        for (int i = 0; i < 5; i++) assertThat(limiter.tryAttempt("10.0.1." + i, "victim@test.invalid")).isEmpty();
    }

    @Test
    void theWaitIsWholeSecondsAndAtLeastOne() {
        TestClock clock = new TestClock();
        LoginRateLimiter limiter = limiter(clock, 1, 100);
        limiter.tryAttempt("10.0.0.3", "c@test.invalid");
        clock.advance(Duration.ofMillis(59_900));
        assertThat(limiter.tryAttempt("10.0.0.3", "c@test.invalid")).contains(Duration.ofSeconds(1));
    }

    @Test
    void unsetLimitsFallBackToTheDefaultsAndBadOnesFailAtStartup() {
        LoginLimitProperties defaults = new LoginLimitProperties(new Limit(0, null), new Limit(0, null), 10);
        assertThat(defaults.perAddress()).isEqualTo(LoginLimitProperties.DEFAULT_PER_ADDRESS);
        assertThat(defaults.perAccount()).isEqualTo(LoginLimitProperties.DEFAULT_PER_ACCOUNT);
        assertThatThrownBy(() -> new Limit(5, Duration.ZERO)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new Limit(-1, Duration.ofMinutes(1))).isInstanceOf(IllegalStateException.class);
    }
}
