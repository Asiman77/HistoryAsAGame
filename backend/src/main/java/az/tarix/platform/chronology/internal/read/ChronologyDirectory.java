package az.tarix.platform.chronology.internal.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.EntityDirectory;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** Published eras, polities and rulers, for links from other modules. */
@Component
class ChronologyDirectory implements EntityDirectory {

    static final String ERAS = "SELECT slug, name FROM era WHERE slug = ANY (CAST(:slugs AS text[]))";
    static final String POLITIES = "SELECT slug, name FROM polity WHERE slug = ANY (CAST(:slugs AS text[]))";
    static final String RULERS = "SELECT slug, name FROM ruler WHERE slug = ANY (CAST(:slugs AS text[]))";

    private final JdbcClient jdbc;

    ChronologyDirectory(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Set<EntityType> types() {
        return Set.of(EntityType.ERA, EntityType.POLITY, EntityType.RULER);
    }

    @Override
    public Map<String, JsonNode> names(EntityType type, Collection<String> slugs) {
        if (slugs.isEmpty()) return Map.of();
        String sql = switch (type) {
            case ERA -> ERAS;
            case POLITY -> POLITIES;
            case RULER -> RULERS;
            default -> throw new IllegalArgumentException("not a chronology type: " + type);
        };
        Map<String, JsonNode> out = new HashMap<>();
        jdbc.sql(sql).param("slugs", slugs.toArray(String[]::new))
                .query((rs, n) -> Map.entry(rs.getString("slug"), JsonColumns.json(rs, "name"))).list()
                .forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }
}
