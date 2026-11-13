package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.geo.api.PlaceLookup;
import az.tarix.platform.geo.api.PlaceLookup.Point;
import az.tarix.platform.geo.api.PlaceSummary;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Component;

/**
 * The catalogue place of event locations (ADR-0012, ADR-0014, the frontend's rules): the
 * explicit {@code placeId}; otherwise for war days a place with the same name, for everything
 * else the nearest place within 30 km. One query per rule, whatever the number of locations.
 */
@Component
class PlaceMatcher {

    /**
     * What a location offers for matching.
     *
     * @param placeSlug explicit {@code placeId}, or null
     * @param nameAz    Azerbaijani name, used when {@code byName}
     * @param byName    match by name instead of distance (war days)
     */
    record Query(String placeSlug, String nameAz, double lat, double lng, boolean byName) {}

    private final PlaceLookup places;

    PlaceMatcher(PlaceLookup places) {
        this.places = places;
    }

    /** The place of every item that has one; items without a place are absent. */
    <K> Map<K, PlaceSummary> match(List<K> items, Function<K, Query> query) {
        List<K> explicit = new ArrayList<>();
        List<K> byName = new ArrayList<>();
        List<K> byDistance = new ArrayList<>();
        for (K item : items) {
            Query q = query.apply(item);
            if (q.placeSlug() != null) explicit.add(item);
            else if (q.byName()) byName.add(item);
            else byDistance.add(item);
        }
        Map<K, PlaceSummary> out = new HashMap<>();
        if (!explicit.isEmpty()) {
            Map<String, PlaceSummary> bySlug = places.bySlugs(explicit.stream().map(k -> query.apply(k).placeSlug()).distinct().toList());
            for (K k : explicit) {
                PlaceSummary p = bySlug.get(query.apply(k).placeSlug());
                if (p != null) out.put(k, p);
            }
        }
        if (!byName.isEmpty()) {
            Map<String, PlaceSummary> named = places.byName(byName.stream().map(k -> query.apply(k).nameAz()).distinct().toList());
            for (K k : byName) {
                PlaceSummary p = named.get(query.apply(k).nameAz());
                if (p != null) out.put(k, p);
            }
        }
        if (!byDistance.isEmpty()) {
            List<PlaceSummary> nearest = places.nearest(byDistance.stream().map(k -> {
                Query q = query.apply(k);
                return new Point(q.lat(), q.lng());
            }).toList());
            for (int i = 0; i < byDistance.size(); i++) if (nearest.get(i) != null) out.put(byDistance.get(i), nearest.get(i));
        }
        return out;
    }
}
