package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.editorial.api.DocumentType;
import az.tarix.platform.editorial.internal.content.ContentJson;
import az.tarix.platform.editorial.internal.validation.ReferenceLookup.Target;
import az.tarix.platform.editorial.internal.validation.ValidationIssue.Level;
import az.tarix.platform.shared.schema.ContentSchemas;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import tools.jackson.databind.JsonNode;

/** What a rule sees: the document, its content, the lookups, and where to report issues. */
public final class ValidationContext {

    /** A node and where it is. */
    public record Item(String pointer, JsonNode node) {

        public String at(String child) {
            return pointer + "/" + ContentJson.escape(child);
        }

        public String text(String field) {
            JsonNode n = node.path(field);
            return n.isString() ? n.stringValue() : null;
        }
    }

    private final DocumentType type;
    private final String slug;
    private final JsonNode content;
    private final ContentSchemas schemas;
    private final ReferenceLookup references;
    private final GeometryCheck geometry;
    private final Set<String> musicThemes;
    private final List<ValidationIssue> issues = new ArrayList<>();
    private final Map<String, Target> targets = new HashMap<>();

    public ValidationContext(DocumentType type, String slug, JsonNode content, ContentSchemas schemas,
                             ReferenceLookup references, GeometryCheck geometry, Set<String> musicThemes) {
        this.type = type;
        this.slug = slug;
        this.content = content;
        this.schemas = schemas;
        this.references = references;
        this.geometry = geometry;
        this.musicThemes = Set.copyOf(musicThemes);
    }

    public DocumentType type() {
        return type;
    }

    public String slug() {
        return slug;
    }

    public JsonNode content() {
        return content;
    }

    public ContentSchemas schemas() {
        return schemas;
    }

    public GeometryCheck geometry() {
        return geometry;
    }

    public Set<String> musicThemes() {
        return musicThemes;
    }

    public List<ValidationIssue> issues() {
        return List.copyOf(issues);
    }

    // --- content access -----------------------------------------------------------------------

    public Item part(String key) {
        return new Item("/" + key, content.path(key));
    }

    /** Items of an array part (empty when missing or not an array). */
    public List<Item> list(String key) {
        return items(part(key));
    }

    public static List<Item> items(Item array) {
        if (!array.node().isArray()) return List.of();
        List<Item> out = new ArrayList<>(array.node().size());
        for (int i = 0; i < array.node().size(); i++) out.add(new Item(array.pointer() + "/" + i, array.node().get(i)));
        return out;
    }

    public static Item child(Item parent, String field) {
        return new Item(parent.at(field), parent.node().path(field));
    }

    /** The simulation steps of the document: life events, war days or state steps. */
    public List<Item> steps() {
        return switch (type) {
            case PERSON -> list("events");
            case CONFLICT -> list("days");
            case STATE -> list("steps");
            default -> List.of();
        };
    }

    /** Visits every node of the content, depth first, with its pointer ("" for the root). */
    public void walk(BiConsumer<String, JsonNode> visitor) {
        walk("", content, visitor);
    }

    private static void walk(String pointer, JsonNode node, BiConsumer<String, JsonNode> visitor) {
        visitor.accept(pointer, node);
        if (node.isObject()) {
            for (Map.Entry<String, JsonNode> e : node.properties()) {
                walk(pointer + "/" + ContentJson.escape(e.getKey()), e.getValue(), visitor);
            }
        } else if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) walk(pointer + "/" + i, node.get(i), visitor);
        }
    }

    // --- references -------------------------------------------------------------------------

    public Target target(DocumentType targetType, String targetSlug) {
        return targets.computeIfAbsent(targetType + ":" + targetSlug, k -> references.find(targetType, targetSlug));
    }

    /**
     * A reference the public pages depend on (a place, a polity, a theme…): a missing target
     * is an ERROR, a target that is not published yet a WARNING.
     */
    public void requireTarget(DocumentType targetType, String targetSlug, String pointer, String what) {
        if (targetSlug == null) return;
        switch (target(targetType, targetSlug)) {
            case MISSING, PLANNED -> error("unknown-reference", pointer, "naməlum %s: %s".formatted(what, targetSlug));
            case UNPUBLISHED -> warning("unpublished-reference", pointer,
                    "%s '%s' hələ dərc olunmayıb".formatted(what, targetSlug));
            case PUBLISHED -> { }
        }
    }

    // --- reporting ----------------------------------------------------------------------------

    public void error(String code, String pointer, String message) {
        add(Level.ERROR, code, pointer, message);
    }

    public void warning(String code, String pointer, String message) {
        add(Level.WARNING, code, pointer, message);
    }

    public void info(String code, String pointer, String message) {
        add(Level.INFO, code, pointer, message);
    }

    public void add(Level level, String code, String pointer, String message) {
        issues.add(new ValidationIssue(level, code, pointer == null || pointer.isEmpty() ? "/" : pointer, message));
    }
}
