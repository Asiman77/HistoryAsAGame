package az.tarix.platform.geo.api;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Which catalogue place an event location belongs to (ADR-0012: resolved at query time, so the
 * answer does not depend on the order documents were published in). Every method is one query.
 */
public interface PlaceLookup {

    /** Radius of {@link #nearest}, the same as the frontend's {@code matchPlace}. */
    double MATCH_KM = 30;

    /** A point on the map, WGS 84. */
    record Point(double lat, double lng) {}

    /** Published places by slug; unknown slugs are absent. */
    Map<String, PlaceSummary> bySlugs(Collection<String> slugs);

    /**
     * For each point, the nearest place closer than {@link #MATCH_KM} (great-circle distance,
     * as in the frontend), or null. The result has the same size and order as {@code points}.
     */
    List<PlaceSummary> nearest(List<Point> points);

    /**
     * Places whose Azerbaijani historical or modern name, without a trailing " (…)", is one of
     * {@code names}. War days are matched like this instead of by distance: they lie close
     * together, and 30 km would pin a regional overview on the nearest town (frontend
     * {@code buildHistoryIndex}).
     */
    Map<String, PlaceSummary> byName(Collection<String> names);
}
