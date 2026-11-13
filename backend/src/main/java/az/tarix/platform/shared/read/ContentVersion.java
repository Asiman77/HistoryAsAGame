package az.tarix.platform.shared.read;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * The current {@code content_version}: one number that grows with every projection (publish,
 * archive, rebuild). Public responses use it for the ETag and the cache keys.
 */
@Component
public class ContentVersion {

    static final String CURRENT = "SELECT value FROM content_version WHERE id = 1";

    private final JdbcClient jdbc;

    public ContentVersion(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long current() {
        return jdbc.sql(CURRENT).query(Long.class).optional().orElse(0L);
    }
}
