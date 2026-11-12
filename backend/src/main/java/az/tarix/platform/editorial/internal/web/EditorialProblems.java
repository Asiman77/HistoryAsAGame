package az.tarix.platform.editorial.internal.web;

import az.tarix.platform.editorial.internal.domain.NotPermittedException;
import az.tarix.platform.editorial.internal.domain.WorkflowViolationException;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.ContentTooLarge;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.NotFound;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.PreconditionFailed;
import az.tarix.platform.editorial.internal.service.EditorialExceptions.PublishBlocked;
import java.net.URI;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Editorial failures as RFC 9457 Problem Details, like every other error of the API. */
@RestControllerAdvice(assignableTypes = EditorialController.class)
class EditorialProblems {

    static final String BASE = "https://tarixin-icinde.az/problems/";

    @ExceptionHandler(NotFound.class)
    ResponseEntity<ProblemDetail> notFound(NotFound e) {
        return problem(HttpStatus.NOT_FOUND, "not-found", e.getMessage());
    }

    @ExceptionHandler(NotPermittedException.class)
    ResponseEntity<ProblemDetail> forbidden(NotPermittedException e) {
        return problem(HttpStatus.FORBIDDEN, "forbidden", e.getMessage());
    }

    @ExceptionHandler(WorkflowViolationException.class)
    ResponseEntity<ProblemDetail> conflict(WorkflowViolationException e) {
        ResponseEntity<ProblemDetail> res = problem(HttpStatus.CONFLICT, "conflict", e.getMessage());
        res.getBody().setProperty("code", e.code());
        return res;
    }

    @ExceptionHandler(PreconditionFailed.class)
    ResponseEntity<ProblemDetail> precondition(PreconditionFailed e) {
        HttpStatus status = e.missing() ? HttpStatus.PRECONDITION_REQUIRED : HttpStatus.PRECONDITION_FAILED;
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, e.getMessage());
        body.setType(URI.create(BASE + (e.missing() ? "precondition-required" : "precondition-failed")));
        return ResponseEntity.status(status).eTag("\"" + e.currentVersion() + "\"").cacheControl(CacheControl.noStore()).body(body);
    }

    /** Someone else changed the document between our read and our write (inside one request). */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ProblemDetail> concurrentChange(OptimisticLockingFailureException e) {
        return problem(HttpStatus.PRECONDITION_FAILED, "precondition-failed", "Sənəd eyni anda başqası tərəfindən dəyişdirildi; yenidən oxuyun.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> integrity(DataIntegrityViolationException e) {
        return problem(HttpStatus.CONFLICT, "conflict", "Sorğu mövcud məlumatla toqquşur (məs. eyni slug və ya revision nömrəsi).");
    }

    @ExceptionHandler(PublishBlocked.class)
    ResponseEntity<ProblemDetail> publishBlocked(PublishBlocked e) {
        ResponseEntity<ProblemDetail> res = problem(HttpStatus.UNPROCESSABLE_CONTENT, "validation-failed", e.getMessage());
        res.getBody().setProperty("revisionNo", e.report().revisionNo());
        res.getBody().setProperty("errors", e.report().errors());
        return res;
    }

    @ExceptionHandler(ContentTooLarge.class)
    ResponseEntity<ProblemDetail> tooLarge(ContentTooLarge e) {
        return problem(HttpStatus.CONTENT_TOO_LARGE, "content-too-large", e.getMessage());
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
