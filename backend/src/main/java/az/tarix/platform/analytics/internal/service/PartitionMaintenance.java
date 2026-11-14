package az.tarix.platform.analytics.internal.service;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Monthly partitions of {@code learning_event} (V014) and the retention of raw events
 * (BACKEND_SPEC.md §12: deleted after 12 months, daily totals stay). Partitions are created
 * ahead, on startup and every night; a whole partition past the retention is dropped, the rest
 * of an expired month is deleted row by row.
 */
@Component
class PartitionMaintenance {

    private static final Logger log = LoggerFactory.getLogger(PartitionMaintenance.class);

    /** How many months ahead partitions exist. */
    static final int MONTHS_AHEAD = 2;

    private final JdbcClient jdbc;
    private final AnalyticsProperties props;
    private final Clock clock;
    /** The newest month known to have a partition; avoids a catalog query per request. */
    private final AtomicReference<YearMonth> ensuredUpTo = new AtomicReference<>();

    PartitionMaintenance(JdbcClient jdbc, AnalyticsProperties props, Clock clock) {
        this.jdbc = jdbc;
        this.props = props;
        this.clock = clock;
    }

    @EventListener(ApplicationReadyEvent.class)
    void onStartup() {
        ensureAhead();
    }

    /** Partitions for this month and the next {@link #MONTHS_AHEAD}. */
    @Transactional
    public int ensureAhead() {
        Integer created = jdbc.sql("SELECT analytics_ensure_partitions(:months)").param("months", MONTHS_AHEAD)
                .query(Integer.class).single();
        ensuredUpTo.set(YearMonth.from(clock.instant().atZone(ZoneOffset.UTC)).plusMonths(MONTHS_AHEAD));
        if (created > 0) log.info("created {} learning_event partitions", created);
        return created;
    }

    /** Makes sure a row received at {@code at} has a partition (cheap when it is known). */
    void ensureFor(Instant at) {
        YearMonth month = YearMonth.from(at.atZone(ZoneOffset.UTC));
        YearMonth upTo = ensuredUpTo.get();
        if (upTo == null || month.isAfter(upTo)) ensureAhead();
    }

    /**
     * Drops partitions entirely older than the retention and deletes older rows from the
     * partition the cutoff falls into. Returns the number of dropped partitions.
     */
    @Transactional
    public int applyRetention() {
        Instant cutoff = clock.instant().atZone(ZoneOffset.UTC).minus(props.retention()).toInstant();
        int dropped = jdbc.sql("SELECT analytics_drop_partitions_before(:cutoff)").param("cutoff", Timestamp.from(cutoff))
                .query(Integer.class).single();
        int deleted = jdbc.sql("DELETE FROM learning_event WHERE received_at < :cutoff")
                .param("cutoff", Timestamp.from(cutoff)).update();
        if (dropped > 0 || deleted > 0) log.info("analytics retention: dropped {} partitions, deleted {} events before {}", dropped, deleted, cutoff);
        return dropped;
    }
}
