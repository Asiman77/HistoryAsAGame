package az.tarix.platform;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.editorial.DataDocuments.Doc;
import az.tarix.platform.publishing.internal.Projector;
import az.tarix.platform.shared.read.PublicCache;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
 * The public read API (BACKEND_SPEC.md §10) against today's whole data/ folder, published and
 * projected once for the class: endpoints, languages, ETag / 304, caching, Problem Details,
 * renamed slugs, the media permission filter and the number of SQL statements per request.
 */
@IntegrationTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PublicApiTests {

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
        UUID owner = jdbc.sql("INSERT INTO app_user (email, display_name) VALUES ('owner@public-api.test', 'owner') RETURNING id")
                .query(UUID.class).single();
        for (Doc d : DataDocuments.all()) seedPublished(d, owner);
        assertThat(projector.rebuild().deferred()).isEmpty();
    }

    @AfterAll
    void cleanUp() {
        TestDatabase.clearContent(jdbc);
        jdbc.sql("DELETE FROM app_user WHERE email LIKE '%@public-api.test'").update();
    }

    void seedPublished(Doc d, UUID owner) {
        UUID doc = jdbc.sql("""
                INSERT INTO editorial_document (doc_type, slug, status, created_by, created_at, updated_at)
                VALUES (:type, :slug, 'PUBLISHED', :owner, now(), now()) RETURNING id""")
                .param("type", d.type().name()).param("slug", d.slug()).param("owner", owner).query(UUID.class).single();
        UUID rev = jdbc.sql("""
                INSERT INTO editorial_revision (document_id, revision_no, schema_version, content, content_hash, author_id, created_at)
                VALUES (:doc, 1, 1, CAST(:content AS jsonb), sha256(convert_to(:content, 'UTF8')), :owner, now()) RETURNING id""")
                .param("doc", doc).param("content", d.content().toString()).param("owner", owner).query(UUID.class).single();
        jdbc.sql("UPDATE editorial_document SET current_revision_id = :rev, published_revision_id = :rev WHERE id = :doc")
                .param("rev", rev).param("doc", doc).update();
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

    static List<JsonNode> list(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false).toList();
    }

    static JsonNode find(JsonNode array, String field, String value) {
        return list(array).stream().filter(n -> value.equals(n.path(field).asString(null))).findFirst()
                .orElseThrow(() -> new AssertionError("no " + field + "=" + value + " in " + array));
    }

    void bumpContentVersion() {
        jdbc.sql("UPDATE content_version SET value = value + 1 WHERE id = 1").update();
    }

    // --- persons ---------------------------------------------------------------------------

    @Test
    void personCardsComeFeaturedFirstWithTheirPortrait() {
        JsonNode page = ok("/api/v1/persons");
        assertThat(page.path("totalElements").asLong()).isEqualTo(3);
        assertThat(page.path("page").asInt()).isZero();
        assertThat(page.path("size").asInt()).isEqualTo(20);
        assertThat(list(page.path("items")).stream().map(p -> p.path("slug").asString()))
                .containsExactly("uzun-hasan", "shah-ismayil", "nadir-shah");
        JsonNode ismayil = page.path("items").get(1);
        assertThat(ismayil.path("name").asString()).isEqualTo("Şah İsmayıl Xətai");
        assertThat(ismayil.path("birth").path("year").asInt()).isEqualTo(1487);
        assertThat(ismayil.path("birth").path("precision").asString()).isEqualTo("DAY");
        assertThat(ismayil.path("portrait").path("url").asString()).isEqualTo("/portraits/shah-ismayil.jpg");
        assertThat(list(ismayil.path("eraSlugs")).stream().map(JsonNode::asString)).containsExactly("agqoyunlu", "sefevi");
    }

    @Test
    void personListsArePaged() {
        JsonNode second = ok("/api/v1/persons?page=1&size=2");
        assertThat(second.path("items").size()).isEqualTo(1);
        assertThat(second.path("totalElements").asLong()).isEqualTo(3);
        JsonNode past = ok("/api/v1/persons?page=5&size=2");
        assertThat(past.path("items").size()).isZero();
        assertThat(past.path("totalElements").asLong()).isEqualTo(3);

        ResponseEntity<JsonNode> tooBig = get("/api/v1/persons?size=101");
        assertThat(tooBig.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(tooBig.getBody().path("parameter").asString()).isEqualTo("size");
        assertThat(get("/api/v1/persons?page=x").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void aProfileHasBirthPlacePortraitsByAgeAndIncomingLinks() {
        JsonNode p = ok("/api/v1/persons/shah-ismayil");
        assertThat(p.path("birth").path("location").path("slug").asString()).isEqualTo("erdebil");     // nearest place, 0 km
        assertThat(p.path("birth").path("location").path("type").asString()).isEqualTo("SHRINE");
        assertThat(p.path("titles").get(0).asString()).isEqualTo("Səfəvi dövlətinin banisi");
        assertThat(p.path("portraits").size()).isEqualTo(4);
        JsonNode child = p.path("portraits").get(0);
        assertThat(child.path("url").isNull()).isTrue();                                               // placeholder
        assertThat(child.path("disclosure").asString()).isEqualTo("Rəssam təsəvvürü (AI illüstrasiya)");
        assertThat(p.path("portraits").get(3).path("url").asString()).isNotBlank();

        JsonNode grandparent = find(p.path("relations"), "slug", "uzun-hasan");
        assertThat(grandparent.path("direction").asString()).isEqualTo("INCOMING");
        assertThat(grandparent.path("relation").asString()).isEqualTo("GRANDPARENT");
        assertThat(grandparent.path("available").asBoolean()).isTrue();
        assertThat(grandparent.path("name").asString()).isEqualTo("Uzun Həsən");
    }

    @Test
    void lifeStepsComeInOrderWithPlacesClaimsLinksAndPortraits() {
        JsonNode body = ok("/api/v1/persons/shah-ismayil/steps");
        assertThat(body.path("owner").path("type").asString()).isEqualTo("PERSON");
        assertThat(body.path("owner").path("slug").asString()).isEqualTo("shah-ismayil");
        assertThat(body.path("contentVersion").asLong()).isPositive();
        JsonNode steps = body.path("steps");
        assertThat(steps.size()).isEqualTo(17);
        assertThat(list(steps).stream().map(s -> s.path("sequence").asInt()).toList()).isSorted();

        JsonNode birth = steps.get(0);
        assertThat(birth.path("stepKey").asString()).isEqualTo("ismayil-birth");
        assertThat(birth.path("kind").asString()).isEqualTo("LIFE_EVENT");
        assertThat(birth.path("mood").asString()).isEqualTo("BIRTH");
        assertThat(birth.path("claimType").asString()).isEqualTo("FACT");
        assertThat(birth.path("ageAtEvent").asInt()).isZero();
        assertThat(birth.path("title").asString()).isEqualTo("Ərdəbildə doğuluş");
        assertThat(birth.path("location").path("slug").asString()).isEqualTo("erdebil");
        assertThat(birth.path("portrait").path("kind").asString()).isEqualTo("AI_ILLUSTRATION");
        assertThat(birth.path("portrait").path("ageFrom").asInt()).isZero();
        assertThat(birth.path("sources").size()).isEqualTo(2);
        assertThat(birth.path("sources").get(0).path("slug").asString()).startsWith("src-");
        assertThat(birth.path("details").path("eventType").asString()).isEqualTo("birth");
        assertThat(birth.path("details").path("quiz").get(0).path("question").asString())       // localized inside details
                .isEqualTo("İsmayılın ana babası kim idi?");

        JsonNode toGrandfather = birth.path("related").get(0);
        assertThat(toGrandfather.path("type").asString()).isEqualTo("PERSON");
        assertThat(toGrandfather.path("slug").asString()).isEqualTo("uzun-hasan");
        assertThat(toGrandfather.path("stepKey").asString()).isEqualTo("uzun-hasan-despina");
        assertThat(toGrandfather.path("available").asBoolean()).isTrue();

        JsonNode cabani = find(steps, "stepKey", "ismayil-cabani").path("related").get(0);
        assertThat(cabani.path("type").asString()).isEqualTo("BATTLE");
        assertThat(cabani.path("available").asBoolean()).isFalse();                                  // future content
        assertThat(cabani.path("name").asString()).isEqualTo("Cabanı döyüşü (1500)");

        JsonNode legend = find(find(steps, "stepKey", "ismayil-flight-gilan").path("claims"), "claimKey", "ismayil-basket-oath");
        assertThat(legend.path("claimType").asString()).isEqualTo("LEGEND");
        assertThat(legend.path("why").asString()).isNotBlank();
        assertThat(legend.path("versions").size()).isEqualTo(2);
        assertThat(legend.path("firstRecorded").path("source").path("title").asString()).isNotBlank();
        assertThat(legend.path("sources").size()).isEqualTo(2);
    }

    @Test
    void aSingleStepCanBeLinkedTo() {
        JsonNode step = ok("/api/v1/persons/shah-ismayil/steps/ismayil-chaldiran");
        assertThat(step.path("stepKey").asString()).isEqualTo("ismayil-chaldiran");
        assertThat(step.path("date").path("year").asInt()).isEqualTo(1514);

        ResponseEntity<JsonNode> noStep = get("/api/v1/persons/shah-ismayil/steps/nope");
        assertThat(noStep.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/api/v1/persons/nobody/steps").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // --- languages -------------------------------------------------------------------------

    @Test
    void theLanguageComesFromTheParameterOrTheHeaderAndFallsBackToAzerbaijani() {
        assertThat(ok("/api/v1/persons/shah-ismayil?lang=en").path("name").asString()).isEqualTo("Shah Ismail I (Khata'i)");
        ResponseEntity<JsonNode> header = get("/api/v1/persons/shah-ismayil", h -> h.set(HttpHeaders.ACCEPT_LANGUAGE, "en-GB,en;q=0.8"));
        assertThat(header.getBody().path("name").asString()).isEqualTo("Shah Ismail I (Khata'i)");
        assertThat(header.getHeaders().getFirst(HttpHeaders.CONTENT_LANGUAGE)).isEqualTo("en");
        // No Russian text: Azerbaijani.
        assertThat(ok("/api/v1/persons/shah-ismayil?lang=ru").path("shortBio").asString())
                .isEqualTo(ok("/api/v1/persons/shah-ismayil").path("shortBio").asString());

        JsonNode all = ok("/api/v1/persons/shah-ismayil?lang=all");
        assertThat(all.path("name").path("az").asString()).isEqualTo("Şah İsmayıl Xətai");
        assertThat(all.path("name").path("en").asString()).isEqualTo("Shah Ismail I (Khata'i)");

        ResponseEntity<JsonNode> unknown = get("/api/v1/persons/shah-ismayil?lang=xx");
        assertThat(unknown.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(unknown.getBody().path("parameter").asString()).isEqualTo("lang");
    }

    // --- caching ---------------------------------------------------------------------------

    @Test
    void responsesCarryTheContentVersionAndRevalidateWith304() {
        ResponseEntity<JsonNode> first = get("/api/v1/eras");
        long version = jdbc.sql("SELECT value FROM content_version").query(Long.class).single();
        String etag = first.getHeaders().getETag();
        assertThat(etag).isEqualTo("W/\"cv-" + version + "-az\"");
        assertThat(first.getHeaders().getCacheControl()).isEqualTo("max-age=300, public, stale-while-revalidate=86400");
        assertThat(first.getHeaders().getVary()).contains(HttpHeaders.ACCEPT_LANGUAGE);

        ResponseEntity<JsonNode> again = get("/api/v1/eras", h -> h.setIfNoneMatch(etag));
        assertThat(again.getStatusCode()).isEqualTo(HttpStatus.NOT_MODIFIED);
        assertThat(again.getBody()).isNull();
        assertThat(again.getHeaders().getETag()).isEqualTo(etag);

        ResponseEntity<JsonNode> otherLanguage = get("/api/v1/eras?lang=en", h -> h.setIfNoneMatch(etag));
        assertThat(otherLanguage.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void aNewContentVersionInvalidatesTheCacheAndTheEtag() {
        String before = ok("/api/v1/states/afshar").path("name").asString();
        String etag = get("/api/v1/states/afshar").getHeaders().getETag();
        jdbc.sql("UPDATE state_profile SET name = jsonb_set(name, '{az}', '\"Dəyişdirilmiş ad\"') WHERE slug = 'afshar'").update();
        try {
            assertThat(ok("/api/v1/states/afshar").path("name").asString()).isEqualTo(before);       // same version: cached
            bumpContentVersion();
            ResponseEntity<JsonNode> after = get("/api/v1/states/afshar", h -> h.setIfNoneMatch(etag));
            assertThat(after.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(after.getBody().path("name").asString()).isEqualTo("Dəyişdirilmiş ad");
            assertThat(after.getHeaders().getETag()).isNotEqualTo(etag);
        } finally {
            jdbc.sql("UPDATE state_profile SET name = jsonb_set(name, '{az}', to_jsonb(CAST(:n AS text))) WHERE slug = 'afshar'")
                    .param("n", before).update();
            bumpContentVersion();
        }
    }

    // --- errors and redirects --------------------------------------------------------------

    @Test
    void errorsAreProblemDetailsAndNeverCached() {
        ResponseEntity<JsonNode> missing = get("/api/v1/conflicts/no-such-war");
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(missing.getHeaders().getContentType().toString()).startsWith("application/problem+json");
        assertThat(missing.getBody().path("type").asString()).isEqualTo("https://tarixin-icinde.az/problems/not-found");
        assertThat(missing.getBody().path("status").asInt()).isEqualTo(404);
        assertThat(missing.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(missing.getHeaders().getETag()).isNull();
    }

    @Test
    void aRenamedSlugRedirectsPermanently() {
        jdbc.sql("INSERT INTO slug_redirect (doc_type, old_slug, new_slug) VALUES ('PERSON', 'shah-ismail', 'shah-ismayil')").update();
        try {
            ResponseEntity<JsonNode> res = get("/api/v1/persons/shah-ismail/steps?lang=en");
            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.MOVED_PERMANENTLY);
            assertThat(res.getHeaders().getLocation()).hasToString("/api/v1/persons/shah-ismayil/steps?lang=en");
            // Only the owning type's slugs are redirected.
            assertThat(get("/api/v1/states/shah-ismail").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        } finally {
            jdbc.sql("DELETE FROM slug_redirect WHERE old_slug = 'shah-ismail'").update();
        }
    }

    // --- media permission ------------------------------------------------------------------

    @Test
    void mediaWithoutPublicPermissionIsNeverReturned() {
        jdbc.sql("UPDATE person SET portrait = jsonb_set(portrait, '{license}', '\"Bütün hüquqlar qorunur\"') WHERE slug = 'nadir-shah'")
                .update();
        jdbc.sql("""
                UPDATE theme SET background_art = jsonb_set(background_art, '{0,license}', '"İcazə gözlənilir"')
                WHERE slug = 'sefevi'""").update();
        bumpContentVersion();
        try {
            JsonNode nadir = find(ok("/api/v1/persons").path("items"), "slug", "nadir-shah");
            assertThat(nadir.path("portrait").isNull()).isTrue();
            assertThat(ok("/api/v1/persons/nadir-shah").path("portrait").isNull()).isTrue();
            assertThat(ok("/api/v1/themes/sefevi").path("backgroundArt").size()).isZero();
        } finally {
            jdbc.sql("UPDATE person SET portrait = jsonb_set(portrait, '{license}', '\"Public domain\"') WHERE slug = 'nadir-shah'")
                    .update();
            jdbc.sql("""
                    UPDATE theme SET background_art = jsonb_set(background_art, '{0,license}', '"CC0 1.0 (Met Open Access)"')
                    WHERE slug = 'sefevi'""").update();
            bumpContentVersion();
        }
    }

    // --- conflicts, battles, heroes ---------------------------------------------------------

    @Test
    void aWarHasItsPeoplePlacesAndDays() {
        JsonNode cards = ok("/api/v1/conflicts");
        assertThat(cards.path("totalElements").asLong()).isEqualTo(1);
        JsonNode card = cards.path("items").get(0);
        assertThat(card.path("start").path("year").asInt()).isEqualTo(2020);
        assertThat(card.path("start").path("month").asInt()).isEqualTo(9);

        JsonNode war = ok("/api/v1/conflicts/karabakh-war-2020");
        assertThat(war.path("heroes").size()).isEqualTo(82);
        assertThat(war.path("settlements").size()).isEqualTo(250);
        assertThat(war.path("commanders").size()).isEqualTo(5);
        assertThat(find(war.path("battles"), "slug", "shusha-2020").path("stepKey").asString()).isEqualTo("2020-11-08");

        JsonNode days = ok("/api/v1/conflicts/karabakh-war-2020/days").path("steps");
        assertThat(days.size()).isEqualTo(29);
        JsonNode shusha = find(days, "stepKey", "2020-11-08");
        assertThat(shusha.path("kind").asString()).isEqualTo("WAR_DAY");
        assertThat(shusha.path("location").path("slug").asString()).isEqualTo("shusha");               // matched by name
        assertThat(shusha.path("ageAtEvent").isNull()).isTrue();
        assertThat(shusha.path("portrait").isNull()).isTrue();
        assertThat(ok("/api/v1/conflicts/karabakh-war-2020/days/2020-10-09").path("details").path("liberated").size()).isEqualTo(9);
    }

    @Test
    void battlesAndHeroes() {
        JsonNode battle = ok("/api/v1/battles/shusha-2020");
        assertThat(battle.path("conflictSlug").asString()).isEqualTo("karabakh-war-2020");
        assertThat(battle.path("name").asString()).isEqualTo("Şuşa əməliyyatı");
        assertThat(battle.path("sources").size()).isPositive();

        JsonNode hero = ok("/api/v1/heroes/mehdiyev-i-lham");
        assertThat(hero.path("fullName").asString()).isEqualTo("Mehdiyev İlham İsmayıl oğlu");
        assertThat(hero.path("posthumous").asBoolean()).isFalse();
        assertThat(hero.path("awards").get(0).isString()).isTrue();
        assertThat(hero.path("photo").isNull()).isTrue();
        assertThat(get("/api/v1/heroes/nobody").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // --- states ----------------------------------------------------------------------------

    @Test
    void aStateSimulation() {
        assertThat(ok("/api/v1/states").path("totalElements").asLong()).isEqualTo(1);
        JsonNode state = ok("/api/v1/states/afshar");
        assertThat(state.path("politySlug").asString()).isEqualTo("afsharid");
        assertThat(state.path("image").path("url").asString()).isNotBlank();
        JsonNode steps = ok("/api/v1/states/afshar/steps").path("steps");
        assertThat(steps.size()).isEqualTo(15);
        assertThat(steps.get(0).path("kind").asString()).isEqualTo("STATE_STEP");
    }

    // --- places ----------------------------------------------------------------------------

    @Test
    void placesOnTheMap() {
        assertThat(ok("/api/v1/places?size=100").path("totalElements").asLong()).isEqualTo(74);
        assertThat(ok("/api/v1/places?minImportance=1").path("totalElements").asLong()).isEqualTo(11);
        JsonNode karabakh = ok("/api/v1/places?bbox=46,39,47.5,40.2");
        assertThat(list(karabakh.path("items")).stream().map(p -> p.path("slug").asString())).containsExactly("shusha");
        assertThat(get("/api/v1/places?bbox=1,2,3").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get("/api/v1/places?minImportance=4").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        JsonNode shusha = ok("/api/v1/places/shusha");
        assertThat(shusha.path("type").asString()).isEqualTo("FORTRESS");
        assertThat(shusha.path("modernName").asString()).isEqualTo("Şuşa (Azərbaycan)");
        JsonNode upcoming = shusha.path("upcoming").get(0);
        assertThat(upcoming.path("year").asInt()).isEqualTo(1752);
        assertThat(upcoming.path("ref").path("type").asString()).isEqualTo("STATE");
        assertThat(upcoming.path("ref").path("available").asBoolean()).isFalse();
        assertThat(upcoming.path("ref").path("name").asString()).isEqualTo("Qarabağ xanlığı");
        assertThat(shusha.path("upcoming").get(1).path("ref").isNull()).isTrue();
    }

    // --- chronology and themes -------------------------------------------------------------

    @Test
    void erasPolitiesAndRulers() {
        JsonNode eras = ok("/api/v1/eras");
        assertThat(list(eras).stream().map(e -> e.path("slug").asString())).containsExactly("agqoyunlu", "sefevi", "efshar", "muasir");

        JsonNode safavid = ok("/api/v1/polities/safavid");
        assertThat(safavid.path("facts").size()).isEqualTo(5);
        JsonNode ismail = find(safavid.path("reigns"), "rulerSlug", "ismail-i");
        assertThat(ismail.path("start").path("year").asInt()).isEqualTo(1501);
        assertThat(ismail.path("rulerAvailable").asBoolean()).isTrue();

        JsonNode ruler = ok("/api/v1/rulers/ismail-i");
        assertThat(ruler.path("personSlug").asString()).isEqualTo("shah-ismayil");
        assertThat(ruler.path("personAvailable").asBoolean()).isTrue();
        assertThat(find(ruler.path("reigns"), "politySlug", "safavid").path("end").path("year").asInt()).isEqualTo(1524);
        assertThat(get("/api/v1/polities/atlantis").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void aThemeVariantIsMergedWithItsParent() {
        JsonNode variant = ok("/api/v1/themes/efshar-hind");
        JsonNode parent = ok("/api/v1/themes/efshar");
        assertThat(variant.path("extendsSlug").asString()).isEqualTo("efshar");
        assertThat(variant.path("palette").path("primary").asString()).isEqualTo("#8a2b1d");
        assertThat(variant.path("palette").path("surface")).isEqualTo(parent.path("palette").path("surface"));
        assertThat(parent.path("moodOverrides").has("BATTLE")).isTrue();
        assertThat(variant.path("backgroundArt").get(0).path("url").asString()).isEqualTo("/backgrounds/mughal-shahbarghan");
    }

    // --- relations -------------------------------------------------------------------------

    @Test
    void relationsGoBothWays() {
        JsonNode links = ok("/api/v1/relations?type=person&slug=shah-ismayil");
        JsonNode fromBirth = list(links).stream().filter(l -> "ismayil-birth".equals(l.path("fromStepKey").asString(null)))
                .findFirst().orElseThrow();
        assertThat(fromBirth.path("direction").asString()).isEqualTo("OUTGOING");
        assertThat(fromBirth.path("slug").asString()).isEqualTo("uzun-hasan");
        assertThat(list(links).stream().filter(l -> "INCOMING".equals(l.path("direction").asString())).map(l -> l.path("slug").asString()))
                .contains("uzun-hasan", "nadir-shah");
        assertThat(get("/api/v1/relations?type=dragon&slug=x").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get("/api/v1/relations?type=person").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // --- performance -----------------------------------------------------------------------

    @Test
    void stepsTakeTheSameNumberOfQueriesHoweverManyStepsThereAre() {
        cache.clear();
        long ismayil = QueryCounter.during(() -> ok("/api/v1/persons/shah-ismayil/steps"));
        long nadir = QueryCounter.during(() -> ok("/api/v1/persons/nadir-shah/steps"));
        long war = QueryCounter.during(() -> ok("/api/v1/conflicts/karabakh-war-2020/days"));
        assertThat(ismayil).isLessThanOrEqualTo(15);
        assertThat(nadir).isLessThanOrEqualTo(15);
        assertThat(war).isLessThanOrEqualTo(15);

        // Cached: only the content version is read.
        assertThat(QueryCounter.during(() -> ok("/api/v1/persons/shah-ismayil/steps"))).isEqualTo(1);
        // Not modified: the same single query, and no content tables.
        String etag = get("/api/v1/persons/shah-ismayil/steps").getHeaders().getETag();
        assertThat(QueryCounter.during(() -> get("/api/v1/persons/shah-ismayil/steps", h -> h.setIfNoneMatch(etag)))).isEqualTo(1);
    }

    @Test
    void openApiDescribesThePublicApi() {
        JsonNode doc = ok("/v3/api-docs/public");
        assertThat(doc.path("paths").has("/api/v1/persons/{slug}/steps")).isTrue();
        assertThat(doc.path("paths").has("/api/v1/editorial/documents")).isFalse();
        JsonNode params = doc.path("paths").path("/api/v1/persons/{slug}").path("get").path("parameters");
        assertThat(list(params).stream().map(p -> p.path("name").asString())).contains("slug", "lang", "Accept-Language")
                .doesNotContain("ctx");
        List<String> internal = new ArrayList<>();
        ok("/v3/api-docs/internal").path("paths").propertyNames().forEach(internal::add);
        assertThat(internal).contains("/api/v1/editorial/documents");
    }
}
