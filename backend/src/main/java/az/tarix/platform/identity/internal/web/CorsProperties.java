package az.tarix.platform.identity.internal.web;

import java.net.URI;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code platform.cors.*} (BACKEND_SPEC.md §13: only configured frontend domains). Set with
 * {@code CORS_ALLOWED_ORIGINS=https://tarixin-icinde.az,https://cms.tarixin-icinde.az}. Empty
 * means no browser on another origin may call the API (server-side clients are unaffected).
 *
 * @param allowedOrigins exact origins, {@code scheme://host[:port]}; no wildcards
 */
@ConfigurationProperties("platform.cors")
record CorsProperties(@DefaultValue List<String> allowedOrigins) {

    CorsProperties {
        allowedOrigins = allowedOrigins.stream().map(String::strip).filter(s -> !s.isEmpty()).toList();
        for (String origin : allowedOrigins) check(origin);
    }

    /** Fails startup on anything that is not a plain origin, so a typo cannot open the API to everyone. */
    static void check(String origin) {
        URI uri;
        try {
            uri = URI.create(origin);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("CORS origin is not a URI: " + origin, e);
        }
        boolean plain = ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) && uri.getHost() != null
                && uri.getUserInfo() == null && (uri.getRawPath() == null || uri.getRawPath().isEmpty())
                && uri.getRawQuery() == null && uri.getRawFragment() == null;
        if (!plain || origin.contains("*")) {
            throw new IllegalStateException("CORS origin must be scheme://host[:port] without path or wildcard: " + origin);
        }
    }
}
