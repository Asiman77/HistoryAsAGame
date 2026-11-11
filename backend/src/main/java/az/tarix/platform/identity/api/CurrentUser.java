package az.tarix.platform.identity.api;

import java.util.Set;
import java.util.UUID;

/** The authenticated caller of the current request. */
public record CurrentUser(UUID id, Set<Role> roles) {

    public CurrentUser {
        roles = Set.copyOf(roles);
    }

    public boolean hasRole(Role role) {
        return roles.contains(role);
    }

    public boolean hasAnyRole(Role... any) {
        for (Role r : any) if (roles.contains(r)) return true;
        return false;
    }
}
