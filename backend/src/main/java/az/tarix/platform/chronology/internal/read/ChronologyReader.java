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

    public record EraView(String slug, JsonNode name, int startYear, int endYear, JsonNode description, String themeSlug,
                          String color) {}

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

    static final String ERAS = """
            SELECT slug, name, start_year, end_year, description, theme_slug, color
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

    ChronologyReader(JdbcClient jdbc, PublicCache cache, EntityLinks links) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.links = links;
    }

    public List<EraView> eras(ReadContext ctx) {
        return cache.get(ctx, "eras", "", () -> {
            Lang lang = ctx.lang();
            return jdbc.sql(ERAS).query((rs, n) -> new EraView(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                    rs.getInt("start_year"), rs.getInt("end_year"), lang.text(JsonColumns.json(rs, "description")),
                    rs.getString("theme_slug"), rs.getString("color"))).list();
        });
    }

    public PolityView polity(ReadContext ctx, String slug) {
        return cache.get(ctx, "polity", slug, () -> {
            Lang lang = ctx.lang();
            record Row(UUID id, PolityView partial) {}
            Row row = jdbc.sql(POLITY).param("slug", slug).query((rs, n) -> new Row(rs.getObject("id", UUID.class),
                    new PolityView(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                            lang.text(JsonColumns.json(rs, "short_name")), rs.getString("color"),
                            ApiImage.of(JsonColumns.json(rs, "emblem"), lang), rs.getInt("start_year"), rs.getInt("end_year"),
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
                ApiImage image = ApiImage.of(p, lang);
                if (image != null) portraits.add(image);
            }
            boolean personAvailable = r.personSlug() != null
                    && resolved.available(new EntityLinks.Target(EntityType.PERSON, r.personSlug()));
            return new RulerView(r.slug(), r.name(), r.titles(), r.dynasty(), r.birth(), r.death(), r.personSlug(), personAvailable,
                    portraits, reigns, EntityLinks.links(row.related(), "RELATED", resolved, lang), r.sources());
        });
    }

    private static YearMonth yearMonth(ResultSet rs, String prefix) throws SQLException {
        Integer year = JsonColumns.integer(rs, prefix + "_year");
        return year == null ? null : new YearMonth(year, JsonColumns.integer(rs, prefix + "_month"));
    }
}
