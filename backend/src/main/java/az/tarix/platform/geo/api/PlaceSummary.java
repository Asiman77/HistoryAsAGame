package az.tarix.platform.geo.api;

import az.tarix.platform.shared.domain.PlaceType;
import tools.jackson.databind.JsonNode;

/**
 * A catalogue place as other modules see it. Names are {@code LocalizedText} JSON, not yet
 * localized (the caller knows the response language).
 *
 * @param importance 1 = always shown on the map, 3 = only when zoomed in
 */
public record PlaceSummary(String slug, JsonNode historicalName, JsonNode modernName, PlaceType type, double lat, double lng,
                           int importance) {}
