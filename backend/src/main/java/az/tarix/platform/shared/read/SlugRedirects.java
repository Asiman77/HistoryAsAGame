package az.tarix.platform.shared.read;

import az.tarix.platform.shared.content.DocumentType;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Renamed slugs ({@code slug_redirect}, BACKEND_SPEC.md §5.5): old links keep working via a 301. */
@Component
public class SlugRedirects {

    static final String TARGET = "SELECT new_slug FROM slug_redirect WHERE doc_type = :type AND old_slug = :slug";

    private final JdbcClient jdbc;

    public SlugRedirects(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> target(DocumentType type, String slug) {
        return jdbc.sql(TARGET).param("type", type.name()).param("slug", slug).query(String.class).optional();
    }
}
