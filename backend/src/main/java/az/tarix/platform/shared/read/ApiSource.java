package az.tarix.platform.shared.read;

import az.tarix.platform.shared.content.SourceKeys;
import java.util.List;
import java.util.Locale;
import java.util.stream.StreamSupport;
import tools.jackson.databind.JsonNode;

/**
 * A bibliographic source in the public API. The slug is the same for the same book wherever
 * it is cited ({@link SourceKeys}).
 *
 * @param type    {@code BOOK}, {@code ARTICLE}, {@code ENCYCLOPEDIA}, {@code WEB}, {@code PRIMARY} or {@code DATASET}
 * @param locator page, chapter or a short remark on what the source supports, or null
 */
public record ApiSource(String slug, String title, String authors, String url, String type, String locator) {

    /** An inline {@code Source} of the content. */
    public static ApiSource of(JsonNode s) {
        return new ApiSource(SourceKeys.slug(s), str(s.path("title")), str(s.path("author")), str(s.path("url")),
                s.path("type").isString() ? s.path("type").stringValue().toUpperCase(Locale.ROOT) : null, str(s.path("note")));
    }

    /** Every inline source of a JSON array; empty when absent. */
    public static List<ApiSource> all(JsonNode array) {
        if (array == null || !array.isArray()) return List.of();
        return StreamSupport.stream(array.spliterator(), false).map(ApiSource::of).toList();
    }

    private static String str(JsonNode node) {
        return node.isString() ? node.stringValue() : null;
    }
}
