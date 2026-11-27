package az.tarix.platform.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.PublishedData;
import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.editorial.DataDocuments.Doc;
import az.tarix.platform.editorial.internal.importing.DataFolder;
import az.tarix.platform.publishing.internal.Projector;
import az.tarix.platform.shared.content.DocumentType;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * The school curriculum (B2): today's data plus the sample grade (fixtures/curriculum.sample.json,
 * sample content that points at real steps) published and projected, then read through the API.
 */
@IntegrationTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CurriculumTests {

    static final Path SAMPLE = Path.of("..", "fixtures", "curriculum.sample.json");
    static final String DOMAIN = "curriculum.test";

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    Projector projector;

    RestClient http;

    static ObjectNode sampleDocument() throws IOException {
        ObjectNode c = JsonMapper.shared().createObjectNode();
        c.set("grade", JsonMapper.shared().readTree(Files.readString(SAMPLE)));
        return c;
    }

    @BeforeAll
    void publish() throws IOException {
        http = RestClient.builder().baseUrl("http://localhost:" + port + "/api/v1").defaultStatusHandler(s -> true, (q, r) -> {}).build();
        UUID owner = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:email, 'owner') RETURNING id")
                .param("email", "owner@" + DOMAIN).query(UUID.class).single();
        for (Doc d : DataDocuments.all()) PublishedData.seedPublished(jdbc, d, owner);
        PublishedData.seedPublished(jdbc, new Doc(DocumentType.CURRICULUM_GRADE, "azerbaijan-history-8", sampleDocument()), owner);
        assertThat(projector.rebuild().deferred()).isEmpty();
    }

    @AfterAll
    void cleanUp() {
        PublishedData.remove(jdbc, DOMAIN);
    }

    ResponseEntity<JsonNode> get(String path) {
        return http.get().uri(path).retrieve().toEntity(JsonNode.class);
    }

    JsonNode ok(String path) {
        ResponseEntity<JsonNode> res = get(path);
        assertThat(res.getStatusCode()).as(path).isEqualTo(HttpStatus.OK);
        return res.getBody();
    }

    static List<JsonNode> list(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false).toList();
    }

    @Test
    void theGradesOfASubjectWithTheirCountsAndYears() {
        JsonNode grades = ok("/curriculum/azerbaijan-history/grades");
        assertThat(grades.size()).isOne();
        JsonNode g = grades.get(0);
        assertThat(g.path("grade").asInt()).isEqualTo(8);
        assertThat(g.path("sample").asBoolean()).isTrue();
        assertThat(g.path("sections").asInt()).isEqualTo(2);
        assertThat(g.path("topics").asInt()).isEqualTo(4);
        assertThat(g.path("readyTopics").asInt()).isEqualTo(3);
        assertThat(g.path("years").path("from").asInt()).isLessThan(1501);
        assertThat(g.path("years").path("to").asInt()).isGreaterThanOrEqualTo(1748);
        assertThat(ok("/curriculum/world-history/grades").size()).isZero();
    }

    @Test
    void aGradeListsItsSectionsAndTopicsAndWhichCanBeOpened() {
        JsonNode grade = ok("/curriculum/azerbaijan-history/grades/8");
        assertThat(list(grade.path("sections")).stream().map(s -> s.path("slug").asString())).containsExactly("sample-section-1", "sample-section-2");
        JsonNode topics = grade.path("sections").get(1).path("topics");
        assertThat(topics.get(0).path("slug").asString()).isEqualTo("sample-efshar");
        assertThat(topics.get(0).path("ready").asBoolean()).isTrue();
        assertThat(topics.get(0).path("steps").asInt()).isEqualTo(4);
        assertThat(topics.get(1).path("slug").asString()).isEqualTo("sample-preparing");
        assertThat(topics.get(1).path("ready").asBoolean()).isFalse();
        assertThat(topics.get(1).path("years").isNull()).isTrue();
    }

    @Test
    void aTopicTellsItsStepsInItsOwnOrderFromSeveralSimulations() {
        JsonNode topic = ok("/curriculum/topics/sample-efshar/steps");
        assertThat(topic.path("paragraph").asString()).isEqualTo("§ 3");
        assertThat(topic.path("grade").asInt()).isEqualTo(8);
        assertThat(topic.path("sectionSlug").asString()).isEqualTo("sample-section-2");
        assertThat(list(topic.path("steps")).stream().map(s -> s.path("ownerType").asString() + ":" + s.path("step").path("stepKey").asString()))
                .containsExactly("PERSON:nadir-mughan", "STATE:1739-india", "STATE:1747-assassination", "STATE:1748-khanates");
    }

    @Test
    void stepsKnowTheTopicsThatTellThem() {
        JsonNode coronation = ok("/persons/shah-ismayil/steps/ismayil-coronation");
        assertThat(coronation.path("curriculum").size()).isOne();
        JsonNode ref = coronation.path("curriculum").get(0);
        assertThat(ref.path("topicSlug").asString()).isEqualTo("sample-sefevi");
        assertThat(ref.path("grade").asInt()).isEqualTo(8);
        assertThat(ref.path("paragraph").asString()).isEqualTo("§ 2");
        assertThat(ok("/persons/shah-ismayil/steps/ismayil-birth").path("curriculum").size()).isZero();
    }

    @Test
    void theTimelineOfAGradeShowsOnlyTheEventsItsTopicsTell() {
        JsonNode all = ok("/timeline?year=1501");
        JsonNode grade8 = ok("/timeline?year=1501&grade=8");
        assertThat(grade8.path("events").size()).isPositive().isLessThanOrEqualTo(all.path("events").size());
        assertThat(list(grade8.path("events")).stream().map(e -> e.path("stepKey").asString())).allMatch(k -> List.of("ismayil-sharur", "ismayil-coronation").contains(k));
        assertThat(ok("/timeline?year=1501&grade=9").path("events").size()).isZero();
        assertThat(grade8.path("rulers").size()).isEqualTo(all.path("rulers").size());
    }

    @Test
    void wrongAddressesAreNotFoundOrBadRequests() {
        assertThat(get("/curriculum/azerbaijan-history/grades/9").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/curriculum/topics/no-such-topic/steps").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/curriculum/azerbaijan-history/grades/12").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get("/curriculum/Not_A_Slug/grades").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get("/timeline?year=1501&grade=0").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void theImportReadsGradesFromDataCurriculum(@TempDir Path dir) throws IOException {
        Path subject = Files.createDirectories(dir.resolve("curriculum").resolve("azerbaijan-history"));
        Files.copy(SAMPLE, subject.resolve("8.json"));
        DataFolder.Result r = DataFolder.read(dir, null);
        assertThat(r.documents()).singleElement().satisfies(d -> {
            assertThat(d.type()).isEqualTo(DocumentType.CURRICULUM_GRADE);
            assertThat(d.slug()).isEqualTo("azerbaijan-history-8");
            assertThat(d.files()).containsExactly("curriculum/azerbaijan-history/8.json");
        });
    }
}
