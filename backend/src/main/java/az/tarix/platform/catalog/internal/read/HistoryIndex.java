package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.chronology.api.Chronology;
import az.tarix.platform.chronology.api.Chronology.Era;
import az.tarix.platform.geo.api.PlaceSummary;
import az.tarix.platform.shared.domain.ClaimType;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.domain.Mood;
import az.tarix.platform.shared.domain.PlaceType;
import az.tarix.platform.shared.domain.StepKind;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiDate;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.MediaFiles;
import az.tarix.platform.shared.read.MediaIndex;
import az.tarix.platform.shared.read.ReadContext;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Every dated step of every simulation as one flat, chronological list (the frontend's
 * {@code buildHistoryIndex}): the time slider, "Tarixdə bu gün", place pages and the compare
 * mode read it. Each call is the step query, the eras and at most three place-matching
 * queries, however many steps match.
 */
@Component
public class HistoryIndex {

    /** Category badge: a person's life, a war (battle) or a state's history. */
    public enum Category { PERSON, BATTLE, STATE }

    /**
     * Where an indexed step happened.
     *
     * @param placeSlug the catalogue place it belongs to (ADR-0014 rules), or null
     */
    public record IndexLocation(String placeSlug, JsonNode name, double lat, double lng, PlaceType type) {}

    /**
     * One step in the index.
     *
     * @param key       {@code <type>:<owner>:<step>} in lower case, as the frontend's index key
     * @param ownerName short name of the person, name of the state or war
     * @param eraSlug   the era of the year, among the owner's eras first, then all eras
     * @param themeSlug step theme, else the owner's, else the era's, else {@code default}
     * @param image     the owner's card image (public licence only), or null
     */
    public record IndexEvent(String key, EntityType ownerType, String ownerSlug, JsonNode ownerName, Category category,
                             String stepKey, StepKind kind, Mood mood, ClaimType claimType, JsonNode title, ApiDate date,
                             IndexLocation location, String eraSlug, String themeSlug, ApiImage image) {}

    /** Frontend {@code DEFAULT_THEME_ID}. */
    static final String DEFAULT_THEME = "default";

    /** Ordered as the frontend's {@code compareIndexed}: year, month, day (unknown = 0), then key. */
    static final String EVENTS = """
            SELECT s.owner_type, s.owner_slug, s.step_key, s.step_kind, s.mood, s.claim_type, s.title,
                   s.date_year, s.date_month, s.date_day, s.date_precision, s.date_certainty,
                   s.location_name, ST_Y(s.location_point) AS lat, ST_X(s.location_point) AS lng, s.location_place_slug,
                   s.theme_slug, o.name AS owner_name, o.theme_slug AS owner_theme, o.era_slugs, o.image
            FROM simulation_step s
            JOIN LATERAL (
              SELECT coalesce(short_name, name) AS name, theme_slug, era_slugs, portrait AS image
              FROM person WHERE s.owner_type = 'PERSON' AND slug = s.owner_slug
              UNION ALL
              SELECT name, theme_slug, era_slugs, image FROM state_profile WHERE s.owner_type = 'STATE' AND slug = s.owner_slug
              UNION ALL
              SELECT name, theme_slug, era_slugs, NULL FROM conflict WHERE s.owner_type = 'CONFLICT' AND slug = s.owner_slug
            ) o ON true
            WHERE {where}
            ORDER BY s.date_year, coalesce(s.date_month, 0), coalesce(s.date_day, 0),
                     lower(s.owner_type) || ':' || s.owner_slug || ':' || s.step_key COLLATE "C"
            """;

    private final JdbcClient jdbc;
    private final PlaceMatcher places;
    private final Chronology chronology;
    private final MediaFiles media;

    HistoryIndex(JdbcClient jdbc, PlaceMatcher places, Chronology chronology, MediaFiles media) {
        this.jdbc = jdbc;
        this.places = places;
        this.chronology = chronology;
        this.media = media;
    }

    private record Row(EntityType ownerType, String ownerSlug, String stepKey, StepKind kind, Mood mood, ClaimType claimType,
                       JsonNode title, ApiDate date, JsonNode locationName, double lat, double lng, String placeSlug,
                       String stepTheme, JsonNode ownerName, String ownerTheme, List<String> ownerEras, JsonNode image) {}

    /**
     * The steps matching {@code condition} (SQL over {@code simulation_step s}, a constant of
     * the calling reader, never user input), in index order.
     */
    List<IndexEvent> where(String condition, Map<String, ?> params, ReadContext ctx) {
        Lang lang = ctx.lang();
        List<Row> rows = jdbc.sql(EVENTS.replace("{where}", condition)).params(params).query((rs, n) -> new Row(
                EntityType.valueOf(rs.getString("owner_type")), rs.getString("owner_slug"), rs.getString("step_key"),
                StepKind.valueOf(rs.getString("step_kind")), Mood.valueOf(rs.getString("mood")),
                ClaimType.valueOf(rs.getString("claim_type")), JsonColumns.json(rs, "title"), ApiDate.read(rs, "date"),
                JsonColumns.json(rs, "location_name"), rs.getDouble("lat"), rs.getDouble("lng"),
                rs.getString("location_place_slug"), rs.getString("theme_slug"), JsonColumns.json(rs, "owner_name"),
                rs.getString("owner_theme"), JsonColumns.strings(rs, "era_slugs"), JsonColumns.json(rs, "image"))).list();
        if (rows.isEmpty()) return List.of();
        List<Era> eras = chronology.eras();
        Map<Row, PlaceSummary> matched = places.match(rows, r -> new PlaceMatcher.Query(r.placeSlug(),
                r.locationName().path("az").asString(""), r.lat(), r.lng(), r.kind() == StepKind.WAR_DAY));
        MediaIndex media = this.media.at(ctx);
        return rows.stream().map(r -> event(r, matched.get(r), eras, lang, media)).toList();
    }

    private static IndexEvent event(Row r, PlaceSummary place, List<Era> eras, Lang lang, MediaIndex media) {
        List<Era> own = eras.stream().filter(e -> r.ownerEras().contains(e.slug())).toList();
        Era era = Chronology.eraFor(own, r.date().year());
        if (era == null) era = Chronology.eraFor(eras, r.date().year());
        return new IndexEvent(r.ownerType().name().toLowerCase(Locale.ROOT) + ":" + r.ownerSlug() + ":" + r.stepKey(),
                r.ownerType(), r.ownerSlug(), lang.text(r.ownerName()), category(r.ownerType()), r.stepKey(), r.kind(), r.mood(),
                r.claimType(), lang.text(r.title()), r.date(),
                new IndexLocation(place != null ? place.slug() : r.placeSlug(), lang.text(r.locationName()), r.lat(), r.lng(),
                        place == null ? null : place.type()),
                era == null ? null : era.slug(), theme(r, own, eras), ApiImage.of(r.image(), lang, media));
    }

    /** Frontend {@code pickThemeId}. */
    static String theme(Row r, List<Era> ownEras, List<Era> allEras) {
        if (r.stepTheme() != null) return r.stepTheme();
        if (r.ownerTheme() != null) return r.ownerTheme();
        Era era = Chronology.eraFor(ownEras, r.date().year());
        if (era == null) era = Chronology.eraFor(allEras, r.date().year());
        if (era != null) return era.themeSlug();
        if (!ownEras.isEmpty()) return ownEras.getFirst().themeSlug();
        return DEFAULT_THEME;
    }

    static Category category(EntityType ownerType) {
        return switch (ownerType) {
            case PERSON -> Category.PERSON;
            case CONFLICT -> Category.BATTLE;
            case STATE -> Category.STATE;
            default -> throw new IllegalArgumentException("not a simulation owner: " + ownerType);
        };
    }
}
