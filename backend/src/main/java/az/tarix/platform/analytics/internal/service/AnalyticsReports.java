package az.tarix.platform.analytics.internal.service;

import az.tarix.platform.identity.api.ClassGroups;
import az.tarix.platform.identity.api.ClassGroups.ClassGroupRef;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reports over the daily totals only (BACKEND_SPEC.md §12), never over raw events: what a
 * report shows survives the retention, and nothing in it can point at one session. Days are
 * inclusive; today is not aggregated before the nightly job.
 */
@Service
public class AnalyticsReports {

    public record Period(LocalDate from, LocalDate to) {}

    /** A quiz question and how often it was answered wrong. */
    public record QuizStat(String ownerType, String ownerSlug, String stepKey, int questionIndex, long answers, long wrong,
                           double wrongRate) {}

    /** How often a step was viewed and left. {@code views} sums the sessions per day. */
    public record StepDropOff(String stepKey, long views, long abandoned, double abandonRate) {}

    public record DropOff(String ownerType, String ownerSlug, Period period, long started, long completed,
                          List<StepDropOff> steps) {}

    public record SimulationStat(String ownerType, String ownerSlug, long started, long completed) {}

    public record ClassQuizStat(String ownerType, String ownerSlug, String stepKey, int questionIndex, long correct, long wrong) {}

    public record AbandonStat(String ownerType, String ownerSlug, String stepKey, long abandoned) {}

    /** A class's totals: no student is named, there are no student accounts. */
    public record ClassReport(String code, String name, Period period, List<SimulationStat> simulations,
                              List<ClassQuizStat> quizzes, List<AbandonStat> abandoned) {}

    static final String QUIZ_DIFFICULTY = """
            SELECT owner_type, owner_slug, step_key, detail,
                   sum(coalesce((payload_stats->>'correct')::bigint, 0)) AS correct,
                   sum(coalesce((payload_stats->>'wrong')::bigint, 0)) AS wrong
            FROM daily_aggregate
            WHERE event_type = 'quiz_answered' AND day BETWEEN :from AND :to
            GROUP BY owner_type, owner_slug, step_key, detail
            HAVING sum(coalesce((payload_stats->>'correct')::bigint, 0) + coalesce((payload_stats->>'wrong')::bigint, 0)) >= :min
            ORDER BY sum(coalesce((payload_stats->>'wrong')::bigint, 0))::float8
                     / sum(coalesce((payload_stats->>'correct')::bigint, 0) + coalesce((payload_stats->>'wrong')::bigint, 0)) DESC,
                     wrong DESC, owner_type, owner_slug, step_key, detail
            LIMIT :limit""";

    static final String OWNER_TOTALS = """
            SELECT coalesce(sum(count) FILTER (WHERE event_type = 'simulation_started'), 0) AS started,
                   coalesce(sum(count) FILTER (WHERE event_type = 'simulation_completed'), 0) AS completed
            FROM daily_aggregate
            WHERE owner_type = :type AND owner_slug = :slug AND day BETWEEN :from AND :to""";

    static final String STEP_DROP_OFF = """
            SELECT step_key,
                   coalesce(sum(sessions) FILTER (WHERE event_type = 'step_viewed'), 0) AS views,
                   coalesce(sum(count) FILTER (WHERE event_type = 'simulation_abandoned'), 0) AS abandoned
            FROM daily_aggregate
            WHERE owner_type = :type AND owner_slug = :slug AND step_key <> '' AND day BETWEEN :from AND :to
              AND event_type IN ('step_viewed', 'simulation_abandoned')
            GROUP BY step_key
            ORDER BY abandoned DESC, step_key""";

    static final String CLASS_SIMULATIONS = """
            SELECT owner_type, owner_slug,
                   coalesce(sum(count) FILTER (WHERE event_type = 'simulation_started'), 0) AS started,
                   coalesce(sum(count) FILTER (WHERE event_type = 'simulation_completed'), 0) AS completed
            FROM daily_aggregate
            WHERE class_code = :code AND owner_type <> '' AND day BETWEEN :from AND :to
              AND event_type IN ('simulation_started', 'simulation_completed')
            GROUP BY owner_type, owner_slug ORDER BY started DESC, owner_type, owner_slug""";

    static final String CLASS_QUIZZES = """
            SELECT owner_type, owner_slug, step_key, detail,
                   sum(coalesce((payload_stats->>'correct')::bigint, 0)) AS correct,
                   sum(coalesce((payload_stats->>'wrong')::bigint, 0)) AS wrong
            FROM daily_aggregate
            WHERE class_code = :code AND event_type = 'quiz_answered' AND day BETWEEN :from AND :to
            GROUP BY owner_type, owner_slug, step_key, detail
            ORDER BY owner_type, owner_slug, step_key, detail""";

    static final String CLASS_ABANDONED = """
            SELECT owner_type, owner_slug, step_key, sum(count) AS abandoned
            FROM daily_aggregate
            WHERE class_code = :code AND event_type = 'simulation_abandoned' AND day BETWEEN :from AND :to
            GROUP BY owner_type, owner_slug, step_key
            ORDER BY abandoned DESC, owner_type, owner_slug, step_key""";

    private final JdbcClient jdbc;
    private final ClassGroups classes;

    AnalyticsReports(JdbcClient jdbc, ClassGroups classes) {
        this.jdbc = jdbc;
        this.classes = classes;
    }

    @Transactional(readOnly = true)
    public List<QuizStat> quizDifficulty(Period p, int minAnswers, int limit) {
        return jdbc.sql(QUIZ_DIFFICULTY).param("from", p.from()).param("to", p.to()).param("min", minAnswers)
                .param("limit", limit).query((rs, n) -> {
                    long correct = rs.getLong("correct");
                    long wrong = rs.getLong("wrong");
                    return new QuizStat(rs.getString("owner_type"), rs.getString("owner_slug"), rs.getString("step_key"),
                            questionIndex(rs.getString("detail")), correct + wrong, wrong, rate(wrong, correct + wrong));
                }).list();
    }

    @Transactional(readOnly = true)
    public DropOff dropOff(String ownerType, String ownerSlug, Period p) {
        long[] totals = jdbc.sql(OWNER_TOTALS).param("type", ownerType).param("slug", ownerSlug).param("from", p.from())
                .param("to", p.to()).query((rs, n) -> new long[] {rs.getLong("started"), rs.getLong("completed")}).single();
        List<StepDropOff> steps = jdbc.sql(STEP_DROP_OFF).param("type", ownerType).param("slug", ownerSlug)
                .param("from", p.from()).param("to", p.to()).query((rs, n) -> {
                    long views = rs.getLong("views");
                    long abandoned = rs.getLong("abandoned");
                    return new StepDropOff(rs.getString("step_key"), views, abandoned, rate(abandoned, views));
                }).list();
        return new DropOff(ownerType, ownerSlug, p, totals[0], totals[1], steps);
    }

    /** The class's report, or empty when it does not exist or is not this teacher's (the same answer). */
    @Transactional(readOnly = true)
    public Optional<ClassReport> forClass(String code, UUID teacher, Period p) {
        Optional<ClassGroupRef> c = classes.byCode(code).filter(g -> g.teacherId().equals(teacher));
        if (c.isEmpty()) return Optional.empty();
        String k = c.get().code();
        List<SimulationStat> sims = jdbc.sql(CLASS_SIMULATIONS).param("code", k).param("from", p.from()).param("to", p.to())
                .query((rs, n) -> new SimulationStat(rs.getString("owner_type"), rs.getString("owner_slug"), rs.getLong("started"),
                        rs.getLong("completed"))).list();
        List<ClassQuizStat> quizzes = jdbc.sql(CLASS_QUIZZES).param("code", k).param("from", p.from()).param("to", p.to())
                .query((rs, n) -> new ClassQuizStat(rs.getString("owner_type"), rs.getString("owner_slug"), rs.getString("step_key"),
                        questionIndex(rs.getString("detail")), rs.getLong("correct"), rs.getLong("wrong"))).list();
        List<AbandonStat> abandoned = jdbc.sql(CLASS_ABANDONED).param("code", k).param("from", p.from()).param("to", p.to())
                .query((rs, n) -> new AbandonStat(rs.getString("owner_type"), rs.getString("owner_slug"), rs.getString("step_key"),
                        rs.getLong("abandoned"))).list();
        return Optional.of(new ClassReport(k, c.get().name(), p, sims, quizzes, abandoned));
    }

    /** {@code q2} → 2. */
    static int questionIndex(String detail) {
        return detail != null && detail.startsWith("q") ? Integer.parseInt(detail.substring(1)) : 0;
    }

    static double rate(long part, long whole) {
        return whole == 0 ? 0 : Math.round(part * 10_000.0 / whole) / 10_000.0;
    }
}
