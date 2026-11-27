package az.tarix.platform.publishing.internal.export;

import az.tarix.platform.editorial.api.PublishedContents.Positioned;
import az.tarix.platform.shared.content.PublishedContent;
import az.tarix.platform.shared.read.MediaIndex;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * The published documents as the frontend's files (BACKEND_SPEC.md §15, ADR-0006, ADR-0019):
 * the inverse of the importer's {@code DataFolder}. Paths are relative to the repository root:
 * {@code data/…} and the built polygons in {@code public/data/territories/…}.
 *
 * <p>Documents arrive sorted by their position, so files shared by many documents
 * (places.json, heroes.json, reigns.json…) keep the authored order. Media are cleaned first
 * ({@link ExportMedia}). Pure: no database, no storage.
 */
public final class ExportLayout {

    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    /** Files every export has, even when empty (the frontend reads them unconditionally). */
    private static final Map<String, String> SHARED = new LinkedHashMap<>();

    static {
        SHARED.put("data/places.json", "places");
        SHARED.put("data/rulers.json", "rulers");
        SHARED.put("data/reigns.json", "reigns");
        SHARED.put("data/relations.json", "relations");
        SHARED.put("data/glossary.json", "entries");
        SHARED.put("data/commemorations.json", "days");
        SHARED.put("data/world-events.json", "events");
        SHARED.put("data/planned.json", "entities");
    }

    private final Map<String, JsonNode> files = new TreeMap<>();
    private final Map<String, ArrayNode> lists = new LinkedHashMap<>();

    private ExportLayout() {}

    /** All files, sorted by path. */
    public static Map<String, JsonNode> build(List<Positioned> documents, MediaIndex media) {
        ExportLayout l = new ExportLayout();
        SHARED.forEach(l::list);
        for (Positioned p : documents) {
            PublishedContent clean = ExportMedia.clean(p.content(), media);
            if (clean != null) l.add(clean);
        }
        return l.files;
    }

    private void add(PublishedContent d) {
        String s = d.slug();
        switch (d.type()) {
            case PERSON -> {
                put("data/persons/" + s + "/person.json", d.part("person"));
                put("data/persons/" + s + "/events.json", wrap("events", d.part("events")));
                addAll("data/relations.json", "relations", d.part("relations"));
            }
            case CONFLICT -> {
                put("data/conflicts/" + s + "/conflict.json", d.part("conflict"));
                put("data/conflicts/" + s + "/days.json", wrap("days", d.part("days")));
                if (d.part("settlements").isArray()) {
                    ObjectNode settlements = NODES.objectNode();
                    if (d.part("settlementsSource").isString()) settlements.set("source", d.part("settlementsSource"));
                    settlements.set("settlements", d.part("settlements"));
                    put("data/conflicts/" + s + "/settlements.json", settlements);
                }
                if (d.part("commanders").isArray()) put("data/conflicts/" + s + "/commanders.json", wrap("commanders", d.part("commanders")));
            }
            case HERO -> list("data/conflicts/" + d.part("conflictId").asString() + "/heroes.json", "heroes").add(d.part("hero"));
            case SOUNDTRACK_TRACK -> list("data/conflicts/" + d.part("conflictId").asString() + "/soundtrack.json", "tracks")
                    .add(d.part("track"));
            case BATTLE -> put("data/conflicts/" + d.part("battle").path("conflictId").asString() + "/battles/" + s + ".json",
                    d.part("battle"));
            case STATE -> {
                put("data/states/" + s + "/state.json", d.part("state"));
                put("data/states/" + s + "/steps.json", wrap("steps", d.part("steps")));
            }
            case POLITY -> {
                put("data/polities/" + s + ".json", d.part("polity"));
                addAll("data/reigns.json", "reigns", d.part("reigns"));
            }
            case PLACE -> list("data/places.json", "places").add(d.part("place"));
            case RULER -> list("data/rulers.json", "rulers").add(d.part("ruler"));
            case ERA -> put("data/eras/" + s + ".json", d.part("era"));
            case THEME -> put("data/themes/" + s + ".json", d.part("theme"));
            case GLOSSARY_ENTRY -> list("data/glossary.json", "entries").add(d.part("entry"));
            case COMMEMORATION -> list("data/commemorations.json", "days").add(d.part("commemoration"));
            case WORLD_EVENT -> list("data/world-events.json", "events").add(d.part("event"));
            case PLANNED_ENTITY -> list("data/planned.json", "entities").add(d.part("entity"));
            case TERRITORY_SNAPSHOT -> {
                put("data/territories/snapshots/" + s + ".json", d.part("snapshot"));
                if (d.part("built").isObject()) put("public/data/territories/" + s + ".json", d.part("built"));
            }
            case TERRITORY_REGISTRY -> put("data/territories/registry.json", d.part("registry"));
            case CURRICULUM_GRADE -> put("data/curriculum/" + d.part("grade").path("subject").asString() + "/"
                    + d.part("grade").path("grade").asInt() + ".json", d.part("grade"));
            default -> { }     // SOURCE: not a file of its own (ADR-0007)
        }
    }

    private void put(String path, JsonNode node) {
        files.put(path, node);
    }

    /** The array of a file shared by many documents, created with its wrapper object. */
    private ArrayNode list(String path, String key) {
        return lists.computeIfAbsent(path, p -> {
            ObjectNode file = NODES.objectNode();
            ArrayNode items = file.putArray(key);
            files.put(p, file);
            return items;
        });
    }

    private void addAll(String path, String key, JsonNode items) {
        ArrayNode list = list(path, key);
        for (JsonNode i : items) list.add(i);
    }

    private static ObjectNode wrap(String key, JsonNode items) {
        ObjectNode file = NODES.objectNode();
        file.set(key, items.isArray() ? items : NODES.arrayNode());
        return file;
    }

    /** Paths of the files every export has; for the tests. */
    static List<String> sharedFiles() {
        return new ArrayList<>(SHARED.keySet());
    }
}
