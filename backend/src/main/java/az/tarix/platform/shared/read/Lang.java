package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.LocalizedText;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Language of a public API response (BACKEND_SPEC.md §10): localized fields become plain
 * strings in that language, falling back to Azerbaijani. {@link #ALL} keeps every language
 * as an object (CMS preview, the frontend's build-time client).
 *
 * @param code {@code az}, {@code en}, {@code ru} or {@code all}
 */
public record Lang(String code) {

    public static final Lang AZ = new Lang(LocalizedText.DEFAULT_LANGUAGE);
    public static final Lang ALL = new Lang("all");

    private static final Pattern LANGUAGE_KEY = Pattern.compile("^[a-z]{2}$");

    public Lang {
        if (!"all".equals(code) && !LocalizedText.SUPPORTED_LANGUAGES.contains(code)) {
            throw new InvalidParameterException("lang", "dəstəklənən dillər: az, en, ru, all");
        }
    }

    /**
     * {@code ?lang=} wins; otherwise the best supported match of {@code Accept-Language}
     * (RFC 4647 lookup), otherwise Azerbaijani. An unknown {@code ?lang} is an error, an
     * unknown {@code Accept-Language} is not (browsers send whatever the user set).
     */
    public static Lang of(String param, String acceptLanguage) {
        if (param != null && !param.isBlank()) return new Lang(param.strip().toLowerCase(Locale.ROOT));
        if (acceptLanguage != null && !acceptLanguage.isBlank()) {
            try {
                String match = Locale.lookupTag(Locale.LanguageRange.parse(acceptLanguage), LocalizedText.SUPPORTED_LANGUAGES);
                if (match != null) return new Lang(match.toLowerCase(Locale.ROOT));
            } catch (IllegalArgumentException malformed) {
                // a malformed header is ignored, like a missing one
            }
        }
        return AZ;
    }

    public boolean all() {
        return this.equals(ALL);
    }

    /**
     * A {@code LocalizedText} value: the text in this language (or Azerbaijani), or the whole
     * object for {@link #ALL}; null when absent.
     */
    public JsonNode text(JsonNode localized) {
        if (localized == null || localized.isMissingNode() || localized.isNull()) return null;
        if (all() || !localized.isObject()) return localized;
        JsonNode value = localized.get(code);
        if (value == null || !value.isString()) value = localized.get(LocalizedText.DEFAULT_LANGUAGE);
        return value;
    }

    /** {@link #text} for a {@code Map} (e.g. a parsed {@link LocalizedText}). */
    public JsonNode text(Map<String, String> localized) {
        if (localized == null) return null;
        ObjectNode node = JsonNodeFactory.instance.objectNode();
        localized.forEach(node::put);
        return text(node);
    }

    /**
     * Every {@code LocalizedText} inside {@code node}, at any depth, replaced by its text in
     * this language. Used for free-form JSON such as a step's kind-specific details. A
     * {@code LocalizedText} is an object whose keys are all two-letter language codes with
     * string values, one of them {@code az}; the content schema has no other such objects.
     */
    public JsonNode localize(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (all()) return node;
        if (isLocalizedText(node)) return text(node);
        if (node.isObject()) {
            ObjectNode out = JsonNodeFactory.instance.objectNode();
            for (Map.Entry<String, JsonNode> e : node.properties()) out.set(e.getKey(), localize(e.getValue()));
            return out;
        }
        if (node.isArray()) {
            ArrayNode out = JsonNodeFactory.instance.arrayNode();
            for (JsonNode item : node) out.add(localize(item));
            return out;
        }
        return node;
    }

    /** {@link #localize} for each element of a JSON array; empty when absent. */
    public List<JsonNode> localizeAll(JsonNode array) {
        if (array == null || !array.isArray()) return List.of();
        return java.util.stream.StreamSupport.stream(array.spliterator(), false).map(this::localize).toList();
    }

    static boolean isLocalizedText(JsonNode node) {
        if (!node.isObject() || !node.has(LocalizedText.DEFAULT_LANGUAGE)) return false;
        for (Map.Entry<String, JsonNode> e : node.properties()) {
            if (!LANGUAGE_KEY.matcher(e.getKey()).matches() || !e.getValue().isString()) return false;
        }
        return true;
    }

    @Override
    public String toString() {
        return code;
    }
}
