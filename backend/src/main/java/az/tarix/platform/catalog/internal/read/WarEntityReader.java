package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiDate;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.MediaFiles;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** Battles and heroes of the public API ({@code /battles/{slug}}, {@code /heroes/{slug}}). */
@Service
public class WarEntityReader {

    /**
     * @param stepKey     the day of the conflict simulation that shows the battle
     * @param dates       as written ("4–8 noyabr 2020")
     * @param date        the date when one is known exactly enough, or null
     * @param sides       sides, commanders, forces, outcome, significance: null until the content has them
     */
    public record BattleView(String slug, JsonNode name, String conflictSlug, String stepKey, String dates, ApiDate date,
                             String placeSlug, JsonNode summary, JsonNode sides, JsonNode commanders, JsonNode forces,
                             JsonNode outcome, JsonNode significance, List<ApiSource> sources, List<ApiLink> relations) {}

    /**
     * A hero or martyr. A real modern person: the photo is only shown with clear permission,
     * and never generated (BACKEND_SPEC.md §8.3).
     */
    public record HeroView(String slug, String conflictSlug, JsonNode fullName, JsonNode rank, boolean posthumous,
                           JsonNode birthPlace, Integer birthYear, ApiDate death, List<JsonNode> awards, JsonNode bio,
                           ApiImage photo, List<ApiSource> sources) {}

    static final String BATTLE = """
            SELECT slug, name, conflict_slug, step_key, dates, date_year, date_month, date_day, date_precision, date_certainty,
                   place_slug, summary, sides, commanders, forces, outcome, significance, sources
            FROM battle WHERE slug = :slug""";

    static final String HERO = """
            SELECT slug, conflict_slug, full_name, rank, posthumous, birth_place, birth_year,
                   death_year, death_month, death_day, death_precision, death_certainty, awards, bio, photo, sources
            FROM hero WHERE slug = :slug""";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final RelationReader relations;
    private final MediaFiles media;

    WarEntityReader(JdbcClient jdbc, PublicCache cache, RelationReader relations, MediaFiles media) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.relations = relations;
        this.media = media;
    }

    public BattleView battle(ReadContext ctx, String slug) {
        return cache.get(ctx, "battle", slug, () -> {
            Lang lang = ctx.lang();
            BattleView b = jdbc.sql(BATTLE).param("slug", slug).query((rs, n) -> new BattleView(rs.getString("slug"),
                    lang.text(JsonColumns.json(rs, "name")), rs.getString("conflict_slug"), rs.getString("step_key"),
                    rs.getString("dates"), ApiDate.read(rs, "date"), rs.getString("place_slug"),
                    lang.text(JsonColumns.json(rs, "summary")), lang.localize(JsonColumns.json(rs, "sides")),
                    lang.localize(JsonColumns.json(rs, "commanders")), lang.localize(JsonColumns.json(rs, "forces")),
                    lang.localize(JsonColumns.json(rs, "outcome")), lang.text(JsonColumns.json(rs, "significance")),
                    ApiSource.all(JsonColumns.json(rs, "sources")), null))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.BATTLE, slug));
            return new BattleView(b.slug(), b.name(), b.conflictSlug(), b.stepKey(), b.dates(), b.date(), b.placeSlug(), b.summary(),
                    b.sides(), b.commanders(), b.forces(), b.outcome(), b.significance(), b.sources(),
                    relations.of(EntityType.BATTLE, slug, false, lang));
        });
    }

    public HeroView hero(ReadContext ctx, String slug) {
        return cache.get(ctx, "hero", slug, () -> {
            Lang lang = ctx.lang();
            return jdbc.sql(HERO).param("slug", slug).query((rs, n) -> new HeroView(rs.getString("slug"),
                    rs.getString("conflict_slug"), lang.text(JsonColumns.json(rs, "full_name")),
                    lang.text(JsonColumns.json(rs, "rank")), rs.getBoolean("posthumous"),
                    lang.text(JsonColumns.json(rs, "birth_place")), JsonColumns.integer(rs, "birth_year"), ApiDate.read(rs, "death"),
                    lang.localizeAll(JsonColumns.json(rs, "awards")), lang.text(JsonColumns.json(rs, "bio")),
                    ApiImage.ofPhoto(JsonColumns.json(rs, "photo"), media.at(ctx)), ApiSource.all(JsonColumns.json(rs, "sources"))))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.HERO, slug));
        });
    }
}
