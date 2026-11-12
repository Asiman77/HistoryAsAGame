package az.tarix.platform.catalog.internal.projection;

import static az.tarix.platform.shared.content.ContentValues.bool;
import static az.tarix.platform.shared.content.ContentValues.enumName;
import static az.tarix.platform.shared.content.ContentValues.integer;
import static az.tarix.platform.shared.content.ContentValues.json;
import static az.tarix.platform.shared.content.ContentValues.jsonArray;
import static az.tarix.platform.shared.content.ContentValues.number;
import static az.tarix.platform.shared.content.ContentValues.strings;
import static az.tarix.platform.shared.content.ContentValues.text;

import az.tarix.platform.catalog.internal.projection.StepWriter.Owner;
import az.tarix.platform.shared.content.ContentValues;
import az.tarix.platform.shared.content.ProjectionWriter;
import az.tarix.platform.shared.content.PublishedContent;
import az.tarix.platform.shared.domain.HistoricalDate;
import az.tarix.platform.shared.jdbc.HistoricalDateColumns;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Projects persons, conflicts, states, battles, heroes, glossary entries, commemorations,
 * world events, planned entities and the cross-links of rulers (V006, ADR-0007).
 */
@Component
class CatalogProjectionWriter implements ProjectionWriter {

    static final String INSERT_PERSON = """
            INSERT INTO person (slug, name, short_name, titles,
              birth_year, birth_month, birth_day, birth_precision, birth_certainty, birth_alternatives, birth_note,
              death_year, death_month, death_day, death_precision, death_certainty, death_alternatives, death_note,
              birth_location, death_location, birth_place_slug, death_place_slug, short_bio, legacy, epigraph,
              era_slugs, tags, theme_slug, featured_order, portrait, document_id)
            VALUES (:slug, CAST(:name AS jsonb), CAST(:shortName AS jsonb), CAST(:titles AS jsonb),
              :birth_year, :birth_month, :birth_day, :birth_precision, :birth_certainty,
              CAST(:birth_alternatives AS jsonb), CAST(:birth_note AS jsonb),
              :death_year, :death_month, :death_day, :death_precision, :death_certainty,
              CAST(:death_alternatives AS jsonb), CAST(:death_note AS jsonb),
              CAST(:birthLocation AS jsonb), CAST(:deathLocation AS jsonb), :birthPlace, :deathPlace,
              CAST(:shortBio AS jsonb), CAST(:legacy AS jsonb), CAST(:epigraph AS jsonb),
              CAST(:eras AS text[]), CAST(:tags AS text[]), :theme, :featured, CAST(:portrait AS jsonb), :doc)""";

    static final String INSERT_CONFLICT = """
            INSERT INTO conflict (slug, name, display_title, years,
              start_year, start_month, start_day, start_precision, start_certainty,
              end_year, end_month, end_day, end_precision, end_certainty,
              summary, legacy, intro_date, final_notes, era_slugs, theme_slug, sources, document_id)
            VALUES (:slug, CAST(:name AS jsonb), CAST(:heading AS jsonb), :years,
              :start_year, :start_month, :start_day, :start_precision, :start_certainty,
              :end_year, :end_month, :end_day, :end_precision, :end_certainty,
              CAST(:summary AS jsonb), CAST(:legacy AS jsonb), CAST(:introDate AS jsonb), CAST(:finalNotes AS jsonb),
              CAST(:eras AS text[]), :theme, CAST(:sources AS jsonb), :doc)
            RETURNING id""";

    static final String INSERT_SETTLEMENT = """
            INSERT INTO settlement (conflict_id, slug, name, district, kind, location)
            VALUES (:conflict, :slug, CAST(:name AS jsonb), CAST(:district AS jsonb), :kind,
                    CASE WHEN CAST(:lng AS double precision) IS NULL OR CAST(:lat AS double precision) IS NULL THEN NULL
                         ELSE ST_SetSRID(ST_MakePoint(CAST(:lng AS double precision), CAST(:lat AS double precision)), 4326) END)""";

    static final String INSERT_COMMANDER = """
            INSERT INTO commander (conflict_id, slug, name, position, role, step_keys, sources)
            VALUES (:conflict, :slug, CAST(:name AS jsonb), CAST(:position AS jsonb), CAST(:role AS jsonb),
                    CAST(:days AS text[]), CAST(:sources AS jsonb))""";

    static final String INSERT_STATE = """
            INSERT INTO state_profile (slug, polity_slug, name, years, start_year, end_year, summary, legacy, image, era_slugs,
                                       dynasty, theme_slug, sources, document_id)
            VALUES (:slug, :polity, CAST(:name AS jsonb), :years, :start, :end, CAST(:summary AS jsonb), CAST(:legacy AS jsonb),
                    CAST(:image AS jsonb), CAST(:eras AS text[]), CAST(:dynasty AS text[]), :theme, CAST(:sources AS jsonb), :doc)""";

    static final String INSERT_BATTLE = """
            INSERT INTO battle (slug, name, conflict_slug, step_key, dates, summary, sources, document_id)
            VALUES (:slug, CAST(:name AS jsonb), :conflict, :step, :dates, CAST(:summary AS jsonb), CAST(:sources AS jsonb), :doc)""";

    static final String INSERT_HERO = """
            INSERT INTO hero (slug, conflict_slug, full_name, rank, posthumous, birth_place, awards, bio, photo,
                              is_real_modern_person, sources, document_id)
            VALUES (:slug, :conflict, CAST(:name AS jsonb), CAST(:rank AS jsonb), :posthumous, CAST(:birthPlace AS jsonb),
                    CAST(:awards AS jsonb), CAST(:bio AS jsonb), CAST(:photo AS jsonb), true, CAST(:sources AS jsonb), :doc)""";

    static final String INSERT_GLOSSARY = """
            INSERT INTO glossary_entry (slug, term, definition, forms, sources, document_id)
            VALUES (:slug, CAST(:term AS jsonb), CAST(:definition AS jsonb), CAST(:forms AS text[]), CAST(:sources AS jsonb), :doc)""";

    static final String INSERT_COMMEMORATION = """
            INSERT INTO commemoration (slug, month, day, style, title, description, ref, sources, document_id)
            VALUES (:slug, :month, :day, :style, CAST(:title AS jsonb), CAST(:description AS jsonb), CAST(:ref AS jsonb),
                    CAST(:sources AS jsonb), :doc)""";

    static final String INSERT_WORLD_EVENT = """
            INSERT INTO world_event (slug, year, end_year, region, title, description, sources, document_id)
            VALUES (:slug, :year, :endYear, :region, CAST(:title AS jsonb), CAST(:description AS jsonb), CAST(:sources AS jsonb),
                    :doc)""";

    static final String INSERT_PLANNED = """
            INSERT INTO planned_entity (entity_type, slug, title, description, years, document_id)
            VALUES (:type, :slug, CAST(:title AS jsonb), CAST(:description AS jsonb), :years, :doc)""";

    private final JdbcClient jdbc;
    private final StepWriter steps;

    CatalogProjectionWriter(JdbcClient jdbc, StepWriter steps) {
        this.jdbc = jdbc;
        this.steps = steps;
    }

    @Override
    public void delete(UUID documentId) {
        // Settlements, commanders, claims and step sources cascade from their owners.
        jdbc.sql("DELETE FROM simulation_step WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM entity_relation WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM person WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM conflict WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM state_profile WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM battle WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM hero WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM glossary_entry WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM commemoration WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM world_event WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM planned_entity WHERE document_id = :doc").param("doc", documentId).update();
    }

    @Override
    public void deleteAll() {
        jdbc.sql("""
                TRUNCATE simulation_step, step_claim, step_source, claim_source, source, entity_relation, person, conflict,
                         settlement, commander, state_profile, battle, hero, glossary_entry, commemoration, world_event,
                         planned_entity""").update();
    }

    @Override
    public void afterChanges() {
        steps.deleteUnusedSources();
    }

    @Override
    public void write(PublishedContent doc) {
        switch (doc.type()) {
            case PERSON -> person(doc);
            case CONFLICT -> conflict(doc);
            case STATE -> state(doc);
            case BATTLE -> battle(doc);
            case HERO -> hero(doc);
            case RULER -> rulerLinks(doc);
            case GLOSSARY_ENTRY -> glossary(doc);
            case COMMEMORATION -> commemoration(doc);
            case WORLD_EVENT -> worldEvent(doc);
            case PLANNED_ENTITY -> planned(doc);
            default -> { }
        }
    }

    private void person(PublishedContent doc) {
        JsonNode p = doc.part("person");
        JsonNode birth = p.path("birth");
        JsonNode death = p.path("death");
        jdbc.sql(INSERT_PERSON).param("slug", doc.slug()).param("name", json(p.path("name")))
                .param("shortName", json(p.path("shortName"))).param("titles", jsonArray(p.path("titles")))
                .params(ContentValues.dateParams("birth", birth.path("date")))
                .params(ContentValues.dateParams("death", death.path("date")))
                .param("birthLocation", json(birth.path("place"))).param("deathLocation", json(death.path("place")))
                .param("birthPlace", text(birth.path("place").path("placeId")))
                .param("deathPlace", text(death.path("place").path("placeId")))
                .param("shortBio", json(p.path("shortBio"))).param("legacy", json(p.path("legacy")))
                .param("epigraph", json(p.path("epigraph"))).param("eras", strings(p.path("eraIds")))
                .param("tags", strings(p.path("tags"))).param("theme", text(p.path("themeId")))
                .param("featured", integer(p.path("featuredOrder"))).param("portrait", json(p.path("portrait")))
                .param("doc", doc.documentId()).update();

        Owner owner = new Owner("PERSON", doc.slug(), "LIFE_EVENT", doc.documentId(), ContentValues.date(birth.path("date")));
        int sort = 0;
        for (JsonNode r : doc.part("relations")) {
            // Relation: {from, to, type, note, sources}; "from" is this person.
            var ref = r.deepCopy();
            ((tools.jackson.databind.node.ObjectNode) ref).put("type", "person").put("id", text(r.path("to")));
            steps.relation("PERSON", doc.slug(), null, ref, enumName(r.path("type")), doc.documentId(), sort++);
        }
        writeSteps(owner, doc.part("events"), sort);
    }

    private void conflict(PublishedContent doc) {
        JsonNode c = doc.part("conflict");
        List<JsonNode> days = ordered(doc.part("days"));
        HistoricalDate start = days.isEmpty() ? null : ContentValues.date(days.getFirst().path("date"));
        HistoricalDate end = days.isEmpty() ? null : ContentValues.date(days.getLast().path("date"));
        UUID conflictId = jdbc.sql(INSERT_CONFLICT).param("slug", doc.slug()).param("name", json(c.path("name")))
                .param("heading", json(c.path("heading"))).param("years", text(c.path("years")))
                .params(HistoricalDateColumns.params("start", start)).params(HistoricalDateColumns.params("end", end))
                .param("summary", json(c.path("description"))).param("legacy", json(c.path("legacy")))
                .param("introDate", json(c.path("introDate"))).param("finalNotes", jsonArray(c.path("finalNotes")))
                .param("eras", strings(c.path("eraIds"))).param("theme", text(c.path("themeId")))
                .param("sources", jsonArray(c.path("sources"))).param("doc", doc.documentId())
                .query(UUID.class).single();
        for (JsonNode s : doc.part("settlements")) {
            jdbc.sql(INSERT_SETTLEMENT).param("conflict", conflictId).param("slug", text(s.path("id")))
                    .param("name", json(s.path("name"))).param("district", json(s.path("district")))
                    .param("kind", enumName(s.path("kind"))).param("lng", number(s.path("lng"))).param("lat", number(s.path("lat")))
                    .update();
        }
        for (JsonNode m : doc.part("commanders")) {
            jdbc.sql(INSERT_COMMANDER).param("conflict", conflictId).param("slug", text(m.path("id")))
                    .param("name", json(m.path("name"))).param("position", json(m.path("position")))
                    .param("role", json(m.path("role"))).param("days", strings(m.path("days")))
                    .param("sources", jsonArray(m.path("sources"))).update();
        }
        writeSteps(new Owner("CONFLICT", doc.slug(), "WAR_DAY", doc.documentId(), null), doc.part("days"), 0);
    }

    private void state(PublishedContent doc) {
        JsonNode s = doc.part("state");
        Integer start = null;
        Integer end = null;
        for (JsonNode step : doc.part("steps")) {
            int y = step.path("date").path("year").asInt();
            start = start == null ? y : Math.min(start, y);
            end = end == null ? y : Math.max(end, y);
        }
        jdbc.sql(INSERT_STATE).param("slug", doc.slug()).param("polity", text(s.path("polityId")))
                .param("name", json(s.path("name"))).param("years", text(s.path("years"))).param("start", start).param("end", end)
                .param("summary", json(s.path("description"))).param("legacy", json(s.path("legacy")))
                .param("image", json(s.path("image"))).param("eras", strings(s.path("eraIds")))
                .param("dynasty", strings(s.path("dynasty"))).param("theme", text(s.path("themeId")))
                .param("sources", jsonArray(s.path("sources"))).param("doc", doc.documentId()).update();
        writeSteps(new Owner("STATE", doc.slug(), "STATE_STEP", doc.documentId(), null), doc.part("steps"), 0);
    }

    private void battle(PublishedContent doc) {
        JsonNode b = doc.part("battle");
        jdbc.sql(INSERT_BATTLE).param("slug", doc.slug()).param("name", json(b.path("name")))
                .param("conflict", text(b.path("conflictId"))).param("step", text(b.path("stepId")))
                .param("dates", text(b.path("dates"))).param("summary", json(b.path("summary")))
                .param("sources", jsonArray(b.path("sources"))).param("doc", doc.documentId()).update();
    }

    private void hero(PublishedContent doc) {
        JsonNode h = doc.part("hero");
        jdbc.sql(INSERT_HERO).param("slug", doc.slug()).param("conflict", text(doc.part("conflictId")))
                .param("name", json(h.path("name"))).param("rank", json(h.path("rank")))
                .param("posthumous", bool(h.path("posthumous"))).param("birthPlace", json(h.path("birthPlace")))
                .param("awards", jsonArray(h.path("awards"))).param("bio", json(h.path("description")))
                .param("photo", json(h.path("photo"))).param("sources", jsonArray(h.path("sources")))
                .param("doc", doc.documentId()).update();
    }

    /** A ruler's {@code related} refs are cross-links like a step's (the ruler row itself is in chronology). */
    private void rulerLinks(PublishedContent doc) {
        int sort = 0;
        for (JsonNode ref : doc.part("ruler").path("related")) {
            steps.relation("RULER", doc.slug(), null, ref, "RELATED", doc.documentId(), sort++);
        }
    }

    private void glossary(PublishedContent doc) {
        JsonNode g = doc.part("entry");
        jdbc.sql(INSERT_GLOSSARY).param("slug", doc.slug()).param("term", json(g.path("term")))
                .param("definition", json(g.path("definition"))).param("forms", strings(g.path("forms")))
                .param("sources", jsonArray(g.path("sources"))).param("doc", doc.documentId()).update();
    }

    private void commemoration(PublishedContent doc) {
        JsonNode c = doc.part("commemoration");
        jdbc.sql(INSERT_COMMEMORATION).param("slug", doc.slug()).param("month", integer(c.path("month")))
                .param("day", integer(c.path("day"))).param("style", enumName(c.path("style")))
                .param("title", json(c.path("title"))).param("description", json(c.path("description")))
                .param("ref", json(c.path("ref"))).param("sources", jsonArray(c.path("sources")))
                .param("doc", doc.documentId()).update();
    }

    private void worldEvent(PublishedContent doc) {
        JsonNode e = doc.part("event");
        jdbc.sql(INSERT_WORLD_EVENT).param("slug", doc.slug()).param("year", integer(e.path("year")))
                .param("endYear", integer(e.path("endYear"))).param("region", enumName(e.path("region")))
                .param("title", json(e.path("title"))).param("description", json(e.path("description")))
                .param("sources", jsonArray(e.path("sources"))).param("doc", doc.documentId()).update();
    }

    private void planned(PublishedContent doc) {
        JsonNode e = doc.part("entity");
        jdbc.sql(INSERT_PLANNED).param("type", enumName(e.path("type"))).param("slug", doc.slug())
                .param("title", json(e.path("title"))).param("description", json(e.path("description")))
                .param("years", text(e.path("years"))).param("doc", doc.documentId()).update();
    }

    private void writeSteps(Owner owner, JsonNode list, int relationSort) {
        int sort = relationSort;
        for (JsonNode step : list) {
            steps.write(owner, step, sort);
            sort += step.path("related").size();
        }
    }

    private static List<JsonNode> ordered(JsonNode list) {
        List<JsonNode> out = new ArrayList<>();
        list.forEach(out::add);
        out.sort(Comparator.comparingInt(n -> n.path("order").asInt()));
        return out;
    }
}
