package az.tarix.platform.shared.web;

import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import az.tarix.platform.shared.read.SlugRedirects;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Optional;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Errors of the public API as RFC 9457 Problem Details (same type URIs as the rest of the
 * API), never cached. A slug that was renamed answers {@code 301} to the new slug.
 */
@RestControllerAdvice(annotations = PublicApi.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
class PublicApiProblems {

    static final String BASE = "https://tarixin-icinde.az/problems/";

    private final SlugRedirects redirects;

    PublicApiProblems(SlugRedirects redirects) {
        this.redirects = redirects;
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ProblemDetail> notFound(ResourceNotFoundException e, HttpServletRequest request) {
        if (e.stepKey() == null) {
            Optional<String> target = redirects.target(e.type(), e.slug());
            if (target.isPresent()) {
                return ResponseEntity.status(HttpStatus.MOVED_PERMANENTLY).location(renamed(request, e.slug(), target.get()))
                        .cacheControl(PublicApiHeaders.CACHE).build();
            }
        }
        return problem(HttpStatus.NOT_FOUND, "not-found", e.getMessage());
    }

    @ExceptionHandler(InvalidParameterException.class)
    ResponseEntity<ProblemDetail> invalid(InvalidParameterException e) {
        ResponseEntity<ProblemDetail> res = problem(HttpStatus.BAD_REQUEST, "bad-request", e.getMessage());
        res.getBody().setProperty("parameter", e.parameter());
        return res;
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ProblemDetail> typeMismatch(MethodArgumentTypeMismatchException e) {
        ResponseEntity<ProblemDetail> res = problem(HttpStatus.BAD_REQUEST, "bad-request", e.getName() + ": yanlış dəyər");
        res.getBody().setProperty("parameter", e.getName());
        return res;
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ProblemDetail> missing(MissingServletRequestParameterException e) {
        ResponseEntity<ProblemDetail> res = problem(HttpStatus.BAD_REQUEST, "bad-request", e.getParameterName() + ": məcburidir");
        res.getBody().setProperty("parameter", e.getParameterName());
        return res;
    }

    /** The request URI with the path segment {@code oldSlug} replaced, query string kept. */
    static URI renamed(HttpServletRequest request, String oldSlug, String newSlug) {
        String[] segments = request.getRequestURI().split("/", -1);
        for (int i = 0; i < segments.length; i++) {
            if (segments[i].equals(oldSlug)) {
                segments[i] = newSlug;
                break;
            }
        }
        String query = request.getQueryString();
        return URI.create(String.join("/", segments) + (query == null ? "" : "?" + query));
    }

    static ResponseEntity<ProblemDetail> problem(HttpStatus status, String type, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setType(URI.create(BASE + type));
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
