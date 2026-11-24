package az.tarix.platform.chronology.internal.projection;

import static az.tarix.platform.shared.content.ContentValues.enumName;
import static az.tarix.platform.shared.content.ContentValues.integer;
import static az.tarix.platform.shared.content.ContentValues.json;
import static az.tarix.platform.shared.content.ContentValues.jsonArray;
import static az.tarix.platform.shared.content.ContentValues.number;
import static az.tarix.platform.shared.content.ContentValues.strings;
import static az.tarix.platform.shared.content.ContentValues.text;

import az.tarix.platform.shared.content.ContentValues;
import az.tarix.platform.shared.content.ProjectionWriter;
import az.tarix.platform.shared.content.PublishedContent;
import az.tarix.platform.shared.domain.HistoricalDate;
import az.tarix.platform.shared.jdbc.HistoricalDateColumns;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** Projects ERA, POLITY (with periods, facts and reigns) and RULER documents (V004). */
@Component
class ChronologyProjectionWriter implements ProjectionWriter {

    static final String INSERT_ERA = """
            INSERT INTO era (slug, name, start_year, end_year, description, theme_slug, weight, subject, sort_order, document_id)
            VALUES (:slug, CAST(:name AS jsonb), :start, :end, CAST(:description AS jsonb), :theme,
                    coalesce(CAST(:weight AS numeric), 1), coalesce(CAST(:subject AS varchar), 'azerbaijan-history'), :start, :doc)""";

    static final String INSERT_POLITY = """
            INSERT INTO polity (slug, name, color, emblem, start_year, end_year, state_slug, document_id)
            VALUES (:slug, CAST(:name AS jsonb), :color, CAST(:emblem AS jsonb), :start, :end, :state, :doc)
            RETURNING id""";

    static final String INSERT_PERIOD = "INSERT INTO polity_period (polity_id, from_year, to_year) VALUES (:polity, :from, :to)";

    static final String INSERT_FACT = """
            INSERT INTO polity_fact (polity_id, from_year, to_year, status, status_note, religion, languages, rivals, allies,
                                     sources, sort_order)
            VALUES (:polity, :from, :to, :status, CAST(:note AS jsonb), CAST(:religion AS jsonb), CAST(:languages AS jsonb),
                    CAST(:rivals AS text[]), CAST(:allies AS text[]), CAST(:sources AS jsonb), :sort)""";

    static final String INSERT_REIGN = """
            INSERT INTO reign (polity_id, ruler_slug, start_year, start_month, end_year, end_month, certainty, note, sort_order)
            VALUES (:polity, :ruler, :startYear, :startMonth, :endYear, :endMonth, :certainty, CAST(:note AS jsonb), :sort)""";

    static final String INSERT_RULER = """
            INSERT INTO ruler (slug, name, titles, dynasty, birth_year, birth_month, birth_day, birth_precision, birth_certainty,
                               death_year, death_month, death_day, death_precision, death_certainty, person_slug, related,
                               sources, portraits, document_id)
            VALUES (:slug, CAST(:name AS jsonb), CAST(:titles AS jsonb), CAST(:dynasty AS jsonb),
                    :birth_year, :birth_month, :birth_day, :birth_precision, :birth_certainty,
                    :death_year, :death_month, :death_day, :death_precision, :death_certainty, :person,
                    CAST(:related AS jsonb), CAST(:sources AS jsonb), CAST(:portraits AS jsonb), :doc)""";

    private final JdbcClient jdbc;

    ChronologyProjectionWriter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void delete(UUID documentId) {
        // Periods, facts and reigns go with their polity (ON DELETE CASCADE).
        jdbc.sql("DELETE FROM era WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM polity WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM ruler WHERE document_id = :doc").param("doc", documentId).update();
    }

    @Override
    public void deleteAll() {
        jdbc.sql("DELETE FROM era").update();
        jdbc.sql("DELETE FROM polity").update();
        jdbc.sql("DELETE FROM ruler").update();
    }

    @Override
    public void write(PublishedContent doc) {
        switch (doc.type()) {
            case ERA -> era(doc);
            case POLITY -> polity(doc);
            case RULER -> ruler(doc);
            default -> { }
        }
    }

    private void era(PublishedContent doc) {
        JsonNode e = doc.part("era");
        jdbc.sql(INSERT_ERA).param("slug", doc.slug()).param("name", json(e.path("name")))
                .param("start", integer(e.path("startYear"))).param("end", integer(e.path("endYear")))
                .param("description", json(e.path("description"))).param("theme", text(e.path("themeId")))
                .param("weight", number(e.path("weight"))).param("subject", text(e.path("subject")))
                .param("doc", doc.documentId()).update();
    }

    private void polity(PublishedContent doc) {
        JsonNode p = doc.part("polity");
        int start = Integer.MAX_VALUE;
        int end = Integer.MIN_VALUE;
        for (JsonNode period : p.path("periods")) {
            start = Math.min(start, period.path("from").asInt());
            end = Math.max(end, period.path("to").asInt());
        }
        UUID polityId = jdbc.sql(INSERT_POLITY).param("slug", doc.slug()).param("name", json(p.path("name")))
                .param("color", text(p.path("color"))).param("emblem", json(p.path("emblem")))
                .param("start", start).param("end", end).param("state", text(p.path("stateId")))
                .param("doc", doc.documentId()).query(UUID.class).single();
        for (JsonNode period : p.path("periods")) {
            jdbc.sql(INSERT_PERIOD).param("polity", polityId).param("from", integer(period.path("from")))
                    .param("to", integer(period.path("to"))).update();
        }
        int sort = 0;
        for (JsonNode f : p.path("facts")) {
            jdbc.sql(INSERT_FACT).param("polity", polityId).param("from", integer(f.path("from"))).param("to", integer(f.path("to")))
                    .param("status", enumName(f.path("status"))).param("note", json(f.path("statusNote")))
                    .param("religion", json(f.path("religion"))).param("languages", json(f.path("languages")))
                    .param("rivals", strings(f.path("rivals"))).param("allies", strings(f.path("allies")))
                    .param("sources", jsonArray(f.path("sources"))).param("sort", sort++).update();
        }
        sort = 0;
        for (JsonNode r : doc.part("reigns")) {
            jdbc.sql(INSERT_REIGN).param("polity", polityId).param("ruler", text(r.path("rulerId")))
                    .param("startYear", integer(r.path("start").path("year"))).param("startMonth", integer(r.path("start").path("month")))
                    .param("endYear", integer(r.path("end").path("year"))).param("endMonth", integer(r.path("end").path("month")))
                    .param("certainty", enumName(r.path("certainty"))).param("note", json(r.path("note")))
                    .param("sort", sort++).update();
        }
    }

    private void ruler(PublishedContent doc) {
        JsonNode r = doc.part("ruler");
        HistoricalDate born = ContentValues.date(r.path("born"));
        HistoricalDate died = ContentValues.date(r.path("died"));
        jdbc.sql(INSERT_RULER).param("slug", doc.slug()).param("name", json(r.path("name")))
                .param("titles", jsonArray(r.path("titles"))).param("dynasty", json(r.path("dynasty")))
                .params(HistoricalDateColumns.params("birth", born)).params(HistoricalDateColumns.params("death", died))
                .param("person", text(r.path("personId"))).param("related", jsonArray(r.path("related")))
                .param("sources", jsonArray(r.path("sources"))).param("portraits", jsonArray(r.path("portraits")))
                .param("doc", doc.documentId()).update();
    }
}
