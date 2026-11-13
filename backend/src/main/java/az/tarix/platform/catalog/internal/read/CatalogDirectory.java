package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.EntityDirectory;
import az.tarix.platform.shared.read.EntityLinks.Target;
import az.tarix.platform.shared.read.PlannedTitles;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** Published persons, conflicts, battles, states and heroes, and the titles of announced entities. */
@Component
class CatalogDirectory implements EntityDirectory, PlannedTitles {

    static final String PERSONS = "SELECT slug, name FROM person WHERE slug = ANY (CAST(:slugs AS text[]))";
    static final String CONFLICTS = "SELECT slug, name FROM conflict WHERE slug = ANY (CAST(:slugs AS text[]))";
    static final String BATTLES = "SELECT slug, name FROM battle WHERE slug = ANY (CAST(:slugs AS text[]))";
    static final String STATES = "SELECT slug, name FROM state_profile WHERE slug = ANY (CAST(:slugs AS text[]))";
    static final String HEROES = "SELECT slug, full_name AS name FROM hero WHERE slug = ANY (CAST(:slugs AS text[]))";

    static final String PLANNED = """
            SELECT entity_type, slug, title FROM planned_entity
            WHERE (entity_type, slug) IN (SELECT * FROM unnest(CAST(:types AS text[]), CAST(:slugs AS text[])))""";

    private final JdbcClient jdbc;

    CatalogDirectory(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Set<EntityType> types() {
        return Set.of(EntityType.PERSON, EntityType.CONFLICT, EntityType.BATTLE, EntityType.STATE, EntityType.HERO);
    }

    @Override
    public Map<String, JsonNode> names(EntityType type, Collection<String> slugs) {
        if (slugs.isEmpty()) return Map.of();
        String sql = switch (type) {
            case PERSON -> PERSONS;
            case CONFLICT -> CONFLICTS;
            case BATTLE -> BATTLES;
            case STATE -> STATES;
            case HERO -> HEROES;
            default -> throw new IllegalArgumentException("not a catalog type: " + type);
        };
        Map<String, JsonNode> out = new HashMap<>();
        jdbc.sql(sql).param("slugs", slugs.toArray(String[]::new))
                .query((rs, n) -> Map.entry(rs.getString("slug"), JsonColumns.json(rs, "name"))).list()
                .forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }

    @Override
    public Map<Target, JsonNode> titles(Collection<Target> targets) {
        if (targets.isEmpty()) return Map.of();
        Map<Target, JsonNode> out = new HashMap<>();
        jdbc.sql(PLANNED)
                .param("types", targets.stream().map(t -> t.type().name()).toArray(String[]::new))
                .param("slugs", targets.stream().map(Target::slug).toArray(String[]::new))
                .query((rs, n) -> Map.entry(new Target(EntityType.valueOf(rs.getString("entity_type")), rs.getString("slug")),
                        JsonColumns.json(rs, "title"))).list()
                .forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }
}
