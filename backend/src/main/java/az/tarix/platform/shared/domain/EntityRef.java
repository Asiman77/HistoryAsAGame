package az.tarix.platform.shared.domain;

import java.util.Objects;

/**
 * Pointer to an entity, optionally to one step of its simulation. References use slugs,
 * never ids: the target may not exist yet (planned content). That is not an error; the
 * link becomes active when the target is published.
 *
 * @param stepKey step inside the target simulation, or null
 */
public record EntityRef(EntityType type, String slug, String stepKey) {

    public EntityRef {
        Objects.requireNonNull(type, "type");
        Slugs.requireValid(slug);
        if (stepKey != null) Slugs.requireValid(stepKey);
    }

    public static EntityRef of(EntityType type, String slug) {
        return new EntityRef(type, slug, null);
    }

    /** Parses {@code "person:shah-ismayil"} or {@code "person:shah-ismayil:1501-tabriz"} (used by /compare). */
    public static EntityRef parse(String text) {
        String[] parts = text.split(":", -1);
        if (parts.length < 2 || parts.length > 3) throw new IllegalArgumentException("expected type:slug[:stepKey], got " + text);
        EntityType type = DataEnum.fromData(EntityType.class, parts[0]);
        return new EntityRef(type, parts[1], parts.length == 3 ? parts[2] : null);
    }

    @Override
    public String toString() {
        return type.dataValue() + ":" + slug + (stepKey == null ? "" : ":" + stepKey);
    }
}
