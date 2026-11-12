package az.tarix.platform.publishing.internal;

import az.tarix.platform.editorial.api.ContentArchived;
import az.tarix.platform.editorial.api.ContentImported;
import az.tarix.platform.editorial.api.ContentPublished;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Projects documents after editorial transactions commit. {@code @ApplicationModuleListener}
 * runs asynchronously in its own transaction and is tracked by the event publication
 * registry: if projecting fails, the publication stays incomplete and is resubmitted
 * ({@link RetryIncompleteProjections}, and on restart). The document's status never changes
 * because of a projection failure.
 */
@Component
class ProjectionListener {

    private final Projector projector;

    ProjectionListener(Projector projector) {
        this.projector = projector;
    }

    @ApplicationModuleListener
    void on(ContentPublished event) {
        projector.project(event.documentId());
    }

    @ApplicationModuleListener
    void on(ContentArchived event) {
        projector.project(event.documentId());
    }

    /** A bulk import: one rebuild instead of one projection per document (ADR-0013). */
    @ApplicationModuleListener
    void on(ContentImported event) {
        projector.rebuild();
    }
}
