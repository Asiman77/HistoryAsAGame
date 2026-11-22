package az.tarix.platform.identity.api;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Read access to other people's accounts, for modules that refer to users (e.g. a review assignment). */
public interface Accounts {

    /** The roles of an active account; empty when there is no such account or it is disabled. */
    Optional<Set<Role>> activeRoles(UUID userId);
}
