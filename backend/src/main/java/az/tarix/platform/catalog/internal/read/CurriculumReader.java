package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.StepReader.StepView;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * The school curriculum (B2, ARCHITECTURE.md §24): the grades of a subject, a grade with its
 * sections and topics, and a topic with the steps it tells (the topic simulation). A topic
 * without steps, or whose steps are not all published, is not {@code ready} ("hazırlanır").
 */
@Component
public class CurriculumReader {

    /** Years the steps of a topic or grade cover; null without published steps. */
    public record YearSpan(int from, int to) {}

    /**
     * @param steps how many steps the topic lists
     * @param ready the topic can be opened: it has steps and all of them are published
     */
    public record TopicSummary(String slug, JsonNode title, String paragraph, JsonNode summary, Integer minutes, int steps,
                               boolean ready, YearSpan years) {}

    public record SectionView(String slug, JsonNode title, List<TopicSummary> topics) {}

    /** @param textbook title, authors, year, publisher, url of the textbook the grade follows (reference only) */
    public record GradeView(String slug, String subject, int grade, JsonNode title, JsonNode textbook, boolean sample,
                            List<SectionView> sections) {}

    public record GradeSummary(String slug, String subject, int grade, JsonNode title, JsonNode textbook, boolean sample,
                               int sections, int topics, int readyTopics, YearSpan years) {}

    /** A step of the topic with the simulation it belongs to. */
    public record TopicStep(EntityType ownerType, String ownerSlug, StepView step) {}

    public record TopicView(String slug, JsonNode title, String paragraph, JsonNode summary, Integer minutes, String subject,
                            int grade, String gradeSlug, JsonNode gradeTitle, String sectionSlug, JsonNode sectionTitle,
                            JsonNode textbook, boolean sample, List<TopicStep> steps) {}

    static final String GRADES = """
            SELECT slug FROM curriculum_grade WHERE subject = :subject ORDER BY grade""";

    static final String GRADE = """
            SELECT slug, subject, grade, title, textbook, sample FROM curriculum_grade WHERE slug = :slug""";

    static final String TOPICS = """
            SELECT sec.slug AS section_slug, sec.title AS section_title, t.slug, t.title, t.paragraph, t.summary, t.minutes,
                   count(ts.step_key) AS steps, count(s.id) AS found, min(s.date_year) AS from_year, max(s.date_year) AS to_year
            FROM curriculum_grade g
            JOIN curriculum_section sec ON sec.grade_id = g.id
            JOIN curriculum_topic t ON t.section_id = sec.id
            LEFT JOIN curriculum_topic_step ts ON ts.topic_id = t.id
            LEFT JOIN simulation_step s ON s.owner_type = ts.owner_type AND s.owner_slug = ts.owner_slug AND s.step_key = ts.step_key
            WHERE g.slug = :slug
            GROUP BY sec.id, sec.slug, sec.title, sec.sort_order, t.id, t.slug, t.title, t.paragraph, t.summary, t.minutes, t.sort_order
            ORDER BY sec.sort_order, t.sort_order""";

    static final String TOPIC = """
            SELECT t.id, t.slug, t.title, t.paragraph, t.summary, t.minutes, sec.slug AS section_slug, sec.title AS section_title,
                   g.slug AS grade_slug, g.subject, g.grade, g.title AS grade_title, g.textbook, g.sample
            FROM curriculum_topic t
            JOIN curriculum_section sec ON sec.id = t.section_id
            JOIN curriculum_grade g ON g.id = sec.grade_id
            WHERE t.slug = :slug""";

    static final String TOPIC_STEPS = """
            SELECT owner_type, owner_slug, step_key FROM curriculum_topic_step WHERE topic_id = :topic ORDER BY sort_order""";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final StepReader steps;

    CurriculumReader(JdbcClient jdbc, PublicCache cache, StepReader steps) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.steps = steps;
    }

    /** The grades of a subject, each with its counts and the years its topics cover. */
    public List<GradeSummary> grades(ReadContext ctx, String subject) {
        return cache.get(ctx, "curriculum-grades", subject, () -> {
            List<GradeSummary> out = new ArrayList<>();
            for (String slug : jdbc.sql(GRADES).param("subject", subject).query(String.class).list()) {
                GradeView g = load(ctx, slug);
                List<TopicSummary> topics = g.sections().stream().flatMap(s -> s.topics().stream()).toList();
                out.add(new GradeSummary(g.slug(), g.subject(), g.grade(), g.title(), g.textbook(), g.sample(), g.sections().size(),
                        topics.size(), (int) topics.stream().filter(TopicSummary::ready).count(), span(topics)));
            }
            return out;
        });
    }

    /** One grade with its sections and topics. */
    public GradeView grade(ReadContext ctx, String subject, int grade) {
        String slug = subject + "-" + grade;
        return cache.get(ctx, "curriculum-grade", slug, () -> load(ctx, slug));
    }

    /** Editorial preview: the grade as the public API serves it. */
    GradeView gradeBySlug(ReadContext ctx, String slug) {
        return load(ctx, slug);
    }

    /** A topic and the steps it tells, in its order; a step that is not published is left out. */
    public TopicView topic(ReadContext ctx, String slug) {
        return cache.get(ctx, "curriculum-topic", slug, () -> {
            Lang lang = ctx.lang();
            record Row(UUID id, TopicView partial) {}
            Row row = jdbc.sql(TOPIC).param("slug", slug).query((rs, n) -> new Row(rs.getObject("id", UUID.class),
                    new TopicView(rs.getString("slug"), lang.text(JsonColumns.json(rs, "title")), rs.getString("paragraph"),
                            lang.text(JsonColumns.json(rs, "summary")), JsonColumns.integer(rs, "minutes"), rs.getString("subject"),
                            rs.getInt("grade"), rs.getString("grade_slug"), lang.text(JsonColumns.json(rs, "grade_title")),
                            rs.getString("section_slug"), lang.text(JsonColumns.json(rs, "section_title")),
                            lang.localize(JsonColumns.json(rs, "textbook")), rs.getBoolean("sample"), null)))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.CURRICULUM_GRADE, slug));
            List<TopicStep> out = new ArrayList<>();
            jdbc.sql(TOPIC_STEPS).param("topic", row.id()).query((rs, n) -> {
                EntityType type = EntityType.valueOf(rs.getString("owner_type"));
                String owner = rs.getString("owner_slug");
                steps.of(type, owner, rs.getString("step_key"), ctx).stream().findFirst()
                        .ifPresent(s -> out.add(new TopicStep(type, owner, s)));
                return null;
            }).list();
            TopicView p = row.partial();
            return new TopicView(p.slug(), p.title(), p.paragraph(), p.summary(), p.minutes(), p.subject(), p.grade(), p.gradeSlug(),
                    p.gradeTitle(), p.sectionSlug(), p.sectionTitle(), p.textbook(), p.sample(), out);
        });
    }

    private GradeView load(ReadContext ctx, String slug) {
        Lang lang = ctx.lang();
        GradeView head = jdbc.sql(GRADE).param("slug", slug).query((rs, n) -> new GradeView(rs.getString("slug"), rs.getString("subject"),
                rs.getInt("grade"), lang.text(JsonColumns.json(rs, "title")), lang.localize(JsonColumns.json(rs, "textbook")),
                rs.getBoolean("sample"), List.of())).optional()
                .orElseThrow(() -> new ResourceNotFoundException(DocumentType.CURRICULUM_GRADE, slug));
        Map<String, SectionView> sections = new LinkedHashMap<>();
        jdbc.sql(TOPICS).param("slug", slug).query((rs, n) -> {
            int listed = rs.getInt("steps");
            int found = rs.getInt("found");
            Integer from = JsonColumns.integer(rs, "from_year");
            Integer to = JsonColumns.integer(rs, "to_year");
            TopicSummary t = new TopicSummary(rs.getString("slug"), lang.text(JsonColumns.json(rs, "title")), rs.getString("paragraph"),
                    lang.text(JsonColumns.json(rs, "summary")), JsonColumns.integer(rs, "minutes"), listed, listed > 0 && found == listed,
                    from == null ? null : new YearSpan(from, to));
            String key = rs.getString("section_slug");
            JsonNode sectionTitle = lang.text(JsonColumns.json(rs, "section_title"));
            sections.computeIfAbsent(key, k -> new SectionView(k, sectionTitle, new ArrayList<>())).topics().add(t);
            return null;
        }).list();
        return new GradeView(head.slug(), head.subject(), head.grade(), head.title(), head.textbook(), head.sample(),
                List.copyOf(sections.values()));
    }

    private static YearSpan span(List<TopicSummary> topics) {
        Integer from = null;
        Integer to = null;
        for (TopicSummary t : topics) {
            if (t.years() == null) continue;
            from = from == null ? t.years().from() : Math.min(from, t.years().from());
            to = to == null ? t.years().to() : Math.max(to, t.years().to());
        }
        return from == null ? null : new YearSpan(from, to);
    }
}
