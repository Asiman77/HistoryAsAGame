package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.HistoryIndex.IndexEvent;
import az.tarix.platform.geo.api.PlaceLookup;
import az.tarix.platform.geo.api.PlaceSummary;
import az.tarix.platform.geo.api.Territories;
import az.tarix.platform.geo.api.Territories.MembershipSpan;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.PlaceType;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/**
 * The history of one place (BACKEND_SPEC.md §10.1 {@code /places/{slug}/timeline}): steps of
 * every category whose location belongs to the place, chronologically, and which polity held
 * it period by period.
 */
@Service
public class PlaceTimelineReader {

    public record PlaceHead(String slug, JsonNode historicalName, JsonNode modernName, PlaceType type, double lat, double lng) {}

    /**
     * A run of years under one polity ({@code POLITY}) or without a map ({@code GAP}).
     *
     * @param capital the place was that polity's capital
     */
    public record Span(MembershipSpan.Kind kind, int fromYear, int toYear, String polity, JsonNode name, String color,
                       boolean capital, String vassalOf, Certainty certainty) {}

    public record PlaceTimeline(PlaceHead place, List<Span> membership, List<IndexEvent> events) {}

    /**
     * Steps that may belong to the place: its explicit {@code placeId}, a war day with its name,
     * or any other step within reach of the 30 km rule. {@link PlaceMatcher} then decides, so a
     * step nearer to another place is left out exactly as on the steps endpoint.
     */
    static final String CANDIDATES = """
            s.location_place_slug = :slug
            OR (s.location_place_slug IS NULL AND s.step_kind = 'WAR_DAY'
                AND s.location_name ->> 'az' = ANY (CAST(:names AS text[])))
            OR (s.location_place_slug IS NULL AND s.step_kind <> 'WAR_DAY'
                AND ST_DWithin(s.location_point::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters))""";

    private final PublicCache cache;
    private final HistoryIndex index;
    private final PlaceLookup places;
    private final Territories territories;

    PlaceTimelineReader(PublicCache cache, HistoryIndex index, PlaceLookup places, Territories territories) {
        this.cache = cache;
        this.index = index;
        this.places = places;
        this.territories = territories;
    }

    public PlaceTimeline timeline(ReadContext ctx, String slug) {
        return cache.get(ctx, "place-timeline", slug, () -> {
            Lang lang = ctx.lang();
            PlaceSummary place = places.bySlugs(List.of(slug)).get(slug);
            if (place == null) throw new ResourceNotFoundException(DocumentType.PLACE, slug);
            List<Span> membership = territories.membership(slug).orElse(List.of()).stream()
                    .map(s -> new Span(s.kind(), s.fromYear(), s.toYear(), s.politySlug(), lang.text(s.name()), s.color(), s.capital(),
                            s.vassalOf(), s.certainty()))
                    .toList();
            Map<String, Object> params = new HashMap<>();
            params.put("slug", slug);
            params.put("names", names(place).toArray(String[]::new));
            params.put("lat", place.lat());
            params.put("lng", place.lng());
            // A little more than 30 km: the spheroid differs slightly from the frontend's sphere.
            params.put("meters", PlaceLookup.MATCH_KM * 1000 * 1.01);
            List<IndexEvent> events = index.where(CANDIDATES, params, ctx).stream()
                    .filter(e -> slug.equals(e.location().placeSlug())).toList();
            return new PlaceTimeline(new PlaceHead(place.slug(), lang.text(place.historicalName()), lang.text(place.modernName()),
                    place.type(), place.lat(), place.lng()), membership, events);
        });
    }

    /** The names a war day may use for the place: historical and modern, without a trailing " (…)". */
    static List<String> names(PlaceSummary place) {
        return Stream.of(place.historicalName(), place.modernName()).filter(Objects::nonNull)
                .map(n -> n.path("az").asString(null)).filter(Objects::nonNull)
                .map(n -> n.split(" \\(", 2)[0]).distinct().toList();
    }
}
