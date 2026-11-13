package az.tarix.platform.catalog.internal.projection;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.shared.content.SourceKeys;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class StepWriterTests {

    static JsonNode json(String text) {
        return JsonMapper.shared().readTree(text.replace('\'', '"'));
    }

    @Test
    void routeRunsFromTheStartThroughTheWaypointsToTheLocation() {
        JsonNode step = json("{'fromLocation': {'lng': 1, 'lat': 2}, 'route': [[3, 4]], 'location': {'lng': 5, 'lat': 6}}");
        assertThat(json(StepWriter.route(step))).isEqualTo(json("{'type': 'LineString', 'coordinates': [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]]}"));
        assertThat(StepWriter.route(json("{'location': {'lng': 5, 'lat': 6}}"))).isNull();
    }

    @Test
    void detailsKeepOnlyWhatHasNoColumn() {
        JsonNode details = StepWriter.details(json("""
                {'id': 'a', 'order': 1, 'title': {'az': 'x'}, 'sources': [], 'related': [], 'type': 'battle',
                 'outcome': {'result': 'victory'}, 'quiz': []}"""));
        assertThat(details).isEqualTo(json("{'outcome': {'result': 'victory'}, 'quiz': [], 'eventType': 'battle'}"));
    }

    @Test
    void sourcesAreTheSameWhenTitleAuthorUrlAndTypeAre() {
        JsonNode a = json("{'title': 'Tarix', 'author': 'X', 'type': 'book', 'note': 's. 5'}");
        JsonNode b = json("{'title': 'Tarix', 'author': 'X', 'type': 'book', 'note': 's. 9'}");
        JsonNode c = json("{'title': 'Tarix', 'author': 'Y', 'type': 'book'}");
        assertThat(SourceKeys.hash(a)).isEqualTo(SourceKeys.hash(b)).isNotEqualTo(SourceKeys.hash(c));
    }
}
