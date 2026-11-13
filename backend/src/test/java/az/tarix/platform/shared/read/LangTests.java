package az.tarix.platform.shared.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class LangTests {

    static JsonNode json(String text) {
        return JsonMapper.shared().readTree(text.replace('\'', '"'));
    }

    @Test
    void queryParameterWinsOverTheHeader() {
        assertThat(Lang.of("en", "ru")).isEqualTo(new Lang("en"));
        assertThat(Lang.of(" ALL ", null)).isEqualTo(Lang.ALL);
    }

    @Test
    void acceptLanguageIsMatchedLikeRfc4647Lookup() {
        assertThat(Lang.of(null, "en-US,en;q=0.9")).isEqualTo(new Lang("en"));
        assertThat(Lang.of(null, "de-DE, ru;q=0.5")).isEqualTo(new Lang("ru"));
        assertThat(Lang.of(null, "fr")).isEqualTo(Lang.AZ);
        assertThat(Lang.of(null, "*")).isEqualTo(Lang.AZ);
        assertThat(Lang.of(null, ";;;q=x")).isEqualTo(Lang.AZ);
        assertThat(Lang.of(null, null)).isEqualTo(Lang.AZ);
    }

    @Test
    void anUnknownLangParameterIsAnError() {
        assertThatThrownBy(() -> Lang.of("tr", null)).isInstanceOf(InvalidParameterException.class)
                .extracting(e -> ((InvalidParameterException) e).parameter()).isEqualTo("lang");
    }

    @Test
    void textFallsBackToAzerbaijani() {
        JsonNode text = json("{'az': 'Təbriz', 'en': 'Tabriz'}");
        assertThat(new Lang("en").text(text).stringValue()).isEqualTo("Tabriz");
        assertThat(new Lang("ru").text(text).stringValue()).isEqualTo("Təbriz");
        assertThat(Lang.ALL.text(text)).isEqualTo(text);
        assertThat(Lang.AZ.text((JsonNode) null)).isNull();
        assertThat(Lang.AZ.text(json("{'a': null}").path("missing"))).isNull();
    }

    @Test
    void localizeReplacesLocalizedTextAtAnyDepth() {
        JsonNode details = json("""
                {'outcome': {'result': 'victory', 'note': {'az': 'Qələbə', 'en': 'Victory'}},
                 'quiz': [{'question': {'az': 'Nə vaxt?'}, 'options': [{'az': '1501'}, {'az': '1502'}], 'answer': 0}],
                 'liberated': ['hadrut'], 'zoom': 8}""");
        assertThat(new Lang("en").localize(details)).isEqualTo(json("""
                {'outcome': {'result': 'victory', 'note': 'Victory'},
                 'quiz': [{'question': 'Nə vaxt?', 'options': ['1501', '1502'], 'answer': 0}],
                 'liberated': ['hadrut'], 'zoom': 8}"""));
        assertThat(Lang.ALL.localize(details)).isSameAs(details);
    }

    @Test
    void onlyLanguageKeyedObjectsWithAzerbaijaniAreLocalizedText() {
        assertThat(Lang.isLocalizedText(json("{'az': 'x', 'en': 'y'}"))).isTrue();
        assertThat(Lang.isLocalizedText(json("{'en': 'y'}"))).isFalse();
        assertThat(Lang.isLocalizedText(json("{'az': 'x', 'tint': '#fff'}"))).isFalse();
        assertThat(Lang.isLocalizedText(json("{'az': 1}"))).isFalse();
    }
}
