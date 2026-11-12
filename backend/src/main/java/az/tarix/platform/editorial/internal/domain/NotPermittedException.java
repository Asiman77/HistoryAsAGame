package az.tarix.platform.editorial.internal.domain;

/** The caller's roles do not allow this action on this document (HTTP 403). */
public class NotPermittedException extends RuntimeException {

    public NotPermittedException(String message) {
        super(message);
    }
}
