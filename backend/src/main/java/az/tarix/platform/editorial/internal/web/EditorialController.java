package az.tarix.platform.editorial.internal.web;

import az.tarix.platform.editorial.api.DocumentStatus;
import az.tarix.platform.editorial.api.DocumentType;
import az.tarix.platform.editorial.internal.domain.Action;
import az.tarix.platform.editorial.internal.persistence.DocumentQueries;
import az.tarix.platform.editorial.internal.service.CommentService;
import az.tarix.platform.editorial.internal.service.DocumentService;
import az.tarix.platform.editorial.internal.service.DocumentService.DocumentView;
import az.tarix.platform.editorial.internal.web.EditorialDtos.CommentResponse;
import az.tarix.platform.editorial.internal.web.EditorialDtos.CreateComment;
import az.tarix.platform.editorial.internal.web.EditorialDtos.CreateDocument;
import az.tarix.platform.editorial.internal.web.EditorialDtos.DocumentResponse;
import az.tarix.platform.editorial.internal.web.EditorialDtos.DocumentSummary;
import az.tarix.platform.editorial.internal.web.EditorialDtos.RevisionInfo;
import az.tarix.platform.editorial.internal.web.EditorialDtos.RevisionResponse;
import az.tarix.platform.editorial.internal.web.EditorialDtos.TransitionRequest;
import az.tarix.platform.editorial.internal.web.EditorialDtos.TransitionResponse;
import az.tarix.platform.editorial.internal.web.EditorialDtos.UpdateComment;
import az.tarix.platform.editorial.internal.web.EditorialDtos.UpdateDocument;
import az.tarix.platform.editorial.internal.web.EditorialDtos.ValidationResponse;
import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.identity.api.CurrentUserProvider;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.node.ArrayNode;

/**
 * Editorial API (BACKEND_SPEC.md §11). The {@code ETag} of a document is its version;
 * {@code PUT} needs it back in {@code If-Match} (optimistic locking), revert and transitions
 * check it when given. Responses are private data: never cached.
 */
@RestController
@RequestMapping("/api/v1/editorial/documents")
@PreAuthorize("hasAnyRole('AUTHOR', 'REVIEWER', 'ADMIN')")
class EditorialController {

    static final MediaType JSON_PATCH = MediaType.parseMediaType("application/json-patch+json");
    private static final Pattern ETAG = Pattern.compile("^(?:W/)?\"?(\\d{1,18})\"?$");

    private final DocumentService documents;
    private final CommentService comments;
    private final CurrentUserProvider currentUser;

    EditorialController(DocumentService documents, CommentService comments, CurrentUserProvider currentUser) {
        this.documents = documents;
        this.comments = comments;
        this.currentUser = currentUser;
    }

    // --- documents ----------------------------------------------------------------------------

    /** {@code mine=true}: only documents the caller created. */
    @GetMapping
    ResponseEntity<List<DocumentSummary>> list(@RequestParam(required = false) DocumentType type,
                                               @RequestParam(required = false) DocumentStatus status,
                                               @RequestParam(required = false) String q,
                                               @RequestParam(defaultValue = "false") boolean mine,
                                               @RequestParam(defaultValue = "50") int limit,
                                               @RequestParam(defaultValue = "0") int offset) {
        if (limit < 1 || limit > 200 || offset < 0) throw new IllegalArgumentException("limit 1–200, offset ≥ 0 olmalıdır.");
        if (q != null && q.length() > 200) throw new IllegalArgumentException("q 200 simvoldan uzundur.");
        CurrentUser user = user();
        var rows = documents.list(user, new DocumentQueries.Filter(type, status, q, mine ? user.id() : null, limit, offset));
        return ok(rows.stream().map(DocumentSummary::of).toList());
    }

    @PostMapping
    ResponseEntity<DocumentResponse> create(@Valid @RequestBody CreateDocument body) {
        DocumentView v = documents.create(user(), body.type(), body.slug(), body.content(), body.changeNote());
        return ResponseEntity.created(URI.create("/api/v1/editorial/documents/" + v.document().id()))
                .eTag(etag(v)).cacheControl(CacheControl.noStore()).body(DocumentResponse.of(v));
    }

    @GetMapping("/{id}")
    ResponseEntity<DocumentResponse> get(@PathVariable UUID id) {
        return document(documents.get(user(), id));
    }

    @PutMapping("/{id}")
    ResponseEntity<DocumentResponse> update(@PathVariable UUID id,
                                            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
                                            @Valid @RequestBody UpdateDocument body) {
        return document(documents.update(user(), id, version(ifMatch), body.content(), body.changeNote()));
    }

    @GetMapping("/{id}/revisions")
    ResponseEntity<List<RevisionInfo>> revisions(@PathVariable UUID id) {
        return ok(documents.history(user(), id).stream().map(RevisionInfo::of).toList());
    }

    @GetMapping("/{id}/revisions/{revisionNo}")
    ResponseEntity<RevisionResponse> revision(@PathVariable UUID id, @PathVariable int revisionNo) {
        return ok(RevisionResponse.of(documents.revision(user(), id, revisionNo)));
    }

    /** RFC 6902 patch from revision {@code from} to revision {@code to}. */
    @GetMapping("/{id}/diff")
    ResponseEntity<ArrayNode> diff(@PathVariable UUID id, @RequestParam int from, @RequestParam int to) {
        return ResponseEntity.ok().contentType(JSON_PATCH).cacheControl(CacheControl.noStore())
                .body(documents.diff(user(), id, from, to));
    }

    @PostMapping("/{id}/revert")
    ResponseEntity<DocumentResponse> revert(@PathVariable UUID id, @RequestParam int to,
                                            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
        return document(documents.revert(user(), id, version(ifMatch), to));
    }

    @GetMapping("/{id}/validation")
    ResponseEntity<ValidationResponse> validation(@PathVariable UUID id, @RequestParam(required = false) Integer revision) {
        return ok(ValidationResponse.of(documents.validate(user(), id, revision)));
    }

    @PostMapping("/{id}/transitions")
    ResponseEntity<DocumentResponse> transition(@PathVariable UUID id,
                                                @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
                                                @Valid @RequestBody TransitionRequest body) {
        Action action = Action.fromApi(body.action());
        return document(documents.transition(user(), id, version(ifMatch), action, body.comment()));
    }

    /** The audit trail of the document's status changes. */
    @GetMapping("/{id}/transitions")
    ResponseEntity<List<TransitionResponse>> transitions(@PathVariable UUID id) {
        return ok(documents.transitions(user(), id).stream().map(TransitionResponse::of).toList());
    }

    // --- comments -----------------------------------------------------------------------------

    @GetMapping("/{id}/comments")
    ResponseEntity<List<CommentResponse>> comments(@PathVariable UUID id) {
        return ok(comments.list(user(), id).stream().map(CommentResponse::of).toList());
    }

    @PostMapping("/{id}/comments")
    ResponseEntity<CommentResponse> addComment(@PathVariable UUID id, @Valid @RequestBody CreateComment body) {
        var c = comments.add(user(), id, body.revisionNo(), body.fieldPath(), body.body());
        return ResponseEntity.created(URI.create("/api/v1/editorial/documents/%s/comments/%s".formatted(id, c.comment().id())))
                .cacheControl(CacheControl.noStore()).body(CommentResponse.of(c));
    }

    @PatchMapping("/{id}/comments/{commentId}")
    ResponseEntity<CommentResponse> updateComment(@PathVariable UUID id, @PathVariable UUID commentId,
                                                  @Valid @RequestBody UpdateComment body) {
        return ok(CommentResponse.of(comments.update(user(), id, commentId, body.body(), body.resolved())));
    }

    // --- helpers ------------------------------------------------------------------------------

    private CurrentUser user() {
        return currentUser.require();
    }

    private static <T> ResponseEntity<T> ok(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    private static ResponseEntity<DocumentResponse> document(DocumentView v) {
        return ResponseEntity.ok().eTag(etag(v)).cacheControl(CacheControl.noStore()).body(DocumentResponse.of(v));
    }

    private static String etag(DocumentView v) {
        return "\"" + v.document().version() + "\"";
    }

    /** {@code "7"}, {@code W/"7"} or {@code 7} → 7; absent → null. */
    static Long version(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) return null;
        Matcher m = ETAG.matcher(ifMatch.strip());
        if (!m.matches()) throw new IllegalArgumentException("If-Match sənədin ETag-ı olmalıdır, məs. \"3\".");
        return Long.parseLong(m.group(1));
    }
}
