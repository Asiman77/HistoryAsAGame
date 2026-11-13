package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.StepReader.StepLocation;
import az.tarix.platform.catalog.internal.read.StepReader.StepView;
import az.tarix.platform.geo.api.PlaceLookup;
import az.tarix.platform.media.api.ApiPortrait;
import az.tarix.platform.media.api.Portraits;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiDate;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import az.tarix.platform.shared.read.ResultPage;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** Persons of the public API: cards, profiles and life steps (BACKEND_SPEC.md §10.1). */
@Service
public class PersonReader {

    /** What a list shows: name, years, eras, portrait, theme. */
    public record PersonCard(String slug, JsonNode name, JsonNode shortName, ApiDate birth, ApiDate death, List<String> eraSlugs,
                             List<String> tags, String themeSlug, Integer featuredOrder, ApiImage portrait) {}

    /** Birth or death: when and where. */
    public record LifeEnd(ApiDate date, StepLocation location) {}

    public record PersonProfile(String slug, JsonNode name, JsonNode shortName, List<JsonNode> titles, LifeEnd birth, LifeEnd death,
                                List<String> eraSlugs, List<String> tags, String themeSlug, Integer featuredOrder, ApiImage portrait,
                                JsonNode shortBio, JsonNode legacy, JsonNode epigraph, List<ApiPortrait> portraits,
                                List<ApiLink> relations) {}

    static final String CARD_COLUMNS = """
            slug, name, short_name, birth_year, birth_month, birth_day, birth_precision, birth_certainty,
            death_year, death_month, death_day, death_precision, death_certainty, era_slugs, tags, theme_slug, featured_order,
            portrait""";

    static final String LIST = """
            SELECT %s, count(*) OVER () AS total FROM person
            ORDER BY featured_order NULLS LAST, birth_sort_key, slug
            LIMIT :limit OFFSET :offset""".formatted(CARD_COLUMNS);

    static final String ONE = """
            SELECT %s, titles, birth_alternatives, birth_note, death_alternatives, death_note, birth_location, death_location,
                   short_bio, legacy, epigraph
            FROM person WHERE slug = :slug""".formatted(CARD_COLUMNS);

    static final String COUNT = "SELECT count(*) FROM person";

    static final String EXISTS = "SELECT count(*) FROM person WHERE slug = :slug";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final StepReader steps;
    private final RelationReader relations;
    private final PlaceLookup places;
    private final Portraits portraits;

    PersonReader(JdbcClient jdbc, PublicCache cache, StepReader steps, RelationReader relations, PlaceLookup places,
                 Portraits portraits) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.steps = steps;
        this.relations = relations;
        this.places = places;
        this.portraits = portraits;
    }

    public ResultPage<PersonCard> list(ReadContext ctx, ResultPage.Request page) {
        return cache.get(ctx, "persons", page, () -> Lists.page(jdbc, LIST, page, rs -> card(rs, ctx.lang()), COUNT));
    }

    public PersonProfile profile(ReadContext ctx, String slug) {
        return cache.get(ctx, "person", slug, () -> {
            Lang lang = ctx.lang();
            record Row(PersonCard card, List<JsonNode> titles, ApiDate birth, ApiDate death, JsonNode birthLocation,
                       JsonNode deathLocation, JsonNode shortBio, JsonNode legacy, JsonNode epigraph) {}
            Row r = jdbc.sql(ONE).param("slug", slug).query((rs, n) -> new Row(card(rs, lang),
                    lang.localizeAll(JsonColumns.json(rs, "titles")), ApiDate.readWithNotes(rs, "birth", lang),
                    ApiDate.readWithNotes(rs, "death", lang), JsonColumns.json(rs, "birth_location"),
                    JsonColumns.json(rs, "death_location"), lang.text(JsonColumns.json(rs, "short_bio")),
                    lang.text(JsonColumns.json(rs, "legacy")), lang.localize(JsonColumns.json(rs, "epigraph"))))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.PERSON, slug));
            List<StepLocation> where = Locations.resolve(places, Arrays.asList(r.birthLocation(), r.deathLocation()), lang);
            PersonCard c = r.card();
            return new PersonProfile(c.slug(), c.name(), c.shortName(), r.titles(), new LifeEnd(r.birth(), where.get(0)),
                    new LifeEnd(r.death(), where.get(1)), c.eraSlugs(), c.tags(), c.themeSlug(), c.featuredOrder(), c.portrait(),
                    r.shortBio(), r.legacy(), r.epigraph(), portraits.of("PERSON", slug, lang),
                    relations.of(EntityType.PERSON, slug, false, lang));
        });
    }

    /** All life steps; 404 when the person does not exist. */
    public Steps steps(ReadContext ctx, String slug) {
        return cache.get(ctx, "person-steps", slug, () -> {
            List<StepView> list = steps.of(EntityType.PERSON, slug, null, ctx.lang());
            if (list.isEmpty()) requireExists(slug);
            return new Steps(new Steps.Owner(EntityType.PERSON, slug), ctx.contentVersion(), list);
        });
    }

    /** One life step (deep link); 404 when the person or the step does not exist. */
    public StepView step(ReadContext ctx, String slug, String stepKey) {
        return cache.get(ctx, "person-step", slug + "/" + stepKey, () -> {
            List<StepView> list = steps.of(EntityType.PERSON, slug, stepKey, ctx.lang());
            if (!list.isEmpty()) return list.getFirst();
            requireExists(slug);
            throw new ResourceNotFoundException(DocumentType.PERSON, slug, stepKey);
        });
    }

    private void requireExists(String slug) {
        if (jdbc.sql(EXISTS).param("slug", slug).query(Long.class).single() == 0) {
            throw new ResourceNotFoundException(DocumentType.PERSON, slug);
        }
    }

    static PersonCard card(ResultSet rs, Lang lang) throws SQLException {
        return new PersonCard(rs.getString("slug"), lang.text(JsonColumns.json(rs, "name")),
                lang.text(JsonColumns.json(rs, "short_name")), ApiDate.read(rs, "birth"), ApiDate.read(rs, "death"),
                JsonColumns.strings(rs, "era_slugs"), JsonColumns.strings(rs, "tags"), rs.getString("theme_slug"),
                JsonColumns.integer(rs, "featured_order"), ApiImage.of(JsonColumns.json(rs, "portrait"), lang));
    }
}
