package az.tarix.platform.identity.api;

import java.util.Optional;

/** Who is calling. Other modules use this instead of touching Spring Security directly. */
public interface CurrentUserProvider {

    /** The caller, or empty for anonymous requests (the public API). */
    Optional<CurrentUser> current();

    /** The caller; throws when the request is anonymous (use on authenticated endpoints only). */
    default CurrentUser require() {
        return current().orElseThrow(() -> new IllegalStateException("no authenticated user"));
    }
}
