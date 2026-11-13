package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.EntityType;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;

/**
 * Which entities are published, and their names: lets a link say whether its target is
 * available (BACKEND_SPEC.md §5.3) without the linking module reading another module's tables.
 * Each module implements it for the entity types it owns; {@link EntityLinks} asks all of them.
 */
public interface EntityDirectory {

    Set<EntityType> types();

    /**
     * The display name ({@code LocalizedText} JSON) of every published entity of {@code type}
     * among {@code slugs}. Slugs without a published entity are absent from the result.
     */
    Map<String, JsonNode> names(EntityType type, Collection<String> slugs);
}
