package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.StepReader.StepView;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.MediaFiles;
import az.tarix.platform.shared.read.MediaIndex;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import az.tarix.platform.shared.read.ResultPage;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** State simulations of the public API (BACKEND_SPEC.md §10.1: {@code /states}). */
@Service
public class StateReader {

    /**
     * @param politySlug the polity (map colours, reigns) the simulation is about
     * @param startYear  year of the first step, or null
     * @param endYear    year of the last step, or null
     */
    public record StateCard(String slug, String politySlug, JsonNode name, String years, Integer startYear, Integer endYear,
                            JsonNode summary, ApiImage image, List<String> eraSlugs, List<String> dynasty, String themeSlug) {}

    public record StateDetail(String slug, String politySlug, JsonNode name, String years, Integer startYear, Integer endYear,
                              JsonNode summary, ApiImage image, List<String> eraSlugs, List<String> dynasty, String themeSlug,
                              JsonNode legacy, List<ApiSource> sources, List<ApiLink> relations) {}

    static final String CARD_COLUMNS = "slug, polity_slug, name, years, start_year, end_year, summary, image, era_slugs, dynasty, theme_slug";

    static final String LIST = """
            SELECT %s, count(*) OVER () AS total FROM state_profile
            ORDER BY start_year NULLS LAST, slug
            LIMIT :limit OFFSET :offset""".formatted(CARD_COLUMNS);

    static final String COUNT = "SELECT count(*) FROM state_profile";

    static final String ONE = "SELECT %s, legacy, sources FROM state_profile WHERE slug = :slug".formatted(CARD_COLUMNS);

    static final String EXISTS = "SELECT count(*) FROM state_profile WHERE slug = :slug";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final StepReader steps;
    private final RelationReader relations;
    private final MediaFiles media;

    StateReader(JdbcClient jdbc, PublicCache cache, StepReader steps, RelationReader relations, MediaFiles media) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.steps = steps;
        this.relations = relations;
        this.media = media;
    }

    public ResultPage<StateCard> list(ReadContext ctx, ResultPage.Request page) {
        return cache.get(ctx, "states", page, () -> Lists.page(jdbc, LIST, page, rs -> card(rs, ctx.lang(), media.at(ctx)), COUNT));
    }

    public StateDetail detail(ReadContext ctx, String slug) {
        return cache.get(ctx, "state", slug, () -> {
            Lang lang = ctx.lang();
            record Row(StateCard card, JsonNode legacy, JsonNode sources) {}
            Row r = jdbc.sql(ONE).param("slug", slug).query((rs, n) -> new Row(card(rs, lang, media.at(ctx)), lang.text(JsonColumns.json(rs, "legacy")),
                    JsonColumns.json(rs, "sources"))).optional()
                    .orElseThrow(() -> new ResourceNotFoundException(DocumentType.STATE, slug));
            StateCard c = r.card();
            return new StateDetail(c.slug(), c.politySlug(), c.name(), c.years(), c.startYear(), c.endYear(), c.summary(), c.image(),
                    c.eraSlugs(), c.dynasty(), c.themeSlug(), r.legacy(), ApiSource.all(r.sources()),
                    relations.of(EntityType.STATE, slug, false, lang));
        });
    }

    public Steps steps(ReadContext ctx, String slug) {
        return cache.get(ctx, "state-steps", slug, () -> {
            List<StepView> list = steps.of(EntityType.STATE, slug, null, ctx);
            if (list.isEmpty()) requireExists(slug);
            return new Steps(new Steps.Owner(EntityType.STATE, slug), ctx.contentVersion(), list);
        });
    }

    public StepView step(ReadContext ctx, String slug, String stepKey) {
        return cache.get(ctx, "state-step", slug + "/" + stepKey, () -> {
            List<StepView> list = steps.of(EntityType.STATE, slug, stepKey, ctx);
            if (!list.isEmpty()) return list.getFirst();
            requireExists(slug);
            throw new ResourceNotFoundException(DocumentType.STATE, slug, stepKey);
        });
    }

    private void requireExists(String slug) {
        if (jdbc.sql(EXISTS).param("slug", slug).query(Long.class).single() == 0) {
            throw new ResourceNotFoundException(DocumentType.STATE, slug);
        }
    }

    static StateCard card(ResultSet rs, Lang lang, MediaIndex media) throws SQLException {
        return new StateCard(rs.getString("slug"), rs.getString("polity_slug"), lang.text(JsonColumns.json(rs, "name")),
                rs.getString("years"), JsonColumns.integer(rs, "start_year"), JsonColumns.integer(rs, "end_year"),
                lang.text(JsonColumns.json(rs, "summary")), ApiImage.of(JsonColumns.json(rs, "image"), lang, media),
                JsonColumns.strings(rs, "era_slugs"), JsonColumns.strings(rs, "dynasty"), rs.getString("theme_slug"));
    }
}
