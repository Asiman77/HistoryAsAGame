package az.tarix.platform.shared.content;

/**
 * A document cannot be projected yet because another one it builds on is not in the read
 * model (e.g. a theme variant whose parent is unpublished). Thrown before any row is
 * written; the projection is retried later (event registry) or in a later rebuild pass.
 */
public class MissingDependencyException extends RuntimeException {

    public MissingDependencyException(String message) {
        super(message);
    }
}
