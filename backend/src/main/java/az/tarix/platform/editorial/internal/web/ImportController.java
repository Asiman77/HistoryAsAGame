package az.tarix.platform.editorial.internal.web;

import az.tarix.platform.editorial.internal.importing.DataImporter;
import az.tarix.platform.editorial.internal.importing.DataImporter.Report;
import az.tarix.platform.identity.api.CurrentUserProvider;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Imports the frontend's data/ folder (BACKEND_SPEC.md §16, ADR-0013). */
@RestController
@RequestMapping("/api/v1/admin/import")
@PreAuthorize("hasRole('ADMIN')")
class ImportController {

    private final DataImporter importer;
    private final CurrentUserProvider currentUser;

    ImportController(DataImporter importer, CurrentUserProvider currentUser) {
        this.importer = importer;
        this.currentUser = currentUser;
    }

    /** {@code dryRun=true}: everything is done and reported, then rolled back. */
    @PostMapping
    ResponseEntity<Report> run(@RequestParam(defaultValue = "false") boolean dryRun) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(importer.run(currentUser.require(), dryRun));
    }
}
