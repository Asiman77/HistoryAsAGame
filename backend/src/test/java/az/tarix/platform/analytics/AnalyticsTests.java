package az.tarix.platform.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.IntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Anonymous learning events end to end (BACKEND_SPEC.md §12, §18): intake, privacy, limits,
 * the daily totals and the three reports.
 */
@IntegrationTest
class AnalyticsTests {

    static final String EVENTS = "/api/v1/events";
    static final String DOMAIN = "@analytics.test";
    static final ZoneId BAKU = ZoneId.of("Asia/Baku");

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    JwtEncoder jwtEncoder;

    final Map<String, String> tokens = new HashMap<>();
    final Map<String, UUID> ids = new HashMap<>();

    @BeforeEach
    void users() {
        user("admin", "ADMIN");
        user("teacher", "TEACHER");
        user("other", "TEACHER");
    }

    @AfterEach
    void cleanUp() {
        jdbc.sql("DELETE FROM learning_event").update();
        jdbc.sql("DELETE FROM daily_aggregate").update();
        jdbc.sql("DELETE FROM class_group").update();
        jdbc.sql("DELETE FROM app_user WHERE email LIKE :d").param("d", "%" + DOMAIN).update();
    }

    void user(String name, String role) {
        UUID id = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES (:e, :n) RETURNING id")
                .param("e", name + DOMAIN).param("n", name).query(UUID.class).single();
        jdbc.sql("INSERT INTO user_role (user_id, role) VALUES (:id, :r)").param("id", id).param("r", role).update();
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("tarix-platform").subject(id.toString()).issuedAt(now)
                .expiresAt(now.plusSeconds(600)).claim("roles", List.of(role)).build();
        tokens.put(name, jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue());
        ids.put(name, id);
    }

    String classOf(String teacher, String code) {
        jdbc.sql("INSERT INTO class_group (code, name, teacher_id, created_at, updated_at, version) VALUES (:c, '7A', :t, now(), now(), 0)")
                .param("c", code).param("t", ids.get(teacher)).update();
        return code;
    }

    RestClient http() {
        return RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build();
    }

    ResponseEntity<JsonNode> post(Object body) {
        return http().post().uri(EVENTS).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().toEntity(JsonNode.class);
    }

    ResponseEntity<JsonNode> call(String who, HttpMethod method, String path) {
        return http().method(method).uri(path).header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.get(who)).retrieve()
                .toEntity(JsonNode.class);
    }

    static Map<String, Object> batch(UUID session, String classCode, List<Map<String, Object>> events) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("sessionId", session.toString());
        if (classCode != null) b.put("classCode", classCode);
        b.put("events", events);
        return b;
    }

    static Map<String, Object> ev(String type, Object... fields) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("type", type);
        for (int i = 0; i < fields.length; i += 2) e.put((String) fields[i], fields[i + 1]);
        return e;
    }

    static Map<String, Object> onStep(String type, String step, Object... more) {
        List<Object> f = new ArrayList<>(List.of("ownerType", "person", "ownerSlug", "shah-ismayil", "stepKey", step));
        f.addAll(List.of(more));
        return ev(type, f.toArray());
    }

    long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    // --- intake and privacy --------------------------------------------------------------

    @Test
    void eventsAreStoredWithoutAnythingPersonal() {
        UUID session = UUID.randomUUID();
        ResponseEntity<JsonNode> res = http().post().uri(EVENTS).contentType(MediaType.APPLICATION_JSON)
                // A token, even a forged one, is not read here: events stay anonymous.
                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-token")
                .body(batch(session, null, List.of(
                        ev("simulation_started", "ownerType", "person", "ownerSlug", "shah-ismayil", "mode", "story"),
                        onStep("step_viewed", "ismayil-birth", "durationMs", 12_000)))).retrieve().toEntity(JsonNode.class);
        assertThat(res.getStatusCode().value()).as(String.valueOf(res.getBody())).isEqualTo(202);
        assertThat(res.getBody().path("accepted").asInt()).isEqualTo(2);
        assertThat(res.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(count("SELECT count(*) FROM learning_event WHERE session_id = '" + session + "'")).isEqualTo(2);

        // There is nowhere to put an address, a browser or an account.
        List<String> columns = jdbc.sql("""
                SELECT column_name FROM information_schema.columns WHERE table_name = 'learning_event' ORDER BY column_name""")
                .query(String.class).list();
        assertThat(columns).containsExactlyInAnyOrder("id", "received_at", "occurred_at", "session_id", "event_type", "owner_type",
                "owner_slug", "step_key", "class_code", "detail", "payload");
    }

    @Test
    void fieldsThatAreNotListedAreRefusedOutright() {
        Map<String, Object> withEmail = batch(UUID.randomUUID(), null, List.of(ev("legend_toggle", "shown", true)));
        withEmail.put("email", "student@school.az");
        assertThat(post(withEmail).getStatusCode().value()).isEqualTo(400);
        ResponseEntity<JsonNode> withName = post(batch(UUID.randomUUID(), null, List.of(ev("legend_toggle", "shown", true,
                "studentName", "Əli"))));
        assertThat(withName.getStatusCode().value()).isEqualTo(400);
        assertThat(withName.getBody().path("detail").asString()).contains("studentName");
        assertThat(count("SELECT count(*) FROM learning_event")).isZero();
    }

    @Test
    void aBatchIsCheckedEventByEvent() {
        ResponseEntity<JsonNode> res = post(batch(UUID.randomUUID(), "ZZZZZZ", List.of(
                ev("legend_toggle", "shown", true),
                ev("quiz_answered", "ownerType", "person", "ownerSlug", "shah-ismayil"),
                ev("time_slider_used", "year", 1501))));
        assertThat(res.getBody().path("accepted").asInt()).isEqualTo(2);
        assertThat(res.getBody().path("rejected")).hasSize(1);
        assertThat(res.getBody().path("rejected").get(0).path("index").asInt()).isEqualTo(1);
        // An unknown class code is dropped; the events still count.
        assertThat(res.getBody().path("classCode").asBoolean()).isFalse();
        assertThat(count("SELECT count(*) FROM learning_event WHERE class_code IS NOT NULL")).isZero();

        assertThat(post(batch(UUID.randomUUID(), null, List.of())).getStatusCode().value()).isEqualTo(400);
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 0; i < 51; i++) many.add(ev("legend_toggle", "shown", true));
        assertThat(post(batch(UUID.randomUUID(), null, many)).getStatusCode().value()).isEqualTo(400);
        assertThat(post(Map.of("events", List.of(ev("legend_toggle", "shown", true)))).getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void sendBeaconBodiesAndTheSizeLimit() throws Exception {
        String json = JsonMapper.shared().writeValueAsString(batch(UUID.randomUUID(), null, List.of(ev("legend_toggle", "shown", false))));
        ResponseEntity<JsonNode> beacon = http().post().uri(EVENTS).contentType(MediaType.TEXT_PLAIN).body(json).retrieve()
                .toEntity(JsonNode.class);
        assertThat(beacon.getStatusCode().value()).isEqualTo(202);

        String huge = "{\"sessionId\":\"" + UUID.randomUUID() + "\",\"events\":[],\"pad\":\"" + "x".repeat(70_000) + "\"}";
        ResponseEntity<String> tooBig = http().post().uri(EVENTS).contentType(MediaType.APPLICATION_JSON).body(huge).retrieve()
                .toEntity(String.class);
        assertThat(tooBig.getStatusCode().value()).isEqualTo(413);
    }

    @Test
    void aSessionIsLimited() {
        UUID session = UUID.randomUUID();
        List<Map<String, Object>> fifty = new ArrayList<>();
        for (int i = 0; i < 50; i++) fifty.add(ev("legend_toggle", "shown", i % 2 == 0));
        int accepted = 0;
        ResponseEntity<JsonNode> last = null;
        for (int i = 0; i < 13; i++) {
            last = post(batch(session, null, fifty));
            if (last.getStatusCode().value() == 202) accepted++;
        }
        assertThat(accepted).isEqualTo(12);      // 600 events per session in 10 minutes
        assertThat(last.getStatusCode().value()).isEqualTo(429);
        assertThat(last.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isNotBlank();
        // Another session from the same address is not affected.
        assertThat(post(batch(UUID.randomUUID(), null, fifty)).getStatusCode().value()).isEqualTo(202);
    }

    // --- totals and reports --------------------------------------------------------------

    /** Ten sessions of one class answer the same question; three of them get it wrong, two give up there. */
    void classActivity(String code) {
        Instant at = Instant.now().minus(1, ChronoUnit.HOURS);
        for (int i = 0; i < 10; i++) {
            UUID s = UUID.randomUUID();
            List<Map<String, Object>> events = new ArrayList<>();
            events.add(ev("simulation_started", "occurredAt", at.toString(), "ownerType", "person", "ownerSlug", "shah-ismayil"));
            events.add(onStep("step_viewed", "ismayil-chaldiran", "occurredAt", at.toString()));
            events.add(onStep("quiz_answered", "ismayil-chaldiran", "occurredAt", at.toString(), "questionIndex", 0, "correct", i >= 3));
            if (i < 2) {
                events.add(onStep("simulation_abandoned", "ismayil-chaldiran", "occurredAt", at.toString()));
            } else {
                events.add(ev("simulation_completed", "occurredAt", at.toString(), "ownerType", "person", "ownerSlug", "shah-ismayil"));
            }
            assertThat(post(batch(s, code.toLowerCase(), events)).getBody().path("accepted").asInt()).isEqualTo(events.size());
        }
    }

    String range() {
        LocalDate today = LocalDate.now(BAKU);
        return "from=" + today.minusDays(2) + "&to=" + today.plusDays(1);
    }

    @Test
    void dailyTotalsFeedTheReports() {
        String code = classOf("teacher", "K7MQ2X");
        classActivity(code);
        assertThat(count("SELECT count(*) FROM learning_event WHERE class_code = 'K7MQ2X'")).isEqualTo(40);

        ResponseEntity<JsonNode> agg = call("admin", HttpMethod.POST, "/api/v1/admin/analytics/aggregate?" + range());
        assertThat(agg.getStatusCode().value()).as(String.valueOf(agg.getBody())).isEqualTo(200);
        long rows = count("SELECT count(*) FROM daily_aggregate");
        assertThat(rows).isPositive();
        // Recomputing changes nothing.
        call("admin", HttpMethod.POST, "/api/v1/admin/analytics/aggregate?" + range());
        assertThat(count("SELECT count(*) FROM daily_aggregate")).isEqualTo(rows);
        assertThat(count("SELECT sum(count) FROM daily_aggregate WHERE event_type = 'quiz_answered'")).isEqualTo(10);

        JsonNode quiz = call("admin", HttpMethod.GET, "/api/v1/analytics/quiz-difficulty?" + range()).getBody();
        assertThat(quiz).hasSize(1);
        assertThat(quiz.get(0).path("stepKey").asString()).isEqualTo("ismayil-chaldiran");
        assertThat(quiz.get(0).path("answers").asLong()).isEqualTo(10);
        assertThat(quiz.get(0).path("wrong").asLong()).isEqualTo(3);
        assertThat(quiz.get(0).path("wrongRate").asDouble()).isEqualTo(0.3);
        assertThat(call("admin", HttpMethod.GET, "/api/v1/analytics/quiz-difficulty?minAnswers=11&" + range()).getBody()).isEmpty();

        JsonNode drop = call("admin", HttpMethod.GET, "/api/v1/analytics/drop-off?owner=person:shah-ismayil&" + range()).getBody();
        assertThat(drop.path("started").asLong()).isEqualTo(10);
        assertThat(drop.path("completed").asLong()).isEqualTo(8);
        assertThat(drop.path("steps").get(0).path("stepKey").asString()).isEqualTo("ismayil-chaldiran");
        assertThat(drop.path("steps").get(0).path("abandoned").asLong()).isEqualTo(2);
        assertThat(drop.path("steps").get(0).path("abandonRate").asDouble()).isEqualTo(0.2);
        assertThat(call("admin", HttpMethod.GET, "/api/v1/analytics/drop-off?owner=battle:x").getStatusCode().value()).isEqualTo(400);

        ResponseEntity<JsonNode> mine = call("teacher", HttpMethod.GET, "/api/v1/analytics/classes/k7mq2x?" + range());
        assertThat(mine.getStatusCode().value()).isEqualTo(200);
        assertThat(mine.getBody().path("code").asString()).isEqualTo("K7MQ2X");
        assertThat(mine.getBody().path("simulations").get(0).path("started").asLong()).isEqualTo(10);
        assertThat(mine.getBody().path("quizzes").get(0).path("wrong").asLong()).isEqualTo(3);
        assertThat(mine.getBody().path("abandoned").get(0).path("abandoned").asLong()).isEqualTo(2);
        // Nothing in a class report could name or single out a student.
        assertThat(mine.getBody().toString()).doesNotContain("session", "sessionId");
    }

    @Test
    void aTeacherCannotSeeAnotherTeachersClass() {
        String code = classOf("teacher", "K7MQ2X");
        classActivity(code);
        call("admin", HttpMethod.POST, "/api/v1/admin/analytics/aggregate?" + range());
        ResponseEntity<JsonNode> other = call("other", HttpMethod.GET, "/api/v1/analytics/classes/" + code + "?" + range());
        assertThat(other.getStatusCode().value()).isEqualTo(404);
        assertThat(call("other", HttpMethod.GET, "/api/v1/analytics/classes/NOPE22").getStatusCode().value()).isEqualTo(404);
        assertThat(call("admin", HttpMethod.GET, "/api/v1/analytics/classes/" + code).getStatusCode().value()).isEqualTo(403);
    }
}
