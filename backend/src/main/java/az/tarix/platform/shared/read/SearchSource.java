package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.EntityType;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import tools.jackson.databind.JsonNode;

/**
 * Full-text search over the entities a module owns (BACKEND_SPEC.md §10.1 {@code /search}):
 * {@code az_fold} + trigram word similarity, so "seh ismayil" finds "Şah İsmayıl". Each module
 * implements it for its own tables, like {@link EntityDirectory}; the search endpoint asks all
 * of them, one query per source.
 */
public interface SearchSource {

    /**
     * @param name     {@code LocalizedText} JSON, not yet localized
     * @param fromYear start of its years (birth, reign, existence), or null
     * @param toYear   end of its years, or null
     * @param score    0…1, how well the query matches a part of its best name (word similarity)
     * @param closeness 0…1, how close that whole name is to the query (similarity); breaks ties,
     *                  so "Şah İsmayıl" comes before "Səmədov İsmayıl Məhəmməd oğlu"
     */
    record Hit(EntityType type, String slug, JsonNode name, Integer fromYear, Integer toYear, double score, double closeness) {

        /** Best first. */
        public static final Comparator<Hit> ORDER = Comparator.comparingDouble(Hit::score).reversed()
                .thenComparing(Comparator.comparingDouble(Hit::closeness).reversed())
                .thenComparing(Hit::type).thenComparing(Hit::slug);
    }

    Set<EntityType> types();

    /** At most {@code limit} hits among {@code types} (a subset of {@link #types()}), best first. */
    List<Hit> search(String query, Set<EntityType> types, int limit);

    /**
     * One searchable table.
     *
     * @param names    SQL expressions of {@code LocalizedText} columns to match
     * @param fromYear SQL expression or {@code NULL}
     */
    record Table(EntityType type, String table, List<String> names, String fromYear, String toYear) {

        /**
         * The query for this table: a name matches when the folded query is word-similar to the
         * folded Azerbaijani or English name ({@code <%}, pg_trgm's threshold). Takes
         * {@code :q} and {@code :limit}.
         */
        public String sql() {
            List<String> scores = new ArrayList<>();
            List<String> closeness = new ArrayList<>();
            List<String> where = new ArrayList<>();
            for (String name : names) {
                for (String lang : List.of("az", "en")) {
                    String folded = "az_fold(coalesce(%s ->> '%s', ''))".formatted(name, lang);
                    scores.add("word_similarity(f.q, " + folded + ")");
                    closeness.add("similarity(f.q, " + folded + ")");
                    where.add("f.q <% " + folded);
                }
            }
            return """
                    SELECT '%s' AS type, slug, %s AS name, %s AS from_year, %s AS to_year,
                           greatest(%s) AS score, greatest(%s) AS closeness
                    FROM %s CROSS JOIN (SELECT az_fold(:q) AS q) f
                    WHERE %s
                    ORDER BY score DESC, closeness DESC, slug
                    LIMIT :limit""".formatted(type.name(), names.getFirst(), fromYear, toYear, String.join(", ", scores),
                    String.join(", ", closeness), table, String.join(" OR ", where));
        }
    }
}
