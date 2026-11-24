package az.tarix.platform.chronology.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiDate;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.EntityLinks;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.MediaFiles;
import az.tarix.platform.shared.read.MediaIndex;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** Eras, polities and rulers of the public API (BACKEND_SPEC.md §10.1). */
@Service
public class ChronologyReader {

    /**
     * @param weight  share of the timeline's width per year relative to other eras (1 = even)
     * @param subject school subject the era belongs to ({@code azerbaijan-history})
     */
    public record EraView(String slug, JsonNode name, int startYear, int endYear, JsonNode description, String themeSlug,
                          String color, double weight, String subject) {}

    /** A month-precise point of a reign ({@code month} null when only the year is known). */
    public record YearMonth(int year, Integer month) {}

    /** A reign as seen from its polity. */
    public record PolityReign(String rulerSlug, JsonNode rulerName, boolean rulerAvailable, YearMonth start, YearMonth end,
                              Certainty certainty, JsonNode note) {}

    public record Period(int fromYear, int toYear) {}

    /** What was true of the polity in a span of years. */
    public record PolityFact(int fromYear, int toYear, String status, JsonNode statusNote, JsonNode religion, JsonNode languages,
                             List<String> rivals, List<String> allies, List<ApiSource> sources) {}

    public record PolityView(String slug, JsonNode name, JsonNode shortName, String color, ApiImage emblem, int startYear,
                             int endYear, String stateSlug, JsonNode description, List<Period> periods, List<PolityFact> facts,
                             List<PolityReign> reigns) {}

    /** A reign as seen from its ruler. */
    public record RulerReign(String politySlug, JsonNode polityName, YearMonth start, YearMonth end, Certainty certainty,
                             JsonNode note) {}

    public record RulerView(String slug, JsonNode name, List<JsonNode> titles, JsonNode dynasty, ApiDate birth, ApiDate death,
                            String personSlug, boolean personAvailable, List<ApiImage> portraits, List<RulerReign> reigns,
                            List<ApiLink> related, List<ApiSource> sources) {}

    /**
     * A ruler in the panel, with the reign that covers the year.
     *
     * @param available the ruler is published ({@code /rulers/{slug}}); when not, only the slug
     *                  and the reign are known (BACKEND_SPEC.md §10.3: every reign is returned)
     */
    public record PanelRuler(String slug, boolean available, JsonNode name, List<JsonNode> titles, JsonNode dynasty, ApiDate birth,
                             ApiDate death, ApiImage portrait, String personSlug, boolean personAvailable, YearMonth reignStart,
                             YearMonth reignEnd, Certainty reignCertainty, JsonNode reignNote, List<ApiSource> sources) {}

    public record PolityRef(String slug, JsonNode name, JsonNode shortName, String color) {}

    /**
     * The ruler panel of a polity in a year (BACKEND_SPEC.md §10.3): co-rulers and a change of
     * hands in that year give several rulers.
     *
     * @param exists whether the polity existed that year (one of its periods covers it)
     * @param facts  what was true of the polity that year, or null
     */
    public record RulerPanel(PolityRef polity, int year, boolean exists, PolityFact facts, List<PanelRuler> rulers) {}

    static final String POLITY_AT = """
            SELECT p.id, p.slug, p.name, p.short_name, p.color,
                   EXISTS (SELECT 1 FROM polity_period pp WHERE pp.polity_id = p.id AND pp.from_year <= :year AND :year <= pp.to_year)
                       AS existed
            FROM polity p WHERE p.slug = :slug""";

    static final String FACT_AT = """
            SELECT from_year, to_year, status, status_note, religion, languages, rivals, allies, sources
            FROM polity_fact WHERE polity_id = :id AND from_year <= :year AND :year <= to_year
            ORDER BY from_year, sort_order LIMIT 1""";

    /** Every reign covering the year, also of a ruler not published yet (then the ruler columns are NULL). */
    static final String RULERS_AT = """
            SELECT g.ruler_slug AS slug, r.id IS NOT NULL AS available, r.name, r.titles, r.dynasty, r.birth_year, r.birth_month, r.birth_day, r.birth_precision,
                   r.birth_certainty, r.death_year, r.death_month, r.death_day, r.death_precision, r.death_certainty,
                   r.person_slug, r.portraits, r.sources, g.start_year, g.start_month, g.end_year, g.end_month, g.certainty,
                   g.note
            FROM reign g LEFT JOIN ruler r ON r.slug = g.ruler_slug
            WHERE g.polity_id = :id AND g.start_year <= :year AND (g.end_year IS NULL OR g.end_year >= :year)
            ORDER BY g.start_year, g.start_month NULLS FIRST, g.sort_order""";

    static final String ERAS = """
            SELECT slug, name, start_year, end_year, description, theme_slug, color, weight, subject
            FROM era ORDER BY sort_order, start_year, slug""";

    static final String POLITY = """
            SELECT id, slug, name, short_name, color, emblem, start_year, end_year, state_slug, description
            FROM polity WHERE slug = :slug""";

    static final String POLITY_PERIODS = "SELECT from_year, to_year FROM polity_period WHERE polity_id = :id ORDER BY from_year";

    static final String POLITY_FACTS = """
            SELECT from_year, to_year, status, status_note, religion, languages, rivals, allies, sources
            FROM polity_fact WHERE polity_id = :id ORDER BY from_year, sort_order""";

    static final String POLITY_REIGNS = """
            SELECT g.ruler_slug, r.name AS ruler_name, g.start_year, g.start_month, g.end_year, g.end_month, g.certainty, g.note
            FROM reign g LEFT JOIN ruler r ON r.slug = g.ruler_slug
            WHERE g.polity_id = :id ORDER BY g.start_year, g.start_month NULLS FIRST, g.sort_order""";

    static final String RULER = """
            SELECT slug, name, titles, dynasty, birth_year, birth_month, birth_day, birth_precision, birth_certainty,
                   death_year, death_month, death_day, death_precision, death_certainty, person_slug, portraits, related, sources
            FROM ruler WHERE slug = :slug""";

    static final String RULER_REIGNS = """
            SELECT p.slug AS polity_slug, p.name AS polity_name, g.start_year, g.start_month, g.end_year, g.end_month,
                   g.certainty, g.note
            FROM reign g JOIN polity p ON p.id = g.polity_id
            WHERE g.ruler_slug = :slug ORDER BY g.start_year, g.start_month NULLS FIRST, p.slug""";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final EntityLinks links;
    private final MediaFiles media;

    ChronologyReader(JdbcClient jdbc, PublicCache cache, EntityLinks links, MediaFiles media) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.links = links;
        this.media = media;
    }

    public List<EraView> eras(ReadContext ctx) {
        return eras(ctx, null);
    }

    /** Eras of one school subject, or all of them when {@code subject} is null. */
    public List<EraView> eras(ReadContext ctx, String subject) {
        return cache.get(ctx, "eras", subject == null ? "" : subject, () -> {
            Lang lang = ctx.lang();
            return jdbc.sql(ERAS).query((rs, n) -> new EraView(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                    rs.getInt("start_year"), rs.getInt("end_year"), lang.text(JsonColumns.json(rs, "description")),
                    rs.getString("theme_slug"), rs.getString("color"), rs.getDouble("weight"), rs.getString("subject"))).list()
                    .stream().filter(e -> subject == null || subject.equals(e.subject())).toList();
        });
    }

    public PolityView polity(ReadContext ctx, String slug) {
        return cache.get(ctx, "polity", slug, () -> {
            Lang lang = ctx.lang();
            record Row(UUID id, PolityView partial) {}
            Row row = jdbc.sql(POLITY).param("slug", slug).query((rs, n) -> new Row(rs.getObject("id", UUID.class),
                    new PolityView(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                            lang.text(JsonColumns.json(rs, "short_name")), rs.getString("color"),
                            ApiImage.of(JsonColumns.json(rs, "emblem"), lang, media.at(ctx)), rs.getInt("start_year"), rs.getInt("end_year"),
                            rs.getString("state_slug"), lang.text(JsonColumns.json(rs, "description")), null, null, null)))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.POLITY, slug));
            List<Period> periods = jdbc.sql(POLITY_PERIODS).param("id", row.id())
                    .query((rs, n) -> new Period(rs.getInt("from_year"), rs.getInt("to_year"))).list();
            List<PolityFact> facts = jdbc.sql(POLITY_FACTS).param("id", row.id())
                    .query((rs, n) -> new PolityFact(rs.getInt("from_year"), rs.getInt("to_year"), rs.getString("status"),
                            lang.text(JsonColumns.json(rs, "status_note")), lang.text(JsonColumns.json(rs, "religion")),
                            lang.text(JsonColumns.json(rs, "languages")), JsonColumns.strings(rs, "rivals"),
                            JsonColumns.strings(rs, "allies"), ApiSource.all(JsonColumns.json(rs, "sources")))).list();
            List<PolityReign> reigns = jdbc.sql(POLITY_REIGNS).param("id", row.id())
                    .query((rs, n) -> {
                        JsonNode rulerName = JsonColumns.json(rs, "ruler_name");
                        return new PolityReign(rs.getString("ruler_slug"), lang.text(rulerName), rulerName != null,
                                yearMonth(rs, "start"), yearMonth(rs, "end"), Certainty.valueOf(rs.getString("certainty")),
                                lang.text(JsonColumns.json(rs, "note")));
                    }).list();
            PolityView p = row.partial();
            return new PolityView(p.slug(), p.name(), p.shortName(), p.color(), p.emblem(), p.startYear(), p.endYear(),
                    p.stateSlug(), p.description(), periods, facts, reigns);
        });
    }

    public RulerView ruler(ReadContext ctx, String slug) {
        return cache.get(ctx, "ruler", slug, () -> {
            Lang lang = ctx.lang();
            record Row(RulerView partial, JsonNode portraits, JsonNode related) {}
            Row row = jdbc.sql(RULER).param("slug", slug).query((rs, n) -> new Row(
                    new RulerView(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                            lang.localizeAll(JsonColumns.json(rs, "titles")), lang.text(JsonColumns.json(rs, "dynasty")),
                            ApiDate.read(rs, "birth"), ApiDate.read(rs, "death"), rs.getString("person_slug"), false, null,
                            null, null, ApiSource.all(JsonColumns.json(rs, "sources"))),
                    JsonColumns.json(rs, "portraits"), JsonColumns.json(rs, "related")))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.RULER, slug));
            List<RulerReign> reigns = jdbc.sql(RULER_REIGNS).param("slug", slug)
                    .query((rs, n) -> new RulerReign(rs.getString("polity_slug"), lang.text(JsonColumns.json(rs, "polity_name")),
                            yearMonth(rs, "start"), yearMonth(rs, "end"), Certainty.valueOf(rs.getString("certainty")),
                            lang.text(JsonColumns.json(rs, "note")))).list();
            List<JsonNode> refs = new ArrayList<>();
            if (row.related() != null) row.related().forEach(refs::add);
            RulerView r = row.partial();
            List<EntityLinks.Target> targets = new ArrayList<>(refs.stream().map(EntityLinks.Target::of).filter(Objects::nonNull).toList());
            if (r.personSlug() != null) targets.add(new EntityLinks.Target(EntityType.PERSON, r.personSlug()));
            EntityLinks.Resolved resolved = links.resolve(targets);
            List<ApiImage> portraits = new ArrayList<>();
            if (row.portraits() != null) for (JsonNode p : row.portraits()) {
                ApiImage image = ApiImage.of(p, lang, media.at(ctx));
                if (image != null) portraits.add(image);
            }
            boolean personAvailable = r.personSlug() != null
                    && resolved.available(new EntityLinks.Target(EntityType.PERSON, r.personSlug()));
            return new RulerView(r.slug(), r.name(), r.titles(), r.dynasty(), r.birth(), r.death(), r.personSlug(), personAvailable,
                    portraits, reigns, EntityLinks.links(row.related(), "RELATED", resolved, lang), r.sources());
        });
    }

    private record PanelKey(String slug, int year) {}

    /** Four queries at most: the polity, its facts, the reigns with their rulers, the rulers' person pages. */
    public RulerPanel rulerPanel(ReadContext ctx, String slug, int year) {
        return cache.get(ctx, "ruler-panel", new PanelKey(slug, year), () -> {
            Lang lang = ctx.lang();
            record Row(UUID id, PolityRef polity, boolean existed) {}
            Row row = jdbc.sql(POLITY_AT).param("slug", slug).param("year", year)
                    .query((rs, n) -> new Row(rs.getObject("id", UUID.class), new PolityRef(rs.getString("slug"),
                            lang.text(JsonColumns.json(rs, "name")), lang.text(JsonColumns.json(rs, "short_name")),
                            rs.getString("color")), rs.getBoolean("existed")))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.POLITY, slug));
            PolityFact facts = jdbc.sql(FACT_AT).param("id", row.id()).param("year", year)
                    .query((rs, n) -> new PolityFact(rs.getInt("from_year"), rs.getInt("to_year"), rs.getString("status"),
                            lang.text(JsonColumns.json(rs, "status_note")), lang.text(JsonColumns.json(rs, "religion")),
                            lang.text(JsonColumns.json(rs, "languages")), JsonColumns.strings(rs, "rivals"),
                            JsonColumns.strings(rs, "allies"), ApiSource.all(JsonColumns.json(rs, "sources"))))
                    .optional().orElse(null);
            List<PanelRuler> rulers = jdbc.sql(RULERS_AT).param("id", row.id()).param("year", year)
                    .query((rs, n) -> new PanelRuler(rs.getString("slug"), rs.getBoolean("available"),
                            lang.text(JsonColumns.json(rs, "name")),
                            lang.localizeAll(JsonColumns.json(rs, "titles")), lang.text(JsonColumns.json(rs, "dynasty")),
                            ApiDate.read(rs, "birth"), ApiDate.read(rs, "death"), firstPublic(JsonColumns.json(rs, "portraits"), lang, media.at(ctx)),
                            rs.getString("person_slug"), false, yearMonth(rs, "start"), yearMonth(rs, "end"),
                            Certainty.valueOf(rs.getString("certainty")), lang.text(JsonColumns.json(rs, "note")),
                            ApiSource.all(JsonColumns.json(rs, "sources"))))
                    .list();
            EntityLinks.Resolved persons = links.resolve(rulers.stream().filter(r -> r.personSlug() != null)
                    .map(r -> new EntityLinks.Target(EntityType.PERSON, r.personSlug())).toList());
            List<PanelRuler> withPersons = rulers.stream().map(r -> new PanelRuler(r.slug(), r.available(), r.name(), r.titles(),
                    r.dynasty(),
                    r.birth(), r.death(), r.portrait(), r.personSlug(),
                    r.personSlug() != null && persons.available(new EntityLinks.Target(EntityType.PERSON, r.personSlug())),
                    r.reignStart(), r.reignEnd(), r.reignCertainty(), r.reignNote(), r.sources())).toList();
            return new RulerPanel(row.polity(), year, row.existed(), facts, withPersons);
        });
    }

    /** The first portrait whose licence allows publishing (ADR-0014), or null. */
    private static ApiImage firstPublic(JsonNode portraits, Lang lang, MediaIndex media) {
        if (portraits != null) for (JsonNode p : portraits) {
            ApiImage image = ApiImage.of(p, lang, media);
            if (image != null) return image;
        }
        return null;
    }

    private static YearMonth yearMonth(ResultSet rs, String prefix) throws SQLException {
        Integer year = JsonColumns.integer(rs, prefix + "_year");
        return year == null ? null : new YearMonth(year, JsonColumns.integer(rs, prefix + "_month"));
    }
}
