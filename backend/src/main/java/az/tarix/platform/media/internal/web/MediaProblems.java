package az.tarix.platform.media.internal.web;

import az.tarix.platform.media.internal.service.MediaException;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import software.amazon.awssdk.core.exception.SdkException;

/** Media failures as RFC 9457 Problem Details, in the editorial API's vocabulary. */
@RestControllerAdvice(assignableTypes = MediaController.class)
class MediaProblems {

    static final String BASE = "https://tarixin-icinde.az/problems/";

    private static final Logger log = LoggerFactory.getLogger(MediaProblems.class);

    @ExceptionHandler(MediaException.class)
    ResponseEntity<ProblemDetail> media(MediaException e) {
        HttpStatus status = switch (e.kind()) {
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case CONFLICT -> HttpStatus.CONFLICT;
            case INVALID -> HttpStatus.UNPROCESSABLE_CONTENT;
            case TOO_LARGE -> HttpStatus.CONTENT_TOO_LARGE;
            case PRECONDITION_REQUIRED -> HttpStatus.PRECONDITION_REQUIRED;
            case PRECONDITION_FAILED -> HttpStatus.PRECONDITION_FAILED;
        };
        String type = switch (e.kind()) {
            case NOT_FOUND -> "not-found";
            case FORBIDDEN -> "forbidden";
            case CONFLICT -> "conflict";
            case INVALID -> "validation-failed";
            case TOO_LARGE -> "content-too-large";
            case PRECONDITION_REQUIRED -> "precondition-required";
            case PRECONDITION_FAILED -> "precondition-failed";
        };
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, e.getMessage());
        body.setType(URI.create(BASE + type));
        body.setProperty("code", e.code());
        var res = ResponseEntity.status(status).cacheControl(CacheControl.noStore());
        if (e.currentVersion() != null) res.eTag("\"" + e.currentVersion() + "\"");
        return res.body(body);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ProblemDetail> concurrentChange(OptimisticLockingFailureException e) {
        return problem(HttpStatus.PRECONDITION_FAILED, "precondition-failed", "Media eyni anda başqası tərəfindən dəyişdirildi; yenidən oxuyun.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> integrity(DataIntegrityViolationException e) {
        return problem(HttpStatus.CONFLICT, "conflict", "Sorğu mövcud məlumatla toqquşur (məs. bu fayl artıq qeydiyyatdadır).");
    }

    /** The object store did not answer as expected; nothing about the request is wrong. */
    @ExceptionHandler(SdkException.class)
    ResponseEntity<ProblemDetail> storage(SdkException e) {
        log.error("object storage failed", e);
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "storage-unavailable", "Fayl anbarı hazırda əlçatan deyil; bir az sonra yenidən cəhd edin.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ProblemDetail> badRequest(IllegalArgumentException e) {
        return problem(HttpStatus.BAD_REQUEST, "bad-request", e.getMessage());
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String type, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setType(URI.create(BASE + type));
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
