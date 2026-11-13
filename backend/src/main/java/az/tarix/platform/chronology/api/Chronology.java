package az.tarix.platform.chronology.api;

import az.tarix.platform.shared.domain.Certainty;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * Eras and reigns as other modules see them (the time slider, theme selection). Every method is
 * one query. Names are {@code LocalizedText} JSON, not yet localized.
 */
public interface Chronology {

    record Era(String slug, JsonNode name, int startYear, int endYear, String themeSlug, String color) {

        public boolean covers(int year) {
            return startYear <= year && year <= endYear;
        }
    }

    /**
     * A reign running in some year.
     *
     * @param endYear       null while it is open-ended
     * @param rulerName     null when the ruler is not published
     */
    record ReignAt(String politySlug, JsonNode polityName, String polityColor, String rulerSlug, JsonNode rulerName,
                   int startYear, Integer startMonth, Integer endYear, Integer endMonth, Certainty certainty) {}

    /** All eras, in display order. */
    List<Era> eras();

    /**
     * Reigns running in the year: a ruler who began or ended a reign that year counts (frontend
     * {@code reignsInYear}). Several per polity when power was split or changed hands. Ordered
     * by polity, then start.
     */
    List<ReignAt> reignsIn(int year);

    /**
     * Frontend {@code eraForYear}: of the eras covering the year, the one that began last
     * (Səfəvi, not Ağqoyunlu, in 1501); null when none does.
     */
    static Era eraFor(List<Era> eras, int year) {
        Era best = null;
        for (Era e : eras) if (e.covers(year) && (best == null || e.startYear() > best.startYear())) best = e;
        return best;
    }
}
