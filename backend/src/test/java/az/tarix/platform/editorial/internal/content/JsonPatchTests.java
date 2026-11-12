package az.tarix.platform.editorial.internal.content;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.editorial.DataDocuments.Doc;
import az.tarix.platform.editorial.api.DocumentType;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/** RFC 6902 diff: applying the diff gives the target, and the diff is as small as a reviewer expects. */
class JsonPatchTests {

    static JsonNode json(String text) {
        return JsonMapper.shared().readTree(text.replace('\'', '"'));
    }

    static void assertRoundTrip(JsonNode a, JsonNode b) {
        assertThat(JsonPatch.apply(a, JsonPatch.diff(a, b))).isEqualTo(b);
    }

    @Test
    void identicalDocumentsHaveAnEmptyPatch() {
        JsonNode a = json("{'a': [1, {'b': 2}]}");
        assertThat(JsonPatch.diff(a, a.deepCopy())).isEmpty();
    }

    @Test
    void changingOneFieldIsOneReplace() {
        JsonNode a = json("{'events': [{'id': 'a', 'title': {'az': 'Bir'}}, {'id': 'b', 'title': {'az': 'İki'}}]}");
        JsonNode b = json("{'events': [{'id': 'a', 'title': {'az': 'Bir'}}, {'id': 'b', 'title': {'az': 'İkinci'}}]}");
        assertThat(JsonPatch.diff(a, b)).isEqualTo(json("[{'op': 'replace', 'path': '/events/1/title/az', 'value': 'İkinci'}]"));
    }

    @Test
    void insertingAnItemInTheMiddleIsOneAdd() {
        JsonNode a = json("[{'id': 1}, {'id': 2}, {'id': 3}, {'id': 4}]");
        JsonNode b = json("[{'id': 1}, {'id': 2}, {'id': 9}, {'id': 3}, {'id': 4}]");
        assertThat(JsonPatch.diff(a, b)).isEqualTo(json("[{'op': 'add', 'path': '/2', 'value': {'id': 9}}]"));
    }

    @Test
    void removingItemsAndKeys() {
        JsonNode a = json("{'x': 1, 'list': [1, 2, 3, 4], 'gone': true}");
        JsonNode b = json("{'x': 1, 'list': [1, 4], 'new': 'yes'}");
        ArrayNode patch = JsonPatch.diff(a, b);
        assertThat(patch).contains(json("{'op': 'remove', 'path': '/gone'}"), json("{'op': 'add', 'path': '/new', 'value': 'yes'}"));
        assertRoundTrip(a, b);
    }

    @Test
    void keysWithSlashesAndTildesAreEscaped() {
        JsonNode a = json("{'a/b': 1, 'c~d': 1}");
        JsonNode b = json("{'a/b': 2, 'c~d': 2}");
        assertThat(JsonPatch.diff(a, b)).extracting(op -> op.path("path").asString()).containsExactlyInAnyOrder("/a~1b", "/c~0d");
        assertRoundTrip(a, b);
    }

    @Test
    void typeChangesAndRootReplacement() {
        assertRoundTrip(json("{'a': [1]}"), json("{'a': {'b': 1}}"));
        assertRoundTrip(json("[1, 2]"), json("{'a': 1}"));
    }

    @Test
    void roundTripsOnRealDocuments() {
        Doc doc = DataDocuments.find(DocumentType.PERSON, "shah-ismayil");
        ObjectNode a = doc.content();
        ObjectNode b = a.deepCopy();
        ArrayNode events = (ArrayNode) b.path("events");
        events.remove(3);
        ((ObjectNode) events.get(0).path("title")).put("az", "Dəyişdirilmiş");
        events.add(events.get(1).deepCopy());
        ((ObjectNode) b.path("person")).remove("tags");
        assertRoundTrip(a, b);
        assertThat(JsonPatch.diff(a, b).size()).isLessThan(10);
    }

    @Test
    void manyRandomEditsRoundTrip() {
        java.util.Random random = new java.util.Random(42);
        for (int round = 0; round < 200; round++) {
            List<Integer> left = random.ints(random.nextInt(12), 0, 5).boxed().toList();
            List<Integer> right = random.ints(random.nextInt(12), 0, 5).boxed().toList();
            JsonNode a = JsonMapper.shared().valueToTree(left);
            JsonNode b = JsonMapper.shared().valueToTree(right);
            assertRoundTrip(a, b);
        }
    }

    @Test
    void hashIgnoresKeyOrder() {
        assertThat(ContentJson.hash(json("{'a': 1, 'b': {'c': 2, 'd': 3}}")))
                .isEqualTo(ContentJson.hash(json("{'b': {'d': 3, 'c': 2}, 'a': 1}")))
                .isNotEqualTo(ContentJson.hash(json("{'a': 1, 'b': {'c': 2, 'd': 4}}")));
    }
}
