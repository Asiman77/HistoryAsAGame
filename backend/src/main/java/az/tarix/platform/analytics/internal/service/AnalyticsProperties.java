package az.tarix.platform.analytics.internal.service;

import java.time.Duration;
import java.time.Period;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;

/**
 * {@code platform.analytics.*} (BACKEND_SPEC.md §12, ADR-0018).
 *
 * @param zone           the day boundary of the daily totals (schools are in Azerbaijan)
 * @param maxBatch       events per request
 * @param maxBody        request body limit
 * @param retention      raw events older than this are deleted; daily totals stay
 * @param recomputeDays  the nightly job recomputes this many past days (late events arrive)
 * @param perSession     events per session; zero values: {@link #DEFAULT_PER_SESSION}
 * @param perAddress     events per client address (a whole school may share one address);
 *                       zero values: {@link #DEFAULT_PER_ADDRESS}
 * @param maxTrackedKeys sessions and addresses remembered by the limiter (memory bound)
 */
@ConfigurationProperties("platform.analytics")
public record AnalyticsProperties(
        @DefaultValue("Asia/Baku") ZoneId zone,
        @DefaultValue("50") int maxBatch,
        @DefaultValue("64KB") DataSize maxBody,
        @DefaultValue("P12M") Period retention,
        @DefaultValue("3") int recomputeDays,
        @DefaultValue Limit perSession,
        @DefaultValue Limit perAddress,
        @DefaultValue("100000") long maxTrackedKeys) {

    public static final Limit DEFAULT_PER_SESSION = new Limit(600, Duration.ofMinutes(10));
    public static final Limit DEFAULT_PER_ADDRESS = new Limit(20_000, Duration.ofMinutes(10));

    public AnalyticsProperties {
        if (perSession.capacity() <= 0 || perSession.period() == null) perSession = DEFAULT_PER_SESSION;
        if (perAddress.capacity() <= 0 || perAddress.period() == null) perAddress = DEFAULT_PER_ADDRESS;
        if (maxBatch < 1 || recomputeDays < 1 || maxTrackedKeys < 1) {
            throw new IllegalStateException("platform.analytics: max-batch, recompute-days and max-tracked-keys must be positive");
        }
    }

    /** {@code capacity} events, refilled evenly over {@code period}. */
    public record Limit(long capacity, Duration period) {}
}
