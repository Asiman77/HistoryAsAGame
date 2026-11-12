package az.tarix.platform.publishing.internal;

import az.tarix.platform.publishing.internal.Projector.RebuildReport;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operator actions on the read model (BACKEND_SPEC.md §4.2, §11). */
@RestController
@RequestMapping("/api/v1/admin/projections")
@PreAuthorize("hasRole('ADMIN')")
class ProjectionAdminController {

    record RebuildResponse(int documents, List<String> deferred, long contentVersion, long tookMs) {}

    private final Projector projector;

    ProjectionAdminController(Projector projector) {
        this.projector = projector;
    }

    /** Rebuilds every projection table from the public revisions, in one transaction. */
    @PostMapping("/rebuild")
    ResponseEntity<RebuildResponse> rebuild() {
        RebuildReport r = projector.rebuild();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new RebuildResponse(r.documents(), r.deferred(), r.contentVersion(), r.took().toMillis()));
    }
}
