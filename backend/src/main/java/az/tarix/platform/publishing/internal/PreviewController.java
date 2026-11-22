package az.tarix.platform.publishing.internal;

import az.tarix.platform.publishing.internal.PreviewService.NoSuchRevision;
import az.tarix.platform.publishing.internal.PreviewService.NotPreviewable;
import az.tarix.platform.publishing.internal.PreviewService.Preview;
import az.tarix.platform.shared.read.Lang;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/v1/editorial/documents/{id}/preview} (BACKEND_SPEC.md §11). It lives in
 * publishing, not editorial: it needs the projection writers, and publishing already depends on
 * editorial (the other way round would be a cycle).
 */
@RestController
@RequestMapping("/api/v1/editorial/documents")
@PreAuthorize("hasAnyRole('AUTHOR', 'REVIEWER', 'ADMIN')")
class PreviewController {

    static final String BASE = "https://tarixin-icinde.az/problems/";

    private final PreviewService previews;

    PreviewController(PreviewService previews) {
        this.previews = previews;
    }

    /** {@code revision}: which revision (default: the current one); the language as in the public API. */
    @GetMapping("/{id}/preview")
    ResponseEntity<Preview> preview(@PathVariable UUID id, @RequestParam(required = false) Integer revision,
                                    @RequestParam(required = false) String lang,
                                    @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        if (revision != null && revision < 1) throw new IllegalArgumentException("revision 1 və ya daha böyük olmalıdır.");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(previews.preview(id, revision, Lang.of(lang, acceptLanguage)));
    }

    @ExceptionHandler(NoSuchRevision.class)
    ResponseEntity<ProblemDetail> notFound(NoSuchRevision e) {
        return problem(HttpStatus.NOT_FOUND, "not-found", e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ProblemDetail> badRequest(IllegalArgumentException e) {
        return problem(HttpStatus.BAD_REQUEST, "bad-request", e.getMessage());
    }

    @ExceptionHandler(NotPreviewable.class)
    ResponseEntity<ProblemDetail> notPreviewable(NotPreviewable e) {
        return problem(HttpStatus.UNPROCESSABLE_CONTENT, "preview-unavailable", e.getMessage());
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String type, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setType(URI.create(BASE + type));
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
