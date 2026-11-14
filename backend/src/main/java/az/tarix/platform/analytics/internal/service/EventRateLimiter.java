package az.tarix.platform.analytics.internal.service;

import az.tarix.platform.analytics.internal.service.AnalyticsProperties.Limit;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.TimeMeter;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Token buckets for incoming events (BACKEND_SPEC.md §12, Bucket4j), counted in events, not
 * requests: one per session, one per client address. In memory only: the address is a cache
 * key for at most one limit period and is never written anywhere.
 */
@Component
public class EventRateLimiter {

    private final AnalyticsProperties props;
    private final TimeMeter time;
    private final Cache<UUID, Bucket> sessions;
    private final Cache<String, Bucket> addresses;

    EventRateLimiter(AnalyticsProperties props, Clock clock) {
        this.props = props;
        this.time = new ClockTimeMeter(clock);
        this.sessions = Caffeine.newBuilder().maximumSize(props.maxTrackedKeys())
                .expireAfterAccess(props.perSession().period()).build();
        this.addresses = Caffeine.newBuilder().maximumSize(props.maxTrackedKeys())
                .expireAfterAccess(props.perAddress().period()).build();
    }

    /** Takes {@code events} from both buckets; empty when allowed, else how long to wait. */
    public Optional<Duration> tryTake(String address, UUID session, int events) {
        Bucket byAddress = addresses.get(address == null ? "unknown" : address, k -> bucket(props.perAddress()));
        Optional<Duration> wait = take(byAddress, events);
        if (wait.isPresent()) return wait;
        return take(sessions.get(session, k -> bucket(props.perSession())), events);
    }

    private Bucket bucket(Limit limit) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(limit.capacity()).refillGreedy(limit.capacity(), limit.period()).build())
                .withCustomTimePrecision(time).build();
    }

    private static Optional<Duration> take(Bucket bucket, int events) {
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(events);
        if (probe.isConsumed()) return Optional.empty();
        long seconds = Math.max(1, (probe.getNanosToWaitForRefill() + 999_999_999L) / 1_000_000_000L);
        return Optional.of(Duration.ofSeconds(seconds));
    }

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
