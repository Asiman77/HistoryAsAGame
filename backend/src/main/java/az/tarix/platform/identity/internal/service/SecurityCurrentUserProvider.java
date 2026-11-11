package az.tarix.platform.identity.internal.service;

import az.tarix.platform.identity.api.CurrentUser;
import az.tarix.platform.identity.api.CurrentUserProvider;
import az.tarix.platform.identity.api.Role;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Reads the caller from the verified access token of the current request. */
@Component
class SecurityCurrentUserProvider implements CurrentUserProvider {

    @Override
    public Optional<CurrentUser> current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) return Optional.empty();
        Set<Role> roles = EnumSet.noneOf(Role.class);
        for (GrantedAuthority a : jwt.getAuthorities()) {
            for (Role r : Role.values()) if (r.authority().equals(a.getAuthority())) roles.add(r);
        }
        return Optional.of(new CurrentUser(UUID.fromString(jwt.getToken().getSubject()), roles));
    }
}
