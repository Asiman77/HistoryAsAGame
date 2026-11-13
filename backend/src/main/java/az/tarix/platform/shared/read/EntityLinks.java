package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.ApiLink.Direction;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Resolves link targets across modules with one query per entity type (no N+1): which ones
 * are published, what they are called, and the announced title of those still to come.
 */
@Component
public class EntityLinks {

    /** A link target without its step: {@code type:slug}. */
    public record Target(EntityType type, String slug) {

        /** The target of a content {@code EntityRef} ({@code {type: "person", id: "…"}}); null when malformed. */
        public static Target of(JsonNode ref) {
            if (!ref.path("type").isString() || !ref.path("id").isString()) return null;
            try {
                return new Target(EntityType.valueOf(ref.path("type").stringValue().toUpperCase(Locale.ROOT)),
                        ref.path("id").stringValue());
            } catch (IllegalArgumentException unknownType) {
                return null;
            }
        }
    }

    /** What was found for a set of targets. */
    public record Resolved(Map<Target, JsonNode> published, Map<Target, JsonNode> planned) {

        public boolean available(Target target) {
            return published.containsKey(target);
        }

        /** The published name, else the announced title, else null. */
        public JsonNode name(Target target) {
            JsonNode name = published.get(target);
            return name != null ? name : planned.get(target);
        }
    }

    private final Map<EntityType, EntityDirectory> directories = new EnumMap<>(EntityType.class);
    private final ObjectProvider<PlannedTitles> planned;

    public EntityLinks(List<EntityDirectory> directories, ObjectProvider<PlannedTitles> planned) {
        for (EntityDirectory d : directories) {
            for (EntityType t : d.types()) {
                EntityDirectory previous = this.directories.put(t, d);
                if (previous != null) throw new IllegalStateException("two directories for " + t);
            }
        }
        this.planned = planned;
    }

    public Resolved resolve(Collection<Target> targets) {
        Map<EntityType, Set<String>> byType = new EnumMap<>(EntityType.class);
        for (Target t : targets) if (t != null) byType.computeIfAbsent(t.type(), k -> new TreeSet<>()).add(t.slug());
        Map<Target, JsonNode> published = new HashMap<>();
        byType.forEach((type, slugs) -> {
            EntityDirectory d = directories.get(type);
            if (d != null) d.names(type, new ArrayList<>(slugs)).forEach((slug, name) -> published.put(new Target(type, slug), name));
        });
        List<Target> missing = targets.stream().filter(t -> t != null && !published.containsKey(t)).distinct().toList();
        Map<Target, JsonNode> announced = missing.isEmpty() ? Map.of()
                : planned.getIfAvailable(() -> ignored -> Map.of()).titles(missing);
        return new Resolved(published, announced);
    }

    /** Resolves the targets of content {@code EntityRef}s. */
    public Resolved resolveRefs(Collection<JsonNode> refs) {
        return resolve(refs.stream().map(Target::of).filter(java.util.Objects::nonNull).toList());
    }

    /**
     * A content {@code EntityRef} as an outgoing link; null when malformed. The name falls back
     * to the ref's own {@code label}.
     */
    public static ApiLink link(JsonNode ref, String relation, String fromStepKey, Resolved resolved, Lang lang) {
        Target target = Target.of(ref);
        if (target == null) return null;
        JsonNode name = resolved.name(target);
        return new ApiLink(target.type(), target.slug(), ref.path("stepId").isString() ? ref.path("stepId").stringValue() : null,
                relation, Direction.OUTGOING, resolved.available(target), lang.text(name != null ? name : ref.path("label")),
                lang.text(ref.path("label")), lang.text(ref.path("note")), fromStepKey, ApiSource.all(ref.path("sources")));
    }

    /** {@link #link} for each ref of a JSON array, skipping malformed ones. */
    public static List<ApiLink> links(JsonNode refs, String relation, Resolved resolved, Lang lang) {
        List<ApiLink> out = new ArrayList<>();
        if (refs != null) for (JsonNode ref : refs) {
            ApiLink l = link(ref, relation, null, resolved, lang);
            if (l != null) out.add(l);
        }
        return out;
    }
}
