package az.tarix.platform.shared.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Translatable text, stored as JSONB {@code {"az": "...", "en": "...", "ru": "..."}}.
 * Azerbaijani is mandatory; any other language falls back to it.
 */
public record LocalizedText(Map<String, String> values) {

    public static final String DEFAULT_LANGUAGE = "az";
    /** Languages the platform ships today; others (e.g. "tr") can be stored before they are served. */
    public static final List<String> SUPPORTED_LANGUAGES = List.of("az", "en", "ru");
    private static final Pattern LANGUAGE = Pattern.compile("^[a-z]{2}$");

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public LocalizedText {
        if (values == null) throw new IllegalArgumentException("localized text is missing");
        Map<String, String> copy = new LinkedHashMap<>();
        values.forEach((lang, text) -> {
            if (lang == null || !LANGUAGE.matcher(lang).matches()) throw new IllegalArgumentException("invalid language code: " + lang);
            if (text == null || text.isBlank()) throw new IllegalArgumentException("empty text for language " + lang);
            copy.put(lang, text);
        });
        if (!copy.containsKey(DEFAULT_LANGUAGE)) throw new IllegalArgumentException("Azerbaijani (az) text is required");
        values = java.util.Collections.unmodifiableMap(copy);
    }

    public static LocalizedText az(String text) {
        return new LocalizedText(Map.of(DEFAULT_LANGUAGE, text));
    }

    @JsonValue
    @Override
    public Map<String, String> values() {
        return values;
    }

    public String az() {
        return values.get(DEFAULT_LANGUAGE);
    }

    public Optional<String> get(String language) {
        return Optional.ofNullable(values.get(language));
    }

    /** Text in {@code language}, or the Azerbaijani text when there is no translation. */
    public String resolve(String language) {
        return values.getOrDefault(language, az());
    }

    /** Which of {@code languages} have no translation (for the "missing en/ru" INFO rule). */
    public List<String> missing(Collection<String> languages) {
        return languages.stream().filter(l -> !values.containsKey(l)).toList();
    }
}
