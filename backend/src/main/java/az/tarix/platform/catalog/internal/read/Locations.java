package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.StepReader.StepLocation;
import az.tarix.platform.geo.api.PlaceLookup;
import az.tarix.platform.geo.api.PlaceLookup.Point;
import az.tarix.platform.geo.api.PlaceSummary;
import az.tarix.platform.shared.read.Lang;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/** Inline content {@code Location}s (birth, death) with their catalogue place, two queries at most. */
final class Locations {

    private Locations() {}

    /** Each location with its explicit {@code placeId} or else the nearest place within 30 km; null entries stay null. */
    static List<StepLocation> resolve(PlaceLookup places, List<JsonNode> locations, Lang lang) {
        List<String> explicit = locations.stream().filter(l -> l != null && l.path("placeId").isString())
                .map(l -> l.path("placeId").stringValue()).distinct().toList();
        Map<String, PlaceSummary> bySlug = places.bySlugs(explicit);
        List<JsonNode> withoutId = locations.stream().filter(l -> l != null && !l.path("placeId").isString()).toList();
        List<PlaceSummary> nearest = places.nearest(withoutId.stream()
                .map(l -> new Point(l.path("lat").asDouble(), l.path("lng").asDouble())).toList());
        List<StepLocation> out = new ArrayList<>(locations.size());
        int n = 0;
        for (JsonNode l : locations) {
            if (l == null) {
                out.add(null);
                continue;
            }
            String placeId = l.path("placeId").isString() ? l.path("placeId").stringValue() : null;
            PlaceSummary p = placeId != null ? bySlug.get(placeId) : nearest.get(n++);
            out.add(new StepLocation(p != null ? p.slug() : placeId, lang.text(l.path("name")), lang.text(l.path("modernName")),
                    l.path("lat").asDouble(), l.path("lng").asDouble(), l.path("approximate").asBoolean(false),
                    p == null ? null : p.type()));
        }
        return out;
    }
}
