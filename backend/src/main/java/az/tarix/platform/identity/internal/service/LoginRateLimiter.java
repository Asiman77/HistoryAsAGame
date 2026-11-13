package az.tarix.platform.identity.internal.service;

import az.tarix.platform.identity.internal.domain.AppUser;
import az.tarix.platform.identity.internal.service.LoginLimitProperties.Limit;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.TimeMeter;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Token buckets for login attempts (BACKEND_SPEC.md §13, Bucket4j): one per client address and
 * one per account. In memory: with a single backend instance this is exact; behind several
 * instances each one limits on its own (a shared store would be a Bucket4j proxy manager,
 * e.g. over PostgreSQL, without changing callers).
 */
@Component
@EnableConfigurationProperties(LoginLimitProperties.class)
public class LoginRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);

    private final LoginLimitProperties props;
    private final TimeMeter time;
    private final Cache<String, Bucket> addresses;
    private final Cache<String, Bucket> accounts;

    public LoginRateLimiter(LoginLimitProperties props, Clock clock) {
        this.props = props;
        this.time = new ClockTimeMeter(clock);
        this.addresses = cache(props.perAddress(), props.maxTrackedKeys());
        this.accounts = cache(props.perAccount(), props.maxTrackedKeys());
    }

    /**
     * Takes one attempt from both buckets. Empty when the attempt may go ahead; otherwise how
     * long the client must wait. The address is checked first, so a client that is already
     * throttled does not use up the account's attempts.
     */
    public Optional<Duration> tryAttempt(String clientAddress, String email) {
        Optional<Duration> wait = take(addresses, props.perAddress(), clientAddress == null ? "unknown" : clientAddress);
        if (wait.isPresent()) {
            log.warn("Login attempts throttled for a client address");
            return wait;
        }
        wait = take(accounts, props.perAccount(), AppUser.normalizeEmail(email));
        if (wait.isPresent()) log.warn("Login attempts throttled for an account");
        return wait;
    }

    private Optional<Duration> take(Cache<String, Bucket> buckets, Limit limit, String key) {
        Bucket bucket = buckets.get(key, k -> Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(limit.capacity()).refillGreedy(limit.capacity(), limit.period()).build())
                .withCustomTimePrecision(time)
                .build());
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) return Optional.empty();
        // Round up to whole seconds: Retry-After has no fractions.
        long seconds = Math.max(1, (probe.getNanosToWaitForRefill() + 999_999_999L) / 1_000_000_000L);
        return Optional.of(Duration.ofSeconds(seconds));
    }

    /**
     * A bucket is forgotten once it would be full again anyway, so the cache only holds keys
     * that are actually being limited.
     */
    private static Cache<String, Bucket> cache(Limit limit, long maxKeys) {
        return Caffeine.newBuilder().maximumSize(maxKeys).expireAfterAccess(limit.period()).build();
    }

    /** Bucket4j time from the application clock (tests move it). */
    private record ClockTimeMeter(Clock clock) implements TimeMeter {

        @Override
        public long currentTimeNanos() {
            return clock.millis() * 1_000_000L;
        }

        @Override
        public boolean isWallClockBased() {
            return true;
        }
    }
}
