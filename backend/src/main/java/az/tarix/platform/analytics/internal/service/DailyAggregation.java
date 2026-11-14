package az.tarix.platform.analytics.internal.service;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fills {@code daily_aggregate} from the raw events (BACKEND_SPEC.md §12). A day is computed
 * from all its events at once and upserted, so recomputing it is harmless; the nightly run
 * recomputes the last {@code recompute-days} days, because events reach the server up to
 * 48 hours late ({@code EventRules.MAX_AGE}). Days are in {@code platform.analytics.zone}.
 * Afterwards the retention is applied and partitions for the coming months are created.
 */
@Component
public class DailyAggregation {

    private static final Logger log = LoggerFactory.getLogger(DailyAggregation.class);

    /**
     * One day's totals. The {@code received_at} bounds only let PostgreSQL skip partitions:
     * an event of the day was received between 5 minutes before and 48 hours after it.
     */
    static final String AGGREGATE_DAY = """
            INSERT INTO daily_aggregate (day, event_type, owner_type, owner_slug, step_key, class_code, detail, count, sessions,
                                         payload_stats, computed_at)
            SELECT CAST(:day AS date), event_type, coalesce(owner_type, ''), coalesce(owner_slug, ''), coalesce(step_key, ''),
                   coalesce(class_code, ''), detail, count(*), count(DISTINCT session_id),
                   jsonb_strip_nulls(jsonb_build_object(
                     'correct', CASE WHEN event_type = 'quiz_answered'
                                     THEN count(*) FILTER (WHERE (payload->>'correct')::boolean) END,
                     'wrong', CASE WHEN event_type = 'quiz_answered'
                                   THEN count(*) FILTER (WHERE NOT (payload->>'correct')::boolean) END,
                     'durationMsSum', sum((payload->>'durationMs')::bigint),
                     'durationMsCount', CASE WHEN count(payload->'durationMs') > 0 THEN count(payload->'durationMs') END)),
                   now()
            FROM learning_event
            WHERE occurred_at >= :from AND occurred_at < :to
              AND received_at >= :receivedFrom AND received_at < :receivedTo
            GROUP BY event_type, owner_type, owner_slug, step_key, class_code, detail
            ON CONFLICT ON CONSTRAINT daily_aggregate_key DO UPDATE
              SET count = EXCLUDED.count, sessions = EXCLUDED.sessions, payload_stats = EXCLUDED.payload_stats,
                  computed_at = EXCLUDED.computed_at""";

    private final JdbcClient jdbc;
    private final AnalyticsProperties props;
    private final PartitionMaintenance partitions;
    private final Clock clock;

    DailyAggregation(JdbcClient jdbc, AnalyticsProperties props, PartitionMaintenance partitions, Clock clock) {
        this.jdbc = jdbc;
        this.props = props;
        this.partitions = partitions;
        this.clock = clock;
    }

    /** Every night: the last days' totals, retention, partitions ahead. */
    @Scheduled(cron = "${platform.analytics.aggregate-cron:0 15 2 * * *}", zone = "${platform.analytics.zone:Asia/Baku}")
    void nightly() {
        try {
            LocalDate today = LocalDate.now(clock.withZone(props.zone()));
            run(today.minusDays(props.recomputeDays()), today.minusDays(1));
            partitions.applyRetention();
            partitions.ensureAhead();
        } catch (RuntimeException e) {
            log.error("nightly analytics job failed; the next run recomputes the same days", e);
        }
    }

    /** Computes the days {@code from}..{@code to} (inclusive); returns the number of aggregate rows written. */
    @Transactional
    public int run(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) throw new IllegalArgumentException("to, from-dan əvvəl ola bilməz");
        if (from.plusDays(400).isBefore(to)) throw new IllegalArgumentException("bir dəfədə ən çox 400 gün");
        int rows = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Timestamp start = Timestamp.from(day.atStartOfDay(props.zone()).toInstant());
            Timestamp end = Timestamp.from(day.plusDays(1).atStartOfDay(props.zone()).toInstant());
            rows += jdbc.sql(AGGREGATE_DAY).param("day", day).param("from", start).param("to", end)
                    .param("receivedFrom", Timestamp.from(start.toInstant().minus(Duration.ofMinutes(5))))
                    .param("receivedTo", Timestamp.from(end.toInstant().plus(Duration.ofHours(48))))
                    .update();
        }
        log.info("analytics aggregated days {}..{} rows={}", from, to, rows);
        return rows;
    }
}
