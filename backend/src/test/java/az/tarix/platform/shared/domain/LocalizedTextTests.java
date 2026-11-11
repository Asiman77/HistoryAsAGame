package az.tarix.platform.shared.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class LocalizedTextTests {

    final LocalizedText tabriz = new LocalizedText(Map.of("az", "Təbriz", "en", "Tabriz"));

    @Test
    void requiresAzerbaijani() {
        assertThatThrownBy(() -> new LocalizedText(Map.of("en", "Tabriz"))).hasMessageContaining("az");
        assertThatThrownBy(() -> new LocalizedText(Map.of("az", " "))).hasMessageContaining("empty");
        assertThatThrownBy(() -> new LocalizedText(Map.of("az", "x", "EN", "y"))).hasMessageContaining("language");
    }

    @Test
    void fallsBackToAzerbaijani() {
        assertThat(tabriz.resolve("en")).isEqualTo("Tabriz");
        assertThat(tabriz.resolve("ru")).isEqualTo("Təbriz");
        assertThat(tabriz.get("ru")).isEmpty();
        assertThat(tabriz.missing(List.of("en", "ru"))).containsExactly("ru");
    }

    @Test
    void isImmutable() {
        assertThatThrownBy(() -> tabriz.values().put("ru", "Тебриз")).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void serializesAsAPlainJsonObject() {
        JsonMapper json = JsonMapper.shared();
        assertThat(json.writeValueAsString(LocalizedText.az("Ərdəbil"))).isEqualTo("{\"az\":\"Ərdəbil\"}");
        assertThat(json.readValue("{\"az\":\"Təbriz\",\"en\":\"Tabriz\"}", LocalizedText.class)).isEqualTo(tabriz);
    }
}
