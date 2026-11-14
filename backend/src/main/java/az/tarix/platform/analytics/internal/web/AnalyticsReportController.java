package az.tarix.platform.analytics.internal.web;

import az.tarix.platform.analytics.internal.service.AnalyticsProperties;
import az.tarix.platform.analytics.internal.service.AnalyticsReports;
import az.tarix.platform.analytics.internal.service.AnalyticsReports.ClassReport;
import az.tarix.platform.analytics.internal.service.AnalyticsReports.DropOff;
import az.tarix.platform.analytics.internal.service.AnalyticsReports.Period;
import az.tarix.platform.analytics.internal.service.AnalyticsReports.QuizStat;
import az.tarix.platform.analytics.internal.service.DailyAggregation;
import az.tarix.platform.identity.api.CurrentUserProvider;
import az.tarix.platform.shared.domain.Slugs;
import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reports over the daily totals (BACKEND_SPEC.md §12). Without {@code from}/{@code to}: the 30
 * days up to yesterday (today is aggregated the next night). A teacher sees only their own
 * classes; another teacher's class answers 404, the same as one that does not exist.
 */
@RestController
class AnalyticsReportController {

    static final int MAX_DAYS = 366;
    static final Set<String> OWNER_TYPES = Set.of("PERSON", "CONFLICT", "STATE");

    private final AnalyticsReports reports;
    private final DailyAggregation aggregation;
    private final CurrentUserProvider currentUser;
    private final AnalyticsProperties props;
    private final Clock clock;

    AnalyticsReportController(AnalyticsReports reports, DailyAggregation aggregation, CurrentUserProvider currentUser,
                              AnalyticsProperties props, Clock clock) {
        this.reports = reports;
        this.aggregation = aggregation;
        this.currentUser = currentUser;
        this.props = props;
        this.clock = clock;
    }

    @GetMapping("/api/v1/analytics/quiz-difficulty")
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<List<QuizStat>> quizDifficulty(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                  @RequestParam(defaultValue = "10") int minAnswers,
                                                  @RequestParam(defaultValue = "50") int limit) {
        if (minAnswers < 1 || limit < 1 || limit > 500) throw new IllegalArgumentException("minAnswers ≥ 1, limit 1–500 olmalıdır.");
        return noStore(reports.quizDifficulty(period(from, to), minAnswers, limit));
    }

    /** @param owner {@code person:shah-ismayil}, {@code conflict:…} or {@code state:…} */
    @GetMapping("/api/v1/analytics/drop-off")
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<DropOff> dropOff(@RequestParam String owner,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        String[] parts = owner.split(":", 2);
        String type = parts[0].toUpperCase(Locale.ROOT);
        if (parts.length != 2 || !OWNER_TYPES.contains(type) || !Slugs.isValid(parts[1])) {
            throw new IllegalArgumentException("owner: person:<slug>, conflict:<slug> və ya state:<slug>.");
        }
        return noStore(reports.dropOff(type, parts[1], period(from, to)));
    }

    @GetMapping("/api/v1/analytics/classes/{code}")
    @PreAuthorize("hasRole('TEACHER')")
    ResponseEntity<ClassReport> forClass(@PathVariable String code,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        ClassReport report = reports.forClass(code, currentUser.require().id(), period(from, to))
                .orElseThrow(() -> new ClassNotFound());
        return noStore(report);
    }

    /** Recomputes days now (after an outage, or to see today's numbers); the nightly job does the same. */
    @PostMapping("/api/v1/admin/analytics/aggregate")
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<Map<String, Object>> aggregate(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate today = LocalDate.now(clock.withZone(props.zone()));
        LocalDate t = to == null ? today : to;
        LocalDate f = from == null ? t.minusDays(props.recomputeDays()) : from;
        if (f.isAfter(t) || ChronoUnit.DAYS.between(f, t) >= MAX_DAYS) throw new IllegalArgumentException("from ≤ to, ən çox 366 gün.");
        int rows = aggregation.run(f, t);
        return noStore(Map.of("from", f, "to", t, "rows", rows));
    }

    private Period period(LocalDate from, LocalDate to) {
        LocalDate t = to != null ? to : LocalDate.now(clock.withZone(props.zone())).minusDays(1);
        LocalDate f = from != null ? from : t.minusDays(29);
        if (f.isAfter(t)) throw new IllegalArgumentException("from to-dan sonra ola bilməz.");
        if (ChronoUnit.DAYS.between(f, t) >= MAX_DAYS) throw new IllegalArgumentException("Dövr ən çox 366 gün ola bilər.");
        return new Period(f, t);
    }

    private static <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    static final class ClassNotFound extends RuntimeException {
        ClassNotFound() {
            super("Sinif tapılmadı.", null, false, false);
        }
    }

    @ExceptionHandler(ClassNotFound.class)
    ResponseEntity<ProblemDetail> notFound(ClassNotFound e) {
        return problem(HttpStatus.NOT_FOUND, "not-found", e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ProblemDetail> badRequest(IllegalArgumentException e) {
        return problem(HttpStatus.BAD_REQUEST, "bad-request", e.getMessage());
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String type, String detail) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(status, detail);
        p.setType(URI.create("https://tarixin-icinde.az/problems/" + type));
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(p);
    }
}
