package az.tarix.platform.geo.api;

import az.tarix.platform.geo.api.PlaceLookup.Point;
import az.tarix.platform.shared.domain.Certainty;
import java.util.List;
import java.util.Optional;
import tools.jackson.databind.JsonNode;

/**
 * The political map by year (territory snapshots), as other modules see it. Every method is
 * one query. Names are {@code LocalizedText} JSON, not yet localized.
 *
 * <p>A snapshot describes its own year and at most {@link #REACH_YEARS} after it, never past
 * the next snapshot (the frontend's {@code SNAPSHOT_REACH_YEARS}): a map of 1520 says nothing
 * about 1690. Years outside every reach are not covered (BACKEND_SPEC.md §10.3,
 * {@code coverage: NONE}).
 */
public interface Territories {

    int REACH_YEARS = 30;

    /**
     * The map for a year.
     *
     * @param slug     snapshot to draw: the covering one, or in a gap the nearest one (to be drawn
     *                 faded); null only when there are no snapshots at all
     * @param year     year of that snapshot
     * @param covered  whether the snapshot really describes the asked year
     * @param prevYear in a gap, the last covered year before it (for a "jump" button), else null
     * @param nextYear in a gap, the year of the next snapshot, else null
     */
    record SnapshotPick(String slug, Integer year, boolean covered, Integer prevYear, Integer nextYear) {

        public static final SnapshotPick NONE = new SnapshotPick(null, null, false, null, null);
    }

    /**
     * A polity's area in a snapshot.
     *
     * @param capitalPlaceSlug catalogue place of its capital, or null
     * @param vassalOf         polity slug of its suzerain, or null
     * @param certainty        of this area (falls back to the snapshot's)
     */
    record Holder(String politySlug, JsonNode name, String color, String capitalPlaceSlug, String vassalOf, Certainty certainty) {}

    /** A run of years in which a place lay inside one polity, or a gap no map covers. */
    record MembershipSpan(Kind kind, int fromYear, int toYear, String politySlug, JsonNode name, String color, boolean capital,
                          String vassalOf, Certainty certainty) {

        public enum Kind { POLITY, GAP }
    }

    SnapshotPick pick(int year);

    /**
     * The polities whose area in the covering snapshot contains the point (the boundary counts,
     * as in the frontend). Several when areas overlap (disputed or vassal lands). Empty when
     * the year is not covered.
     */
    List<Holder> at(Point point, int year);

    /** The areas of a snapshot, in authored order; empty for an unknown slug. */
    List<Holder> holders(String snapshotSlug);

    /**
     * Which polity held a catalogue place, period by period, over all snapshots (frontend
     * {@code placeMembership} + {@code clipToLifetime}). Consecutive snapshots with the same
     * owner merge; stretches no snapshot reaches become gaps; only the years the place existed
     * remain. Empty when the place does not exist.
     */
    Optional<List<MembershipSpan>> membership(String placeSlug);
}
