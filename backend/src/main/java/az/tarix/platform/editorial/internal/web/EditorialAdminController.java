package az.tarix.platform.editorial.internal.web;

import az.tarix.platform.editorial.internal.service.BrokenReferences;
import az.tarix.platform.editorial.internal.validation.ValidationIssue.Level;
import az.tarix.platform.shared.content.DocumentType;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
class EditorialAdminController {

    /** A reference of a published document that does not lead to published content. */
    record BrokenReference(UUID documentId, DocumentType type, String slug, int revisionNo, Level level, String code,
                           String pointer, String message) {}

    private final BrokenReferences broken;

    EditorialAdminController(BrokenReferences broken) {
        this.broken = broken;
    }

    /** ERROR: the target is missing or archived; WARNING / INFO: it exists but is not published, or is future content. */
    @GetMapping("/broken-references")
    ResponseEntity<List<BrokenReference>> brokenReferences() {
        List<BrokenReference> body = broken.find().stream().map(b -> new BrokenReference(b.documentId(), b.type(), b.slug(),
                b.revisionNo(), b.issue().level(), b.issue().code(), b.issue().pointer(), b.issue().message())).toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
