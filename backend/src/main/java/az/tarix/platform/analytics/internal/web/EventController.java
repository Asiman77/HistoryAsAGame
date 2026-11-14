package az.tarix.platform.analytics.internal.web;

import az.tarix.platform.analytics.internal.domain.IncomingEvent;
import az.tarix.platform.analytics.internal.service.AnalyticsProperties;
import az.tarix.platform.analytics.internal.service.EventIntake;
import az.tarix.platform.analytics.internal.service.EventIntake.Result;
import az.tarix.platform.analytics.internal.service.EventRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * {@code POST /api/v1/events}: anonymous learning events (BACKEND_SPEC.md §12, ADR-0018). No
 * authentication, and an {@code Authorization} header is not even read (see the security
 * configuration), so an event can never be tied to an account. Accepts {@code text/plain}
 * too, which is what {@code navigator.sendBeacon} sends cross-origin without a preflight.
 */
@RestController
class EventController {

    /** Fails on any field that is not declared: personal data cannot slip in under another name. */
    static final JsonMapper STRICT = JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

    static final URI TOO_MANY_REQUESTS = URI.create("https://tarixin-icinde.az/problems/too-many-requests");
    static final URI BAD_REQUEST = URI.create("https://tarixin-icinde.az/problems/bad-request");

    /**
     * A batch from one browser session. Unknown fields are an error (400): only what is listed
     * here and in {@link IncomingEvent} is ever accepted.
     *
     * @param sessionId random UUID made by the client for this visit; not linked to anything
     * @param classCode a teacher's class code, when the student entered one
     */
    record EventBatch(UUID sessionId, String classCode, List<IncomingEvent> events) {}

    private final EventIntake intake;
    private final EventRateLimiter limits;
    private final AnalyticsProperties props;

    EventController(EventIntake intake, EventRateLimiter limits, AnalyticsProperties props) {
        this.intake = intake;
        this.limits = limits;
        this.props = props;
    }

    @PostMapping(path = "/api/v1/events", consumes = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_PLAIN_VALUE})
    ResponseEntity<?> accept(@RequestBody String body, HttpServletRequest request) {
        // The size limit is enforced before the body is read: EventBodyLimitFilter.
        EventBatch batch;
        try {
            batch = STRICT.readValue(body, EventBatch.class);
        } catch (JacksonException e) {
            return problem(HttpStatus.BAD_REQUEST, BAD_REQUEST, "Gövdə event batch-i deyil və ya icazə verilməyən sahə var: "
                    + e.getOriginalMessage());
        }
        if (batch == null || batch.sessionId() == null) return problem(HttpStatus.BAD_REQUEST, BAD_REQUEST, "sessionId tələb olunur.");
        if (batch.events() == null || batch.events().isEmpty() || batch.events().size() > props.maxBatch()) {
            return problem(HttpStatus.BAD_REQUEST, BAD_REQUEST, "events: 1–" + props.maxBatch() + " event olmalıdır.");
        }
        if (batch.classCode() != null && batch.classCode().length() > 20) {
            return problem(HttpStatus.BAD_REQUEST, BAD_REQUEST, "classCode sinif kodu olmalıdır.");
        }
        Optional<Duration> wait = limits.tryTake(request.getRemoteAddr(), batch.sessionId(), batch.events().size());
        if (wait.isPresent()) {
            ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, "Çox event göndərilir; bir az gözləyin.");
            p.setType(TOO_MANY_REQUESTS);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).cacheControl(CacheControl.noStore())
                    .header(HttpHeaders.RETRY_AFTER, Long.toString(wait.get().toSeconds())).body(p);
        }
        Result result = intake.accept(batch.sessionId(), batch.classCode(), batch.events());
        return ResponseEntity.status(HttpStatus.ACCEPTED).cacheControl(CacheControl.noStore()).body(result);
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, URI type, String detail) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(status, detail);
        p.setType(type);
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(p);
    }
}
