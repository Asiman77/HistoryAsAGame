package az.tarix.platform.publishing.internal.export;

import az.tarix.platform.publishing.internal.export.StaticExporter.Report;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code POST /api/v1/admin/export}: the static export now, without waiting for the debounce (BACKEND_SPEC.md §11). */
@RestController
class ExportAdminController {

    record ExportResponse(long contentVersion, int files, long bytes, long tookMs) {}

    private final StaticExporter exporter;

    ExportAdminController(StaticExporter exporter) {
        this.exporter = exporter;
    }

    @PostMapping("/api/v1/admin/export")
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<ExportResponse> export() {
        Report r = exporter.export();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new ExportResponse(r.contentVersion(), r.files(), r.bytes(), r.took().toMillis()));
    }
}
