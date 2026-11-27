package az.tarix.platform.catalog.internal.projection;

import static az.tarix.platform.shared.content.ContentValues.enumName;
import static az.tarix.platform.shared.content.ContentValues.integer;
import static az.tarix.platform.shared.content.ContentValues.json;
import static az.tarix.platform.shared.content.ContentValues.text;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.content.ProjectionWriter;
import az.tarix.platform.shared.content.PublishedContent;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Projects CURRICULUM_GRADE documents (V018): the grade, its sections, topics and the steps each
 * topic tells, in order. Steps are stored by key (owner type, owner slug, step key), like
 * cross-links, so republishing a simulation never touches the curriculum; readers join them.
 * The curriculum lives in the catalog module because a topic is a sequence of catalog steps.
 */
@Component
class CurriculumProjectionWriter implements ProjectionWriter {

    static final String INSERT_GRADE = """
            INSERT INTO curriculum_grade (slug, subject, grade, title, textbook, sample, document_id)
            VALUES (:slug, :subject, :grade, CAST(:title AS jsonb), CAST(:textbook AS jsonb), :sample, :doc)
            RETURNING id""";

    static final String INSERT_SECTION = """
            INSERT INTO curriculum_section (grade_id, slug, title, sort_order)
            VALUES (:grade, :slug, CAST(:title AS jsonb), :sort)
            RETURNING id""";

    static final String INSERT_TOPIC = """
            INSERT INTO curriculum_topic (section_id, slug, title, paragraph, summary, minutes, sort_order)
            VALUES (:section, :slug, CAST(:title AS jsonb), :paragraph, CAST(:summary AS jsonb), :minutes, :sort)
            RETURNING id""";

    static final String INSERT_STEP = """
            INSERT INTO curriculum_topic_step (topic_id, sort_order, owner_type, owner_slug, step_key)
            VALUES (:topic, :sort, :type, :owner, :key)""";

    private final JdbcClient jdbc;

    CurriculumProjectionWriter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void delete(UUID documentId) {
        // Sections, topics and their steps go with the grade (ON DELETE CASCADE).
        jdbc.sql("DELETE FROM curriculum_grade WHERE document_id = :doc").param("doc", documentId).update();
    }

    @Override
    public void deleteAll() {
        jdbc.sql("DELETE FROM curriculum_grade").update();
    }

    @Override
    public void write(PublishedContent doc) {
        if (doc.type() != DocumentType.CURRICULUM_GRADE) return;
        JsonNode g = doc.part("grade");
        UUID grade = jdbc.sql(INSERT_GRADE).param("slug", doc.slug()).param("subject", text(g.path("subject")))
                .param("grade", integer(g.path("grade"))).param("title", json(g.path("title")))
                .param("textbook", json(g.path("textbook"))).param("sample", g.path("sample").asBoolean(false))
                .param("doc", doc.documentId()).query(UUID.class).single();
        int sectionSort = 0;
        for (JsonNode s : g.path("sections")) {
            UUID section = jdbc.sql(INSERT_SECTION).param("grade", grade).param("slug", text(s.path("id")))
                    .param("title", json(s.path("title"))).param("sort", sectionSort++).query(UUID.class).single();
            int topicSort = 0;
            for (JsonNode t : s.path("topics")) {
                UUID topic = jdbc.sql(INSERT_TOPIC).param("section", section).param("slug", text(t.path("id")))
                        .param("title", json(t.path("title"))).param("paragraph", text(t.path("paragraph")))
                        .param("summary", json(t.path("summary"))).param("minutes", integer(t.path("minutes")))
                        .param("sort", topicSort++).query(UUID.class).single();
                int stepSort = 0;
                for (JsonNode step : t.path("steps")) {
                    jdbc.sql(INSERT_STEP).param("topic", topic).param("sort", stepSort++).param("type", enumName(step.path("type")))
                            .param("owner", text(step.path("id"))).param("key", text(step.path("stepId"))).update();
                }
            }
        }
    }
}
