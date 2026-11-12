package az.tarix.platform.shared.content;

import java.util.UUID;

/**
 * Writes the read model of one module (catalog, geo, chronology, theming, media) from
 * published documents (ADR-0001, ADR-0012). The publishing module calls every writer for
 * every document inside one transaction: {@link #delete} then {@link #write}, then
 * {@link #afterChanges} once. Writers ignore document types they do not project.
 *
 * <p>Writers must be idempotent: projecting the same revision twice gives the same rows.
 */
public interface ProjectionWriter {

    /** Removes every row the document owns in this module. */
    void delete(UUID documentId);

    /**
     * Writes the rows of a published document (its old rows are already deleted).
     *
     * @throws MissingDependencyException before writing anything, when the document needs
     *         another one that is not projected yet (a theme variant without its parent)
     */
    void write(PublishedContent content);

    /** Removes every row of the module, before a rebuild. */
    void deleteAll();

    /** Recomputes values that depend on several documents (snapshot validity, unused sources). */
    default void afterChanges() {}
}
