package az.tarix.platform.shared.schema;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DataFileTests {

    @Test
    void starMatchesWithinOneSegment() {
        DataFile person = new DataFile("persons/*/person.json", "Person");
        assertThat(person.matches("persons/nadir-shah/person.json")).isTrue();
        assertThat(person.matches("persons/a/b/person.json")).isFalse();
        assertThat(person.matches("persons\\nadir-shah\\person.json")).isTrue();
    }

    @Test
    void dotsAreLiteral() {
        DataFile eras = new DataFile("eras/*.json", "Era");
        assertThat(eras.matches("eras/sefevi.json")).isTrue();
        assertThat(eras.matches("eras/sefevi.jsonx")).isFalse();
        assertThat(new DataFile("places.json", "PlacesFile").matches("placesXjson")).isFalse();
    }
}
