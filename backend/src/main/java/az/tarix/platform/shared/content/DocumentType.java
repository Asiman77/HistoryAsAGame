package az.tarix.platform.shared.content;

import static az.tarix.platform.shared.content.ContentPart.list;
import static az.tarix.platform.shared.content.ContentPart.object;
import static az.tarix.platform.shared.content.ContentPart.optionalObject;
import static az.tarix.platform.shared.content.ContentPart.optionalText;
import static az.tarix.platform.shared.content.ContentPart.slug;
import static az.tarix.platform.shared.content.ContentPart.wrappedItem;

import java.util.List;
import java.util.Optional;

/**
 * Kinds of editorial documents (BACKEND_SPEC.md §6 + ADR-0007) and the layout of their
 * content (ADR-0011). One document bundles what the data/ folder keeps in several files,
 * e.g. a person with its life events and outgoing relations.
 */
public enum DocumentType {

    PERSON("/person/id", "/person/name/az",
            object("person", "Person"), list("events", "LifeEvent", true, 1), list("relations", "Relation", false, 0)),
    CONFLICT("/conflict/id", "/conflict/name/az",
            object("conflict", "Conflict"), list("days", "WarDay", true, 1), list("settlements", "Settlement", false, 0),
            optionalText("settlementsSource"), list("commanders", "Commander", false, 0)),
    BATTLE("/battle/id", "/battle/name/az", object("battle", "Battle")),
    STATE("/state/id", "/state/name/az", object("state", "State"), list("steps", "StateStep", true, 1)),
    PLACE("/place/id", "/place/names/historical/az", object("place", "Place")),
    POLITY("/polity/id", "/polity/name/az", object("polity", "Polity"), list("reigns", "Reign", false, 0)),
    RULER("/ruler/id", "/ruler/name/az", object("ruler", "Ruler")),
    ERA("/era/id", "/era/name/az", object("era", "Era")),
    THEME("/theme/id", "/theme/name/az", object("theme", "ThemeFile")),
    TERRITORY_SNAPSHOT("/snapshot/id", "/snapshot/title/az",
            object("snapshot", "TerritorySnapshotSource"),
            // The polygons built from it by scripts/build-territories.ts (public/data/territories/y*.json).
            optionalObject("built", "TerritorySnapshot")),
    HERO("/hero/id", "/hero/name/az", slug("conflictId"), object("hero", "Hero")),
    /** Sources are inline in today's data (ADR-0007); the type exists for future shared sources. */
    SOURCE(null, "/source/title", object("source", "Source")),
    GLOSSARY_ENTRY("/entry/id", "/entry/term/az", object("entry", "GlossaryEntry")),
    COMMEMORATION("/commemoration/id", "/commemoration/title/az", object("commemoration", "Commemoration")),
    WORLD_EVENT("/event/id", "/event/title/az", object("event", "WorldEvent")),
    PLANNED_ENTITY("/entity/id", "/entity/title/az", wrappedItem("entity", "PlannedFile", "entities")),
    SOUNDTRACK_TRACK("/track/trackId", "/track/title/az", slug("conflictId"), object("track", "Track")),
    /** Region registry for the territory authoring tool; never projected (ADR-0007). */
    TERRITORY_REGISTRY(null, null, object("registry", "TerritoryRegistryFile"));

    private final String idPointer;
    private final String titlePointer;
    private final List<ContentPart> parts;

    DocumentType(String idPointer, String titlePointer, ContentPart... parts) {
        this.idPointer = idPointer;
        this.titlePointer = titlePointer;
        this.parts = List.of(parts);
    }

    /** JSON Pointer to the id inside the content; it must equal the document slug. Empty when the type has none. */
    public Optional<String> idPointer() {
        return Optional.ofNullable(idPointer);
    }

    /** JSON Pointer to the Azerbaijani title shown in lists. */
    public Optional<String> titlePointer() {
        return Optional.ofNullable(titlePointer);
    }

    public List<ContentPart> parts() {
        return parts;
    }

    public Optional<ContentPart> part(String key) {
        return parts.stream().filter(p -> p.key().equals(key)).findFirst();
    }
}
