package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.StepReader.StepView;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiDate;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import az.tarix.platform.shared.read.ResultPage;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** Wars of the public API: cards, the war with its people and places, and its days (BACKEND_SPEC.md §10.1). */
@Service
public class ConflictReader {

    /**
     * @param start first day of the war (from its days), or null
     * @param end   last day, or null
     */
    public record ConflictCard(String slug, JsonNode name, JsonNode displayTitle, String years, ApiDate start, ApiDate end,
                               JsonNode summary, List<String> eraSlugs, String themeSlug) {}

    /** A settlement that changed hands; no coordinates when no reliable one is known. */
    public record SettlementView(String slug, JsonNode name, JsonNode district, String kind, Double lat, Double lng) {}

    /** @param stepKeys the days the commander is named in */
    public record CommanderView(String slug, JsonNode name, JsonNode position, JsonNode role, List<String> stepKeys,
                                List<ApiSource> sources) {}

    public record HeroCard(String slug, JsonNode fullName, JsonNode rank, boolean posthumous) {}

    /** @param stepKey the day of the war that shows the battle */
    public record BattleCard(String slug, JsonNode name, String dates, String stepKey) {}

    public record ConflictDetail(String slug, JsonNode name, JsonNode displayTitle, String years, ApiDate start, ApiDate end,
                                 JsonNode summary, List<String> eraSlugs, String themeSlug, JsonNode legacy, JsonNode introDate,
                                 List<JsonNode> finalNotes, List<ApiSource> sources, List<SettlementView> settlements,
                                 List<CommanderView> commanders, List<HeroCard> heroes, List<BattleCard> battles,
                                 List<ApiLink> relations) {}

    static final String CARD_COLUMNS = """
            slug, name, display_title, years, start_year, start_month, start_day, start_precision, start_certainty,
            end_year, end_month, end_day, end_precision, end_certainty, summary, era_slugs, theme_slug""";

    static final String LIST = """
            SELECT %s, count(*) OVER () AS total FROM conflict
            ORDER BY start_sort_key NULLS LAST, slug
            LIMIT :limit OFFSET :offset""".formatted(CARD_COLUMNS);

    static final String COUNT = "SELECT count(*) FROM conflict";

    static final String ONE = "SELECT id, %s, legacy, intro_date, final_notes, sources FROM conflict WHERE slug = :slug"
            .formatted(CARD_COLUMNS);

    static final String EXISTS = "SELECT count(*) FROM conflict WHERE slug = :slug";

    static final String SETTLEMENTS = """
            SELECT slug, name, district, kind, ST_Y(location) AS lat, ST_X(location) AS lng
            FROM settlement WHERE conflict_id = :id ORDER BY slug""";

    static final String COMMANDERS = """
            SELECT slug, name, position, role, step_keys, sources FROM commander WHERE conflict_id = :id ORDER BY slug""";

    static final String HEROES = """
            SELECT slug, full_name, rank, posthumous FROM hero WHERE conflict_slug = :slug
            ORDER BY full_name ->> 'az', slug""";

    static final String BATTLES = """
            SELECT b.slug, b.name, b.dates, b.step_key
            FROM battle b
            LEFT JOIN simulation_step s ON s.owner_type = 'CONFLICT' AND s.owner_slug = b.conflict_slug AND s.step_key = b.step_key
            WHERE b.conflict_slug = :slug
            ORDER BY s.sequence NULLS LAST, b.slug""";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final StepReader steps;
    private final RelationReader relations;

    ConflictReader(JdbcClient jdbc, PublicCache cache, StepReader steps, RelationReader relations) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.steps = steps;
        this.relations = relations;
    }

    public ResultPage<ConflictCard> list(ReadContext ctx, ResultPage.Request page) {
        return cache.get(ctx, "conflicts", page, () -> Lists.page(jdbc, LIST, page, rs -> card(rs, ctx.lang()), COUNT));
    }

    public ConflictDetail detail(ReadContext ctx, String slug) {
        return cache.get(ctx, "conflict", slug, () -> {
            Lang lang = ctx.lang();
            record Row(UUID id, ConflictCard card, JsonNode legacy, JsonNode introDate, List<JsonNode> finalNotes, JsonNode sources) {}
            Row r = jdbc.sql(ONE).param("slug", slug).query((rs, n) -> new Row(rs.getObject("id", UUID.class), card(rs, lang),
                    lang.text(JsonColumns.json(rs, "legacy")), lang.text(JsonColumns.json(rs, "intro_date")),
                    lang.localizeAll(JsonColumns.json(rs, "final_notes")), JsonColumns.json(rs, "sources")))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.CONFLICT, slug));
            List<SettlementView> settlements = jdbc.sql(SETTLEMENTS).param("id", r.id())
                    .query((rs, n) -> new SettlementView(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                            lang.text(JsonColumns.json(rs, "district")), rs.getString("kind"), nullableDouble(rs, "lat"),
                            nullableDouble(rs, "lng"))).list();
            List<CommanderView> commanders = jdbc.sql(COMMANDERS).param("id", r.id())
                    .query((rs, n) -> new CommanderView(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                            lang.text(JsonColumns.json(rs, "position")), lang.text(JsonColumns.json(rs, "role")),
                            JsonColumns.strings(rs, "step_keys"), ApiSource.all(JsonColumns.json(rs, "sources")))).list();
            List<HeroCard> heroes = jdbc.sql(HEROES).param("slug", slug)
                    .query((rs, n) -> new HeroCard(rs.getString("slug"), lang.text(JsonColumns.json(rs, "full_name")),
                            lang.text(JsonColumns.json(rs, "rank")), rs.getBoolean("posthumous"))).list();
            List<BattleCard> battles = jdbc.sql(BATTLES).param("slug", slug)
                    .query((rs, n) -> new BattleCard(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                            rs.getString("dates"), rs.getString("step_key"))).list();
            ConflictCard c = r.card();
            return new ConflictDetail(c.slug(), c.name(), c.displayTitle(), c.years(), c.start(), c.end(), c.summary(), c.eraSlugs(),
                    c.themeSlug(), r.legacy(), r.introDate(), r.finalNotes(), ApiSource.all(r.sources()), settlements, commanders,
                    heroes, battles, relations.of(EntityType.CONFLICT, slug, false, lang));
        });
    }

    public Steps days(ReadContext ctx, String slug) {
        return cache.get(ctx, "conflict-days", slug, () -> {
            List<StepView> list = steps.of(EntityType.CONFLICT, slug, null, ctx.lang());
            if (list.isEmpty()) requireExists(slug);
            return new Steps(new Steps.Owner(EntityType.CONFLICT, slug), ctx.contentVersion(), list);
        });
    }

    public StepView day(ReadContext ctx, String slug, String stepKey) {
        return cache.get(ctx, "conflict-day", slug + "/" + stepKey, () -> {
            List<StepView> list = steps.of(EntityType.CONFLICT, slug, stepKey, ctx.lang());
            if (!list.isEmpty()) return list.getFirst();
            requireExists(slug);
            throw new ResourceNotFoundException(DocumentType.CONFLICT, slug, stepKey);
        });
    }

    private void requireExists(String slug) {
        if (jdbc.sql(EXISTS).param("slug", slug).query(Long.class).single() == 0) {
            throw new ResourceNotFoundException(DocumentType.CONFLICT, slug);
        }
    }

    static ConflictCard card(ResultSet rs, Lang lang) throws SQLException {
        return new ConflictCard(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                lang.text(JsonColumns.json(rs, "display_title")), rs.getString("years"), ApiDate.read(rs, "start"),
                ApiDate.read(rs, "end"), lang.text(JsonColumns.json(rs, "summary")), JsonColumns.strings(rs, "era_slugs"),
                rs.getString("theme_slug"));
    }

    private static Double nullableDouble(ResultSet rs, String column) throws SQLException {
        double v = rs.getDouble(column);
        return rs.wasNull() ? null : v;
    }
}
