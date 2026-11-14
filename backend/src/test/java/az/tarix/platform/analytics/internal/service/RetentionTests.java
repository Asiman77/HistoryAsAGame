package az.tarix.platform.analytics.internal.service;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Raw events go after 12 months, the daily totals stay (BACKEND_SPEC.md §12). */
@IntegrationTest
class RetentionTests {

    @Autowired
    PartitionMaintenance partitions;

    @Autowired
    JdbcClient jdbc;

    final YearMonth old = YearMonth.now(ZoneOffset.UTC).minusMonths(14);
    final String oldPartition = "learning_event_%04d_%02d".formatted(old.getYear(), old.getMonthValue());

    @AfterEach
    void cleanUp() {
        jdbc.sql("DELETE FROM daily_aggregate").update();
        jdbc.sql("DELETE FROM learning_event").update();
        // Only if the test failed before retention dropped it.
        jdbc.sql("SELECT analytics_drop_partitions_before(:cutoff)")
                .param("cutoff", java.sql.Timestamp.from(old.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC)))
                .query(Integer.class).single();
    }

    long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    void event(Instant receivedAt) {
        jdbc.sql("""
                INSERT INTO learning_event (received_at, occurred_at, session_id, event_type, detail)
                VALUES (:at, :at, :s, 'legend_toggle', 'shown')""")
                .param("at", java.sql.Timestamp.from(receivedAt)).param("s", UUID.randomUUID()).update();
    }

    @Test
    void oldRawEventsAreDroppedAndTotalsKept() {
        // A partition from before the retention, as if the platform had been running for a while.
        jdbc.sql("""
                DO $$ BEGIN EXECUTE format('CREATE TABLE %I PARTITION OF learning_event FOR VALUES FROM (%L) TO (%L)',
                  'learning_event_' || to_char(:month::date, 'YYYY_MM'),
                  (:month::date)::timestamp AT TIME ZONE 'UTC', (:month::date + interval '1 month')::timestamp AT TIME ZONE 'UTC');
                END $$""".replace(":month", "'" + old.atDay(1) + "'")).update();
        event(old.atDay(10).atStartOfDay().toInstant(ZoneOffset.UTC));
        event(Instant.now().minus(1, ChronoUnit.DAYS));
        jdbc.sql("""
                INSERT INTO daily_aggregate (day, event_type, detail, count, sessions, computed_at)
                VALUES (:day, 'legend_toggle', 'shown', 1, 1, now())""").param("day", old.atDay(10)).update();

        assertThat(partitions.applyRetention()).isEqualTo(1);
        assertThat(jdbc.sql("SELECT to_regclass(:name) IS NULL").param("name", oldPartition).query(Boolean.class).single()).isTrue();
        assertThat(count("SELECT count(*) FROM learning_event")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM daily_aggregate")).isEqualTo(1);
        // Partitions ahead exist and creating them again is harmless.
        assertThat(partitions.ensureAhead()).isZero();
    }
}
