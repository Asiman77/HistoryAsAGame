package az.tarix.platform;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.publishing.internal.Projector;
import az.tarix.platform.shared.read.PublicCache;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/**
 * The geo and chronology queries of the public API (BACKEND_SPEC.md §10.1, §10.3, phase 9)
 * against today's whole data/ folder: {@code /territories}, {@code /polities/at},
 * {@code /polities/{slug}/ruler}, {@code /timeline}, {@code /on-this-day},
 * {@code /places/{slug}/timeline}, {@code /compare}, {@code /search}. That the answers equal
 * the frontend's for every place, day and slider year is checked by
 * {@code scripts/parity-history-queries.ts}; these tests pin the rules and the edge cases.
 */
@IntegrationTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class HistoryQueriesTests {

    static final String DOMAIN = "history-queries.test";

    @LocalServerPort
    int port;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    Projector projector;

    @Autowired
    PublicCache cache;

    RestClient http;

    @BeforeAll
    void publishTodaysData() {
        http = RestClient.builder().baseUrl("http://localhost:" + port).defaultStatusHandler(s -> true, (q, r) -> {}).build();
        PublishedData.publishAll(jdbc, projector, DOMAIN);
    }

    @AfterAll
    void cleanUp() {
        PublishedData.remove(jdbc, DOMAIN);
    }

    ResponseEntity<JsonNode> get(String path) {
        return get(path, h -> {});
    }

    ResponseEntity<JsonNode> get(String path, Consumer<HttpHeaders> headers) {
        return http.get().uri(path).headers(headers).retrieve().toEntity(JsonNode.class);
    }

    JsonNode ok(String path) {
        ResponseEntity<JsonNode> res = get(path);
        assertThat(res.getStatusCode()).as(path).isEqualTo(HttpStatus.OK);
        return res.getBody();
    }

    void badRequest(String path, String parameter) {
        ResponseEntity<JsonNode> res = get(path);
        assertThat(res.getStatusCode()).as(path).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody().path("parameter").asString()).as(path).isEqualTo(parameter);
    }

    static List<JsonNode> list(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false).toList();
    }

    /** The {@code field} of every element, or the elements themselves when {@code field} is null. */
    static List<String> strings(JsonNode array, String field) {
        return list(array).stream().map(n -> (field == null ? n : n.path(field)).asString(null)).toList();
    }

    // --- territories -----------------------------------------------------------------------

    @Test
    void theMapOfAYearIsGeoJson() {
        ResponseEntity<JsonNode> res = get("/api/v1/territories?year=1510");
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getHeaders().getContentType().toString()).startsWith("application/geo+json");
        assertThat(res.getHeaders().getETag()).startsWith("W/\"cv-");
        JsonNode map = res.getBody();
        assertThat(map.path("type").asString()).isEqualTo("FeatureCollection");
        assertThat(map.path("covered").asBoolean()).isTrue();
        assertThat(map.path("snapshot").path("slug").asString()).isEqualTo("y1508");
        assertThat(map.path("snapshot").path("validToYear").asInt()).isEqualTo(1511);
        JsonNode safavid = list(map.path("features")).stream().filter(f -> f.path("id").asString().equals("safavid")).findFirst()
                .orElseThrow();
        assertThat(safavid.path("type").asString()).isEqualTo("Feature");
        assertThat(safavid.path("geometry").path("type").asString()).isEqualTo("MultiPolygon");
        assertThat(safavid.path("properties").path("name").asString()).isEqualTo("Səfəvi dövləti");
        assertThat(safavid.path("properties").path("capital").asString()).isEqualTo("tebriz");
        assertThat(safavid.path("properties").path("labelAt").size()).isEqualTo(2);
        assertThat(safavid.path("properties").path("areaKm2").asDouble()).isGreaterThan(1_000_000);
    }

    @Test
    void theSimplifiedMapIsTheDefaultAndSmaller() {
        String simplified = ok("/api/v1/territories?year=1510").toString();
        String full = ok("/api/v1/territories?year=1510&simplified=false").toString();
        assertThat(ok("/api/v1/territories?year=1510&simplified=true").toString()).isEqualTo(simplified);
        assertThat(simplified.length()).isLessThan(full.length());
    }

    @Test
    void aSnapshotReachesThirtyYearsAndAGapOffersTheNearestMap() {
        // y1520 is the latest map before 1700: it covers 1520–1550 only.
        assertThat(ok("/api/v1/territories?year=1550").path("covered").asBoolean()).isTrue();
        JsonNode gap = ok("/api/v1/territories?year=1650");
        assertThat(gap.path("covered").asBoolean()).isFalse();
        assertThat(gap.path("snapshot").path("slug").asString()).isEqualTo("y1700");
        assertThat(gap.path("prevYear").asInt()).isEqualTo(1550);
        assertThat(gap.path("nextYear").asInt()).isEqualTo(1700);
        assertThat(gap.path("features").size()).isPositive();

        JsonNode before = ok("/api/v1/territories?year=1300");
        assertThat(before.path("covered").asBoolean()).isFalse();
        assertThat(before.path("snapshot").path("slug").asString()).isEqualTo("y1440");
        assertThat(before.path("prevYear").isNull()).isTrue();
        assertThat(before.path("nextYear").asInt()).isEqualTo(1440);
    }

    @Test
    void theMapNeedsAYear() {
        badRequest("/api/v1/territories", "year");
        badRequest("/api/v1/territories?year=99999", "year");
        assertThat(get("/api/v1/territories?year=x").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // --- polities at a point ---------------------------------------------------------------

    @Test
    void aPointLiesInThePolityThatHeldItThatYear() {
        JsonNode tabriz1470 = ok("/api/v1/polities/at?lat=38.08&lng=46.2919&year=1470");
        assertThat(strings(tabriz1470.path("polities"), "slug")).containsExactly("agqoyunlu");
        JsonNode tabriz1510 = ok("/api/v1/polities/at?lat=38.08&lng=46.2919&year=1510");
        assertThat(tabriz1510.path("covered").asBoolean()).isTrue();
        assertThat(tabriz1510.path("snapshot").asString()).isEqualTo("y1508");
        JsonNode safavid = tabriz1510.path("polities").get(0);
        assertThat(safavid.path("slug").asString()).isEqualTo("safavid");
        assertThat(safavid.path("capital").asString()).isEqualTo("tebriz");
        assertThat(safavid.path("available").asBoolean()).isTrue();

        JsonNode uncovered = ok("/api/v1/polities/at?lat=38.08&lng=46.2919&year=1650");
        assertThat(uncovered.path("covered").asBoolean()).isFalse();
        assertThat(uncovered.path("polities").size()).isZero();
        // The open sea belongs to nobody.
        assertThat(ok("/api/v1/polities/at?lat=0&lng=-30&year=1510").path("polities").size()).isZero();
    }

    @Test
    void overlappingAreasAllHoldThePoint() {
        jdbc.sql("""
                INSERT INTO polity_territory (snapshot_id, polity_slug, name, color, geometry, label_at, certainty, sort_order)
                SELECT id, 'disputed-test', '{"az": "Mübahisəli"}', '#000000',
                       ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint(46.2919, 38.08), 4326), 0.5)),
                       ST_SetSRID(ST_MakePoint(46.2919, 38.08), 4326), 'DISPUTED', 99
                FROM territory_snapshot WHERE slug = 'y1508'""").update();
        bumpContentVersion();
        try {
            JsonNode at = ok("/api/v1/polities/at?lat=38.08&lng=46.2919&year=1510");
            assertThat(strings(at.path("polities"), "slug")).containsExactly("safavid", "disputed-test");
            assertThat(at.path("polities").get(1).path("certainty").asString()).isEqualTo("DISPUTED");
            assertThat(at.path("polities").get(1).path("available").asBoolean()).isFalse();
        } finally {
            jdbc.sql("DELETE FROM polity_territory WHERE polity_slug = 'disputed-test'").update();
            bumpContentVersion();
        }
    }

    @Test
    void aPointNeedsValidCoordinates() {
        badRequest("/api/v1/polities/at?lng=46&year=1510", "lat");
        badRequest("/api/v1/polities/at?lat=91&lng=46&year=1510", "lat");
        badRequest("/api/v1/polities/at?lat=38&lng=181&year=1510", "lng");
        badRequest("/api/v1/polities/at?lat=38&lng=46", "year");
    }

    // --- ruler panel -----------------------------------------------------------------------

    @Test
    void theRulerPanelShowsWhoRuledThatYear() {
        JsonNode safavid = ok("/api/v1/polities/safavid/ruler?year=1514");
        assertThat(safavid.path("polity").path("slug").asString()).isEqualTo("safavid");
        assertThat(safavid.path("exists").asBoolean()).isTrue();
        assertThat(strings(safavid.path("rulers"), "slug")).containsExactly("ismail-i");
        JsonNode ismail = safavid.path("rulers").get(0);
        assertThat(ismail.path("personSlug").asString()).isEqualTo("shah-ismayil");
        assertThat(ismail.path("personAvailable").asBoolean()).isTrue();
        assertThat(ismail.path("reignStart").path("year").asInt()).isEqualTo(1501);
        assertThat(ismail.path("reignEnd").path("year").asInt()).isEqualTo(1524);

        // Power changed hands in 1512: both sultans ruled that year.
        assertThat(strings(ok("/api/v1/polities/ottoman/ruler?year=1512").path("rulers"), "slug"))
                .containsExactly("bayezid-ii", "selim-i");

        JsonNode before = ok("/api/v1/polities/safavid/ruler?year=1400");
        assertThat(before.path("exists").asBoolean()).isFalse();
        assertThat(before.path("rulers").size()).isZero();
    }

    @Test
    void aReignOfAnUnpublishedRulerIsStillShownAndAnOpenOneHasNoEnd() {
        jdbc.sql("""
                INSERT INTO reign (polity_id, ruler_slug, start_year, end_year, certainty, sort_order)
                SELECT id, 'ghost-sultan', 1512, NULL, 'DISPUTED', 99 FROM polity WHERE slug = 'ottoman'""").update();
        bumpContentVersion();
        try {
            JsonNode panel = ok("/api/v1/polities/ottoman/ruler?year=1512");
            assertThat(strings(panel.path("rulers"), "slug")).containsExactly("bayezid-ii", "selim-i", "ghost-sultan");
            JsonNode ghost = panel.path("rulers").get(2);
            assertThat(ghost.path("available").asBoolean()).isFalse();
            assertThat(ghost.path("name").isNull()).isTrue();
            assertThat(ghost.path("reignEnd").isNull()).isTrue();
            assertThat(panel.path("rulers").get(0).path("available").asBoolean()).isTrue();
            // Open-ended: it still runs in 1900, and the slider shows it as a passive link.
            JsonNode later = ok("/api/v1/timeline?year=1900");
            JsonNode reign = list(later.path("rulers")).stream()
                    .filter(r -> r.path("ruler").path("slug").asString().equals("ghost-sultan")).findFirst().orElseThrow();
            assertThat(reign.path("ruler").path("available").asBoolean()).isFalse();
            assertThat(reign.path("endYear").isNull()).isTrue();
        } finally {
            jdbc.sql("DELETE FROM reign WHERE ruler_slug = 'ghost-sultan'").update();
            bumpContentVersion();
        }
    }

    @Test
    void theRulerPanelNeedsAKnownPolityAndAYear() {
        assertThat(get("/api/v1/polities/nowhere/ruler?year=1500").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        badRequest("/api/v1/polities/safavid/ruler", "year");
        // The literal path wins over the polity slug pattern.
        assertThat(get("/api/v1/polities/at?lat=38&lng=46&year=1510").getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // --- timeline --------------------------------------------------------------------------

    @Test
    void aYearOfTheSliderHasItsMapRulersPersonsAndEvents() {
        JsonNode y = ok("/api/v1/timeline?year=1514");
        assertThat(y.path("coverage").asString()).isEqualTo("FULL");
        assertThat(y.path("era").path("slug").asString()).isEqualTo("sefevi");
        assertThat(y.path("themeSlug").asString()).isEqualTo("sefevi");
        assertThat(y.path("map").path("snapshot").asString()).isEqualTo("y1512");
        assertThat(strings(y.path("capitals"), "place")).contains("tebriz", "istanbul");
        assertThat(list(y.path("rulers")).stream().map(r -> r.path("ruler").path("slug").asString())).contains("ismail-i", "selim-i");

        JsonNode ismayil = list(y.path("persons")).stream().filter(p -> p.path("slug").asString().equals("shah-ismayil"))
                .findFirst().orElseThrow();
        assertThat(ismayil.path("age").asInt()).isEqualTo(27);
        assertThat(ismayil.path("ageApproximate").asBoolean()).isFalse();
        // Where his last step up to 1514 placed him: Çaldıran.
        assertThat(ismayil.path("lat").asDouble()).isEqualTo(39.07);

        JsonNode chaldiran = list(y.path("events")).stream()
                .filter(e -> e.path("key").asString().equals("person:shah-ismayil:ismayil-chaldiran")).findFirst().orElseThrow();
        assertThat(chaldiran.path("category").asString()).isEqualTo("PERSON");
        assertThat(chaldiran.path("location").path("placeSlug").asString()).isEqualTo("chaldiran");
        assertThat(chaldiran.path("date").path("day").asInt()).isEqualTo(23);
        assertThat(chaldiran.path("eraSlug").asString()).isEqualTo("sefevi");
    }

    @Test
    void anEmptyYearSaysSoAndPointsToTheNearestYearsWithEvents() {
        JsonNode y = ok("/api/v1/timeline?year=1300");
        assertThat(y.path("coverage").asString()).isEqualTo("NONE");
        assertThat(y.path("era").isNull()).isTrue();
        assertThat(y.path("themeSlug").asString()).isEqualTo("default");
        assertThat(y.path("events").size()).isZero();
        assertThat(y.path("nearestEventYears").path("prev").isNull()).isTrue();
        assertThat(y.path("nearestEventYears").path("next").asInt()).isEqualTo(1425);

        // No map reaches 1690, but Nadir (born 1688) is alive.
        JsonNode partial = ok("/api/v1/timeline?year=1690");
        assertThat(partial.path("map").path("covered").asBoolean()).isFalse();
        assertThat(strings(partial.path("persons"), "slug")).contains("nadir-shah");
        assertThat(partial.path("coverage").asString()).isEqualTo("PARTIAL");
    }

    @Test
    void theTimelineTakesTheSameNumberOfQueriesWhateverTheYear() {
        cache.clear();
        long busy = QueryCounter.during(() -> ok("/api/v1/timeline?year=1736"));
        long quiet = QueryCounter.during(() -> ok("/api/v1/timeline?year=1300"));
        assertThat(busy).isLessThanOrEqualTo(14);
        assertThat(quiet).isLessThanOrEqualTo(busy);
        assertThat(QueryCounter.during(() -> ok("/api/v1/timeline?year=1736"))).isEqualTo(1);
    }

    // --- on this day -----------------------------------------------------------------------

    @Test
    void onThisDayListsTheEventsOfTheDayAndMarksSpecialDates() {
        JsonNode victory = ok("/api/v1/on-this-day?month=11&day=8");
        assertThat(victory.path("mode").asString()).isEqualTo("DAY");
        assertThat(victory.path("commemoration").path("slug").asString()).isEqualTo("zefer-gunu");
        assertThat(victory.path("commemoration").path("ref").path("slug").asString()).isEqualTo("karabakh-war-2020");
        assertThat(victory.path("commemoration").path("ref").path("available").asBoolean()).isTrue();
        assertThat(strings(victory.path("events"), "key")).contains("conflict:karabakh-war-2020:2020-11-08");
        assertThat(list(victory.path("events"))).allSatisfy(e -> {
            assertThat(e.path("date").path("month").asInt()).isEqualTo(11);
            assertThat(e.path("date").path("day").asInt()).isEqualTo(8);
        });
    }

    @Test
    void anEmptyDayFallsBackToItsMonth() {
        JsonNode leap = ok("/api/v1/on-this-day?month=2&day=29");
        assertThat(leap.path("mode").asString()).isEqualTo("MONTH");
        List<JsonNode> events = list(leap.path("events"));
        assertThat(events).isNotEmpty().allSatisfy(e -> assertThat(e.path("date").path("month").asInt()).isEqualTo(2));
        // By day, month-only dates last.
        List<Integer> days = events.stream().map(e -> e.path("date").path("day").isNull() ? 99 : e.path("date").path("day").asInt())
                .toList();
        assertThat(days).isSorted();
    }

    @Test
    void onThisDayNeedsARealDay() {
        badRequest("/api/v1/on-this-day?day=8", "month");
        badRequest("/api/v1/on-this-day?month=11", "day");
        badRequest("/api/v1/on-this-day?month=13&day=1", "month");
        badRequest("/api/v1/on-this-day?month=2&day=30", "day");
        badRequest("/api/v1/on-this-day?month=4&day=31", "day");
    }

    // --- place timeline --------------------------------------------------------------------

    @Test
    void aPlaceHasItsEventsAndWhoHeldIt() {
        JsonNode tabriz = ok("/api/v1/places/tebriz/timeline");
        assertThat(tabriz.path("place").path("historicalName").asString()).isEqualTo("Təbriz");
        List<String> keys = strings(tabriz.path("events"), "key");
        assertThat(keys).contains("person:uzun-hasan:uzun-hasan-tabriz", "person:shah-ismayil:ismayil-coronation");
        assertThat(list(tabriz.path("events"))).allSatisfy(e -> assertThat(e.path("location").path("placeSlug").asString())
                .isEqualTo("tebriz"));
        List<Integer> years = list(tabriz.path("events")).stream().map(e -> e.path("date").path("year").asInt()).toList();
        assertThat(years).isSorted();

        JsonNode first = tabriz.path("membership").get(0);
        assertThat(first.path("kind").asString()).isEqualTo("POLITY");
        assertThat(first.path("polity").asString()).isEqualTo("qaraqoyunlu");
        assertThat(first.path("capital").asBoolean()).isTrue();
        assertThat(strings(tabriz.path("membership"), "kind")).contains("GAP");
    }

    @Test
    void aWarDayBelongsToThePlaceOfTheSameName() {
        JsonNode shusha = ok("/api/v1/places/shusha/timeline");
        assertThat(strings(shusha.path("events"), "key")).contains("conflict:karabakh-war-2020:2020-11-08");
        // Şuşa was founded in 1752: no span before it.
        assertThat(shusha.path("membership").get(0).path("fromYear").asInt()).isEqualTo(1752);
    }

    @Test
    void anUnknownPlaceIsNotFound() {
        ResponseEntity<JsonNode> res = get("/api/v1/places/nowhere/timeline");
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(res.getHeaders().getContentType().toString()).startsWith("application/problem+json");
    }

    // --- compare ---------------------------------------------------------------------------

    @Test
    void twoSimulationsMeetAtTheSamePlaceOrBattle() {
        JsonNode c = ok("/api/v1/compare?a=person:nadir-shah&b=state:afshar");
        assertThat(c.path("a").path("slug").asString()).isEqualTo("nadir-shah");
        assertThat(c.path("a").path("name").asString()).isEqualTo("Nadir Şah Əfşar");
        assertThat(c.path("b").path("type").asString()).isEqualTo("STATE");
        assertThat(c.path("a").path("events").size()).isPositive();
        assertThat(c.path("overlap").path("fromYear").asInt()).isLessThanOrEqualTo(c.path("overlap").path("toYear").asInt());

        JsonNode kandahar = list(c.path("intersections")).stream()
                .filter(i -> i.path("a").asString().equals("nadir-kandahar")).findFirst().orElseThrow();
        assertThat(strings(kandahar.path("reasons"), null)).containsExactly("PLACE", "BATTLE");
        assertThat(kandahar.path("battle").path("type").asString()).isEqualTo("BATTLE");
        assertThat(kandahar.path("distanceKm").asDouble()).isLessThanOrEqualTo(25);

        // Steps carry the battles they refer to.
        JsonNode karnal = list(c.path("a").path("events")).stream()
                .filter(e -> e.path("stepKey").asString().equals("nadir-karnal")).findFirst().orElseThrow();
        assertThat(karnal.path("battles").size()).isPositive();
        assertThat(karnal.path("key").asString()).isEqualTo("person:nadir-shah:nadir-karnal");
    }

    @Test
    void livesThatNeverOverlapDoNotMeet() {
        // Uzun Həsən died in 1478, his grandson Şah İsmayıl was born in 1487.
        JsonNode c = ok("/api/v1/compare?a=person:uzun-hasan&b=person:shah-ismayil");
        assertThat(c.path("overlap").isNull()).isTrue();
        assertThat(c.path("intersections").size()).isZero();
        assertThat(c.path("a").path("toYear").asInt()).isLessThan(c.path("b").path("fromYear").asInt());
    }

    @Test
    void compareNeedsTwoDifferentPublishedSimulations() {
        badRequest("/api/v1/compare?b=person:shah-ismayil", "a");
        badRequest("/api/v1/compare?a=shah-ismayil&b=person:nadir-shah", "a");
        badRequest("/api/v1/compare?a=place:tebriz&b=person:nadir-shah", "a");
        badRequest("/api/v1/compare?a=person:nadir-shah&b=person:nadir-shah", "b");
        assertThat(get("/api/v1/compare?a=person:nobody&b=person:nadir-shah").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // --- search ----------------------------------------------------------------------------

    @Test
    void searchIgnoresAzerbaijaniLettersAndCase() {
        JsonNode r = ok("/api/v1/search?q=seh ismayil");
        assertThat(r.path("items").get(0).path("type").asString()).isEqualTo("PERSON");
        assertThat(r.path("items").get(0).path("slug").asString()).isEqualTo("shah-ismayil");
        assertThat(r.path("items").get(0).path("fromYear").asInt()).isEqualTo(1487);

        assertThat(ok("/api/v1/search?q=CALDIRAN").path("items").get(0).path("slug").asString()).isEqualTo("chaldiran");
        assertThat(strings(ok("/api/v1/search?q=tebriz").path("items"), "type")).contains("PLACE", "POLITY");
    }

    @Test
    void searchCanBeLimitedToTypes() {
        JsonNode r = ok("/api/v1/search?q=nadir&types=ruler,person&limit=5");
        assertThat(strings(r.path("items"), "type")).containsOnly("PERSON", "RULER");
        assertThat(strings(r.path("types"), null)).hasSize(2);
        assertThat(ok("/api/v1/search?q=nadir&limit=1").path("items").size()).isEqualTo(1);
        assertThat(ok("/api/v1/search?q=zzzqqq").path("items").size()).isZero();
    }

    @Test
    void searchChecksItsParameters() {
        badRequest("/api/v1/search", "q");
        badRequest("/api/v1/search?q=a", "q");
        badRequest("/api/v1/search?q=nadir&types=foo", "types");
        badRequest("/api/v1/search?q=nadir&types=SOURCE", "types");
        badRequest("/api/v1/search?q=nadir&limit=51", "limit");
    }

    // --- shared behaviour ------------------------------------------------------------------

    @Test
    void newEndpointsRevalidateWith304() {
        for (String path : List.of("/api/v1/territories?year=1510", "/api/v1/timeline?year=1514", "/api/v1/on-this-day?month=11&day=8",
                "/api/v1/places/tebriz/timeline", "/api/v1/compare?a=person:nadir-shah&b=state:afshar", "/api/v1/search?q=nadir",
                "/api/v1/polities/safavid/ruler?year=1514", "/api/v1/polities/at?lat=38&lng=46&year=1510")) {
            String etag = get(path).getHeaders().getETag();
            assertThat(etag).as(path).isNotNull();
            assertThat(get(path, h -> h.setIfNoneMatch(etag)).getStatusCode()).as(path).isEqualTo(HttpStatus.NOT_MODIFIED);
        }
    }

    @Test
    void theLanguageAppliesToTheNewEndpoints() {
        JsonNode en = ok("/api/v1/timeline?year=1514&lang=en");
        assertThat(en.path("era").path("name").isString()).isTrue();
        JsonNode all = ok("/api/v1/places/tebriz/timeline?lang=all");
        assertThat(all.path("place").path("historicalName").path("az").asString()).isEqualTo("Təbriz");
    }

    @Test
    void openApiDescribesTheNewEndpoints() {
        JsonNode paths = ok("/v3/api-docs/public").path("paths");
        for (String p : List.of("/api/v1/territories", "/api/v1/polities/at", "/api/v1/polities/{slug}/ruler", "/api/v1/timeline",
                "/api/v1/on-this-day", "/api/v1/places/{slug}/timeline", "/api/v1/compare", "/api/v1/search")) {
            assertThat(paths.has(p)).as(p).isTrue();
        }
    }

    void bumpContentVersion() {
        jdbc.sql("UPDATE content_version SET value = value + 1 WHERE id = 1").update();
    }
}
