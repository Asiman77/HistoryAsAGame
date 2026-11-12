package az.tarix.platform.editorial.internal.importing;

import az.tarix.platform.shared.content.DocumentType;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Reads the frontend's {@code data/} folder as editorial documents, grouped as ADR-0007
 * says and laid out as ADR-0011 says (a person = person.json + events.json + its outgoing
 * relations). Built territory polygons come from {@code public/data/territories}.
 *
 * <p>Files are not validated here (that is the validator's job); unreadable files and rows
 * that belong to no document are reported as problems.
 */
public final class DataFolder {

    /** One document, and the files it was assembled from (relative to the data folder). */
    public record Doc(DocumentType type, String slug, ObjectNode content, List<String> files) {}

    /** All documents and what could not be placed in one. */
    public record Result(List<Doc> documents, List<String> problems) {}

    private static final JsonMapper JSON = JsonMapper.shared();
    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private final Path data;
    private final Path builtTerritories;
    private final List<Doc> out = new ArrayList<>();
    private final List<String> problems = new ArrayList<>();
    private final Set<String> keys = new HashSet<>();

    private DataFolder(Path data, Path builtTerritories) {
        this.data = data;
        this.builtTerritories = builtTerritories;
    }

    public static Result read(Path data, Path builtTerritories) {
        if (!Files.isDirectory(data)) throw new IllegalArgumentException("data qovluğu tapılmadı: " + data.toAbsolutePath());
        DataFolder f = new DataFolder(data, builtTerritories);
        f.readAll();
        return new Result(List.copyOf(f.out), List.copyOf(f.problems));
    }

    private void readAll() {
        JsonNode relations = read("relations.json").path("relations");
        Set<String> persons = new HashSet<>();
        for (Path dir : dirs("persons")) {
            JsonNode person = read(rel(dir.resolve("person.json")));
            if (person.isMissingNode()) continue;
            String id = person.path("id").asString(dir.getFileName().toString());
            persons.add(id);
            ObjectNode c = NODES.objectNode();
            c.set("person", person);
            c.set("events", read(rel(dir.resolve("events.json"))).path("events"));
            ArrayNode own = c.putArray("relations");
            for (JsonNode r : relations) if (id.equals(r.path("from").asString())) own.add(r);
            add(DocumentType.PERSON, id, c, rel(dir.resolve("person.json")), rel(dir.resolve("events.json")), "relations.json");
        }
        for (JsonNode r : relations) {
            if (!persons.contains(r.path("from").asString())) {
                problems.add("relations.json: '%s' → '%s' əlaqəsi heç bir şəxsiyyət sənədinə düşmür".formatted(
                        r.path("from").asString(), r.path("to").asString()));
            }
        }

        for (Path dir : dirs("conflicts")) {
            JsonNode conflict = read(rel(dir.resolve("conflict.json")));
            if (conflict.isMissingNode()) continue;
            String id = conflict.path("id").asString(dir.getFileName().toString());
            ObjectNode c = NODES.objectNode();
            c.set("conflict", conflict);
            c.set("days", read(rel(dir.resolve("days.json"))).path("days"));
            JsonNode settlements = optional(rel(dir.resolve("settlements.json")));
            if (settlements.isObject()) {
                c.set("settlements", settlements.path("settlements"));
                if (settlements.path("source").isString()) c.set("settlementsSource", settlements.path("source"));
            }
            JsonNode commanders = optional(rel(dir.resolve("commanders.json")));
            if (commanders.isObject()) c.set("commanders", commanders.path("commanders"));
            add(DocumentType.CONFLICT, id, c, rel(dir.resolve("conflict.json")), rel(dir.resolve("days.json")),
                    rel(dir.resolve("settlements.json")), rel(dir.resolve("commanders.json")));

            String heroes = rel(dir.resolve("heroes.json"));
            for (JsonNode hero : optional(heroes).path("heroes")) {
                ObjectNode h = NODES.objectNode();
                h.put("conflictId", id);
                h.set("hero", hero);
                add(DocumentType.HERO, hero.path("id").asString(), h, heroes);
            }
            String soundtrack = rel(dir.resolve("soundtrack.json"));
            for (JsonNode track : optional(soundtrack).path("tracks")) {
                ObjectNode t = NODES.objectNode();
                t.put("conflictId", id);
                t.set("track", track);
                add(DocumentType.SOUNDTRACK_TRACK, track.path("trackId").asString(), t, soundtrack);
            }
            for (Path f : jsonFiles(dir.resolve("battles"))) single(DocumentType.BATTLE, "battle", read(rel(f)), rel(f));
        }

        for (Path dir : dirs("states")) {
            JsonNode state = read(rel(dir.resolve("state.json")));
            if (state.isMissingNode()) continue;
            ObjectNode c = NODES.objectNode();
            c.set("state", state);
            c.set("steps", read(rel(dir.resolve("steps.json"))).path("steps"));
            add(DocumentType.STATE, state.path("id").asString(dir.getFileName().toString()), c,
                    rel(dir.resolve("state.json")), rel(dir.resolve("steps.json")));
        }

        JsonNode reigns = optional("reigns.json").path("reigns");
        Set<String> polities = new HashSet<>();
        for (Path f : jsonFiles(data.resolve("polities"))) {
            JsonNode polity = read(rel(f));
            if (polity.isMissingNode()) continue;
            String id = polity.path("id").asString();
            polities.add(id);
            ObjectNode c = NODES.objectNode();
            c.set("polity", polity);
            ArrayNode own = c.putArray("reigns");
            for (JsonNode r : reigns) if (id.equals(r.path("polityId").asString())) own.add(r);
            add(DocumentType.POLITY, id, c, rel(f), "reigns.json");
        }
        for (JsonNode r : reigns) {
            if (!polities.contains(r.path("polityId").asString())) {
                problems.add("reigns.json: '%s' hakimiyyəti naməlum dövlətə (%s) aiddir".formatted(
                        r.path("rulerId").asString(), r.path("polityId").asString()));
            }
        }

        for (JsonNode p : optional("places.json").path("places")) single(DocumentType.PLACE, "place", p, "places.json");
        for (JsonNode r : optional("rulers.json").path("rulers")) single(DocumentType.RULER, "ruler", r, "rulers.json");
        for (Path f : jsonFiles(data.resolve("eras"))) single(DocumentType.ERA, "era", read(rel(f)), rel(f));
        for (Path f : jsonFiles(data.resolve("themes"))) single(DocumentType.THEME, "theme", read(rel(f)), rel(f));
        for (JsonNode g : optional("glossary.json").path("entries")) single(DocumentType.GLOSSARY_ENTRY, "entry", g, "glossary.json");
        for (JsonNode d : optional("commemorations.json").path("days")) {
            single(DocumentType.COMMEMORATION, "commemoration", d, "commemorations.json");
        }
        for (JsonNode e : optional("world-events.json").path("events")) single(DocumentType.WORLD_EVENT, "event", e, "world-events.json");
        for (JsonNode e : optional("planned.json").path("entities")) single(DocumentType.PLANNED_ENTITY, "entity", e, "planned.json");

        for (Path f : jsonFiles(data.resolve("territories").resolve("snapshots"))) {
            JsonNode snapshot = read(rel(f));
            if (snapshot.isMissingNode()) continue;
            ObjectNode c = NODES.objectNode();
            c.set("snapshot", snapshot);
            Path built = builtTerritories == null ? null : builtTerritories.resolve(f.getFileName());
            List<String> files = new ArrayList<>(List.of(rel(f)));
            if (built != null && Files.isRegularFile(built)) {
                c.set("built", parse(built, built.toString()));
                files.add(built.toString().replace('\\', '/'));
            } else {
                problems.add(rel(f) + ": qurulmuş poliqon faylı yoxdur (scripts/build-territories.ts); xəritəsiz idxal olunur");
            }
            add(DocumentType.TERRITORY_SNAPSHOT, snapshot.path("id").asString(), c, files.toArray(String[]::new));
        }
        JsonNode registry = optional("territories/registry.json");
        if (registry.isObject()) {
            ObjectNode c = NODES.objectNode();
            c.set("registry", registry);
            add(DocumentType.TERRITORY_REGISTRY, "registry", c, "territories/registry.json");
        }
    }

    private void single(DocumentType type, String key, JsonNode value, String file) {
        if (value.isMissingNode()) return;
        ObjectNode c = NODES.objectNode();
        c.set(key, value);
        add(type, value.path("id").asString(), c, file);
    }

    private void add(DocumentType type, String slug, ObjectNode content, String... files) {
        if (slug == null || slug.isBlank()) {
            problems.add("%s: id yoxdur, sənəd yaradılmadı".formatted(String.join(", ", files)));
            return;
        }
        if (!keys.add(type + ":" + slug)) {
            problems.add("%s: '%s' (%s) təkrarlanır; yalnız birincisi idxal olunur".formatted(String.join(", ", files), slug, type));
            return;
        }
        out.add(new Doc(type, slug, content, List.of(files)));
    }

    /** A required file: a problem when missing or broken. */
    private JsonNode read(String relative) {
        Path file = data.resolve(relative);
        if (!Files.isRegularFile(file)) {
            problems.add(relative + ": fayl yoxdur");
            return NODES.missingNode();
        }
        return parse(file, relative);
    }

    /** An optional file: missing is fine. */
    private JsonNode optional(String relative) {
        Path file = data.resolve(relative);
        return Files.isRegularFile(file) ? parse(file, relative) : NODES.missingNode();
    }

    private JsonNode parse(Path file, String name) {
        try {
            return JSON.readTree(file.toFile());
        } catch (JacksonException e) {
            problems.add(name + ": JSON oxunmadı (" + e.getOriginalMessage() + ")");
            return NODES.missingNode();
        }
    }

    private String rel(Path file) {
        return data.relativize(file).toString().replace('\\', '/');
    }

    private List<Path> dirs(String name) {
        return list(data.resolve(name)).stream().filter(Files::isDirectory).toList();
    }

    private static List<Path> jsonFiles(Path dir) {
        return list(dir).stream().filter(p -> p.toString().endsWith(".json") && Files.isRegularFile(p)).toList();
    }

    private static List<Path> list(Path dir) {
        if (!Files.isDirectory(dir)) return List.of();
        try (Stream<Path> s = Files.list(dir)) {
            return s.sorted().toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
