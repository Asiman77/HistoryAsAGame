package az.tarix.platform.editorial;

import az.tarix.platform.shared.content.DocumentType;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Test fixture: today's data/ folder as editorial documents, in the content layout of
 * ADR-0011 (the same grouping the importer of phase 7 will use, ADR-0007).
 */
public final class DataDocuments {

    public record Doc(DocumentType type, String slug, ObjectNode content) {}

    static final Path ROOT = Path.of("..");
    static final Path DATA = ROOT.resolve("data");
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private DataDocuments() {}

    public static List<Doc> all() {
        List<Doc> out = new ArrayList<>();
        JsonNode relations = read(DATA.resolve("relations.json")).path("relations");
        for (Path dir : dirs(DATA.resolve("persons"))) {
            String id = dir.getFileName().toString();
            ObjectNode c = NODES.objectNode();
            c.set("person", read(dir.resolve("person.json")));
            c.set("events", read(dir.resolve("events.json")).path("events"));
            ArrayNode own = c.putArray("relations");
            for (JsonNode r : relations) if (id.equals(r.path("from").asString())) own.add(r);
            out.add(new Doc(DocumentType.PERSON, id, c));
        }
        for (Path dir : dirs(DATA.resolve("conflicts"))) {
            String id = dir.getFileName().toString();
            ObjectNode c = NODES.objectNode();
            c.set("conflict", read(dir.resolve("conflict.json")));
            c.set("days", read(dir.resolve("days.json")).path("days"));
            JsonNode settlements = read(dir.resolve("settlements.json"));
            c.set("settlements", settlements.path("settlements"));
            c.set("settlementsSource", settlements.path("source"));
            c.set("commanders", read(dir.resolve("commanders.json")).path("commanders"));
            out.add(new Doc(DocumentType.CONFLICT, id, c));
            for (JsonNode hero : read(dir.resolve("heroes.json")).path("heroes")) {
                ObjectNode h = NODES.objectNode();
                h.put("conflictId", id);
                h.set("hero", hero);
                out.add(new Doc(DocumentType.HERO, hero.path("id").asString(), h));
            }
            for (JsonNode track : read(dir.resolve("soundtrack.json")).path("tracks")) {
                ObjectNode t = NODES.objectNode();
                t.put("conflictId", id);
                t.set("track", track);
                out.add(new Doc(DocumentType.SOUNDTRACK_TRACK, track.path("trackId").asString(), t));
            }
            for (Path f : files(dir.resolve("battles"))) single(out, DocumentType.BATTLE, "battle", read(f));
        }
        for (Path dir : dirs(DATA.resolve("states"))) {
            ObjectNode c = NODES.objectNode();
            c.set("state", read(dir.resolve("state.json")));
            c.set("steps", read(dir.resolve("steps.json")).path("steps"));
            out.add(new Doc(DocumentType.STATE, dir.getFileName().toString(), c));
        }
        JsonNode reigns = read(DATA.resolve("reigns.json")).path("reigns");
        for (Path f : files(DATA.resolve("polities"))) {
            JsonNode polity = read(f);
            ObjectNode c = NODES.objectNode();
            c.set("polity", polity);
            ArrayNode own = c.putArray("reigns");
            for (JsonNode r : reigns) if (polity.path("id").asString().equals(r.path("polityId").asString())) own.add(r);
            out.add(new Doc(DocumentType.POLITY, polity.path("id").asString(), c));
        }
        for (JsonNode p : read(DATA.resolve("places.json")).path("places")) single(out, DocumentType.PLACE, "place", p);
        for (JsonNode r : read(DATA.resolve("rulers.json")).path("rulers")) single(out, DocumentType.RULER, "ruler", r);
        for (Path f : files(DATA.resolve("eras"))) single(out, DocumentType.ERA, "era", read(f));
        for (Path f : files(DATA.resolve("themes"))) single(out, DocumentType.THEME, "theme", read(f));
        for (JsonNode g : read(DATA.resolve("glossary.json")).path("entries")) single(out, DocumentType.GLOSSARY_ENTRY, "entry", g);
        for (JsonNode d : read(DATA.resolve("commemorations.json")).path("days")) single(out, DocumentType.COMMEMORATION, "commemoration", d);
        for (JsonNode e : read(DATA.resolve("world-events.json")).path("events")) single(out, DocumentType.WORLD_EVENT, "event", e);
        for (JsonNode e : read(DATA.resolve("planned.json")).path("entities")) single(out, DocumentType.PLANNED_ENTITY, "entity", e);
        for (Path f : files(DATA.resolve("territories").resolve("snapshots"))) {
            JsonNode snapshot = read(f);
            ObjectNode c = NODES.objectNode();
            c.set("snapshot", snapshot);
            Path built = ROOT.resolve("public/data/territories").resolve(f.getFileName());
            if (Files.exists(built)) c.set("built", read(built));
            out.add(new Doc(DocumentType.TERRITORY_SNAPSHOT, snapshot.path("id").asString(), c));
        }
        ObjectNode registry = NODES.objectNode();
        registry.set("registry", read(DATA.resolve("territories/registry.json")));
        out.add(new Doc(DocumentType.TERRITORY_REGISTRY, "registry", registry));
        return out;
    }

    public static Doc find(DocumentType type, String slug) {
        return all().stream().filter(d -> d.type() == type && d.slug().equals(slug)).findFirst().orElseThrow();
    }

    private static void single(List<Doc> out, DocumentType type, String key, JsonNode value) {
        ObjectNode c = NODES.objectNode();
        c.set(key, value);
        out.add(new Doc(type, value.path("id").asString(), c));
    }

    static JsonNode read(Path file) {
        return JSON.readTree(file.toFile());
    }

    private static List<Path> dirs(Path parent) {
        return list(parent).stream().filter(Files::isDirectory).toList();
    }

    private static List<Path> files(Path parent) {
        if (!Files.isDirectory(parent)) return List.of();
        return list(parent).stream().filter(p -> p.toString().endsWith(".json")).toList();
    }

    private static List<Path> list(Path parent) {
        try (Stream<Path> s = Files.list(parent)) {
            return s.sorted().toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
