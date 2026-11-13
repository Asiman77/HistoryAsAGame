package az.tarix.platform.media.api;

import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * A portrait for an age range of a person's life. Without a public file ({@code url} null) the
 * client shows a placeholder; AI illustrations always carry their {@code disclosure} label.
 *
 * @param kind {@code HISTORICAL}, {@code ARTWORK}, {@code AI_ILLUSTRATION} or {@code PHOTO}
 */
public record ApiPortrait(int ageFrom, int ageTo, String kind, String url, JsonNode alt, JsonNode caption, JsonNode disclosure,
                          String license, String author, String source, String sourceUrl, String promptId) {

    /**
     * The portrait for {@code age}: the one whose range contains it, else the nearest range;
     * the first wins a tie (the frontend's {@code pickPortrait}). Null when there are none.
     */
    public static ApiPortrait pick(List<ApiPortrait> portraits, int age) {
        ApiPortrait best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (ApiPortrait p : portraits) {
            int distance = age < p.ageFrom() ? p.ageFrom() - age : age > p.ageTo() ? age - p.ageTo() : 0;
            if (distance < bestDistance) {
                best = p;
                bestDistance = distance;
            }
        }
        return best;
    }
}
