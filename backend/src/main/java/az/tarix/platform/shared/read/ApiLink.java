package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.EntityType;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * A link to another entity (BACKEND_SPEC.md §5.3, §10.2). The target may not be published yet;
 * then {@code available} is false and the link is shown as a passive chip. It becomes active by
 * itself when the target is published.
 *
 * @param stepKey   step inside the target simulation, or null
 * @param relation  {@code PARENT}, {@code RIVAL}, {@code RELATED}, …
 * @param direction {@code OUTGOING} when this entity links to the target, {@code INCOMING} when the target links here
 * @param name      the target's name when published, else the planned title or the link's own label
 * @param label     how the link describes the relation ("Ana babası"), or null
 * @param fromStepKey step of this entity the link starts from, or null
 */
public record ApiLink(EntityType type, String slug, String stepKey, String relation, Direction direction, boolean available,
                      JsonNode name, JsonNode label, JsonNode note, String fromStepKey, List<ApiSource> sources) {

    public enum Direction { OUTGOING, INCOMING }
}
