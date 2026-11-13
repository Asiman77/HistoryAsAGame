package az.tarix.platform.identity.internal.web;

import az.tarix.platform.identity.internal.service.AccountException;
import java.net.URI;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Account failures of the identity endpoints as RFC 9457 Problem Details. */
@RestControllerAdvice(basePackageClasses = AccountProblems.class)
class AccountProblems {

    static final String BASE = "https://tarixin-icinde.az/problems/";

    @ExceptionHandler(AccountException.class)
    ResponseEntity<ProblemDetail> account(AccountException e) {
        HttpStatus status = switch (e.kind()) {
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT -> HttpStatus.CONFLICT;
            case INVALID -> HttpStatus.UNPROCESSABLE_CONTENT;
        };
        String type = switch (e.kind()) {
            case NOT_FOUND -> "not-found";
            case CONFLICT -> "conflict";
            case INVALID -> "validation-failed";
        };
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, e.getMessage());
        body.setType(URI.create(BASE + type));
        if (e.kind() != AccountException.Kind.NOT_FOUND) body.setProperty("code", e.code());
        if (!e.problems().isEmpty()) body.setProperty("problems", e.problems());
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
