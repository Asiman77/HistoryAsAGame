package az.tarix.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.shared.domain.Certainty;
import az.tarix.platform.shared.domain.HistoricalDate;
import az.tarix.platform.shared.jdbc.HistoricalDateColumns;
import java.time.Year;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;

/** The projection schema itself: search folding, CHECK rules, generated columns, indexes. */
@IntegrationTest
class ProjectionSchemaTests {

    @Autowired
    JdbcClient jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.sql("TRUNCATE person, place, territory_snapshot, polity, simulation_step CASCADE").update();
    }

    String fold(String text) {
        return jdbc.sql("SELECT az_fold(:t)").param("t", text).query(String.class).optional().orElse(null);
    }

    // --- az_fold and search -------------------------------------------------------------

    @Test
    void azFoldSimplifiesAzerbaijaniLettersIndependentlyOfLocale() {
        assertThat(fold("Şah İsmayıl")).isEqualTo("sah ismayil");
        assertThat(fold("ŞAH İSMAYIL")).isEqualTo("sah ismayil");
        assertThat(fold("Ağqoyunlu")).isEqualTo("agqoyunlu");
        assertThat(fold("Gəncə Əfşar")).isEqualTo("gence efsar");
        assertThat(fold("Ölkə Ümid Üzeyir")).isEqualTo("olke umid uzeyir");
        assertThat(fold("Irəvan")).isEqualTo("irevan");
        assertThat(fold(null)).isNull();
    }

    /** BACKEND_SPEC.md §7.2 maps ç to g; V003 fixes it. */
    @Test
    void azFoldMapsCedillaToC() {
        assertThat(fold("Çaldıran")).isEqualTo("caldiran");
        assertThat(fold("çay")).isEqualTo("cay");
    }

    @Test
    void trigramSearchFindsNamesTypedWithoutAzerbaijaniLetters() {
        insertPerson("shah-ismayil", "Şah İsmayıl Xətai", HistoricalDate.of(1487, 7, 17, Certainty.EXACT),
                HistoricalDate.of(1524, 5, 23, Certainty.EXACT));
        insertPerson("nadir-shah", "Nadir Şah Əfşar", HistoricalDate.of(1688, 10, 22, Certainty.APPROXIMATE),
                HistoricalDate.of(1747, 6, 20, Certainty.EXACT));

        List<String> hits = jdbc.sql("""
                        SELECT slug FROM person
                        WHERE az_fold(:q) <% az_fold(name ->> 'az')
                        ORDER BY word_similarity(az_fold(:q), az_fold(name ->> 'az')) DESC
                        """)
                .param("q", "seh ismayil").query(String.class).list();
        assertThat(hits).first().isEqualTo("shah-ismayil");

        assertThat(jdbc.sql("SELECT slug FROM person WHERE az_fold(:q) <% az_fold(name ->> 'az')")
                .param("q", "efsar").query(String.class).list()).containsExactly("nadir-shah");
    }

    // --- HistoricalDate columns ---------------------------------------------------------

    @Test
    void sqlCalendarRulesMatchJavaForEveryLeapDay() {
        Map<Integer, Boolean> sql = new HashMap<>();
        jdbc.sql("SELECT y, is_historical_date(y, 2, 29, 'DAY', 'EXACT') ok FROM generate_series(-800, 2400) y")
                .query((rs, n) -> sql.put(rs.getInt("y"), rs.getBoolean("ok"))).list();
        assertThat(sql).hasSize(3201);
        sql.forEach((year, ok) -> assertThat(ok).as("29 Feb %d", year).isEqualTo(Year.isLeap(year)));
    }

    /** A CHECK passes on NULL, so a missing part must make the function false, not NULL. */
    @Test
    void dateCheckIsFalseNotNullWhenPartsAreMissing() {
        List<Boolean> results = jdbc.sql("""
                        SELECT is_historical_date(y::int, m::int, d::int, p, c) FROM (VALUES
                          (1514, 2, NULL, 'DAY', 'EXACT'),
                          (1514, NULL, NULL, 'MONTH', 'EXACT'),
                          (NULL, NULL, NULL, 'YEAR', 'EXACT'),
                          (1514, NULL, NULL, 'YEAR', NULL),
                          (1514, NULL, NULL, NULL, 'EXACT')) v(y, m, d, p, c)
                        """).query(Boolean.class).list();
        assertThat(results).containsOnly(false).hasSize(5);
    }

    @Test
    void sortKeyIsGeneratedLikeJava() {
        HistoricalDate birth = HistoricalDate.of(-500, 3, null, Certainty.APPROXIMATE);
        HistoricalDate death = HistoricalDate.of(-440, 12, 31, Certainty.EXACT);
        insertPerson("herodot", "Herodot", birth, death);
        Map<String, Object> row = jdbc.sql("SELECT birth_sort_key, death_sort_key FROM person WHERE slug = 'herodot'")
                .query().singleRow();
        assertThat(row).containsEntry("birth_sort_key", birth.sortKey()).containsEntry("death_sort_key", death.sortKey());
    }

    @Test
    void historicalDateColumnsRoundTrip() {
        HistoricalDate birth = HistoricalDate.of(1487, 7, 17, Certainty.APPROXIMATE);
        HistoricalDate death = HistoricalDate.of(1524, 5, null, Certainty.DISPUTED);
        insertPerson("shah-ismayil", "Şah İsmayıl", birth, death);
        List<HistoricalDate> read = jdbc.sql("SELECT * FROM person WHERE slug = 'shah-ismayil'")
                .query((rs, n) -> List.of(HistoricalDateColumns.read(rs, "birth"), HistoricalDateColumns.read(rs, "death")))
                .single();
        assertThat(read).containsExactly(birth, death);
    }

    @Test
    void rejectsImpossibleOrInconsistentDates() {
        assertThatThrownBy(() -> insertPerson("x", "X", raw(1514, 2, 31, "DAY"), HistoricalDate.ofYear(1600, Certainty.EXACT)))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("person_birth_chk");
        assertThatThrownBy(() -> insertPerson("x", "X", raw(1514, 2, null, "DAY"), HistoricalDate.ofYear(1600, Certainty.EXACT)))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("person_birth_chk");
        assertThatThrownBy(() -> insertPerson("x", "X", HistoricalDate.ofYear(1600, Certainty.EXACT), HistoricalDate.ofYear(1500, Certainty.EXACT)))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("person_lifespan_chk");
    }

    // --- slugs and localized text -------------------------------------------------------

    @Test
    void rejectsInvalidSlugsAndLocalizedText() {
        assertThatThrownBy(() -> insertPlace("Şuşa", "{\"az\": \"Şuşa\"}"))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("slug");
        assertThatThrownBy(() -> insertPlace("shusha", "{\"en\": \"Shusha\"}"))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("historical_name");
        assertThatThrownBy(() -> insertPlace("shusha", "{\"az\": \"\"}"))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("historical_name");
        assertThatThrownBy(() -> insertPlace("shusha", "\"Şuşa\""))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("historical_name");
        insertPlace("shusha", "{\"az\": \"Şuşa\", \"en\": \"Shusha\"}");
        assertThat(jdbc.sql("SELECT count(*) FROM place").query(Long.class).single()).isOne();
    }

    // --- geometry -----------------------------------------------------------------------

    @Test
    void rejectsSelfIntersectingTerritories() {
        UUID snapshot = jdbc.sql("""
                        INSERT INTO territory_snapshot (slug, year, valid_from_year, title, certainty, document_id)
                        VALUES ('y1501', 1501, 1501, '{"az": "1501"}', 'APPROXIMATE', uuidv7()) RETURNING id
                        """).query(UUID.class).single();
        String valid = "MULTIPOLYGON(((44 38, 48 38, 48 40, 44 40, 44 38)))";
        String bowtie = "MULTIPOLYGON(((44 38, 48 40, 48 38, 44 40, 44 38)))";
        insertTerritory(snapshot, valid);
        assertThatThrownBy(() -> insertTerritory(snapshot, bowtie))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("geometry");

        String polity = jdbc.sql("""
                        SELECT polity_slug FROM polity_territory
                        WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
                        """).param("lng", 46.29).param("lat", 38.08).query(String.class).single();
        assertThat(polity).isEqualTo("safavid");
    }

    // --- chronology ---------------------------------------------------------------------

    @Test
    void allowsOverlappingReignsForCoRulersAndClaimants() {
        UUID polity = jdbc.sql("""
                        INSERT INTO polity (slug, name, color, start_year, end_year, document_id)
                        VALUES ('agqoyunlu', '{"az": "Ağqoyunlu"}', '#8a4b2a', 1378, 1508, uuidv7()) RETURNING id
                        """).query(UUID.class).single();
        for (String ruler : List.of("alvand", "murad", "sultan-murad")) {
            jdbc.sql("""
                            INSERT INTO reign (polity_id, ruler_slug, start_year, end_year, certainty)
                            VALUES (:p, :r, 1497, 1503, 'APPROXIMATE')
                            """).param("p", polity).param("r", ruler).update();
        }
        assertThat(jdbc.sql("""
                        SELECT count(*) FROM reign
                        WHERE polity_id = :p AND start_year <= 1500 AND (end_year IS NULL OR end_year >= 1500)
                        """).param("p", polity).query(Long.class).single()).isEqualTo(3);
    }

    // --- indexes ------------------------------------------------------------------------

    @Test
    void hasTheIndexesTheQueriesRelyOn() {
        List<String> indexes = jdbc.sql("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
                .query(String.class).list();
        assertThat(indexes).contains(
                "simulation_step_sort_idx", "simulation_step_on_this_day_idx", "simulation_step_route_idx",
                "place_location_idx", "place_historical_name_trgm_idx", "person_name_trgm_idx",
                "polity_territory_geometry_idx", "territory_snapshot_validity_idx", "reign_polity_years_idx",
                "entity_relation_source_idx", "entity_relation_target_idx");
        String onThisDay = jdbc.sql("SELECT indexdef FROM pg_indexes WHERE indexname = 'simulation_step_on_this_day_idx'")
                .query(String.class).single();
        assertThat(onThisDay).contains("WHERE ((date_precision)::text = 'DAY'::text)");
    }

    @Test
    void everyProjectionTableHasADocumentIndex() {
        List<String> missing = jdbc.sql("""
                        SELECT c.table_name FROM information_schema.columns c
                        WHERE c.table_schema = 'public' AND c.column_name = 'document_id'
                          AND NOT EXISTS (SELECT 1 FROM pg_indexes i
                                          WHERE i.tablename = c.table_name AND i.indexdef LIKE '%(document_id)%')
                        """).query(String.class).list();
        assertThat(missing).isEmpty();
    }

    // --- helpers ------------------------------------------------------------------------

    /** Bypasses HistoricalDate validation to test the database constraint itself. */
    static Map<String, Object> raw(int year, Integer month, Integer day, String precision) {
        Map<String, Object> p = new HashMap<>();
        p.put("year", year);
        p.put("month", month);
        p.put("day", day);
        p.put("precision", precision);
        return p;
    }

    void insertPerson(String slug, String name, Object birth, HistoricalDate death) {
        Map<String, Object> params = new HashMap<>();
        if (birth instanceof HistoricalDate d) {
            params.putAll(HistoricalDateColumns.params("birth", d));
        } else {
            @SuppressWarnings("unchecked") Map<String, Object> r = (Map<String, Object>) birth;
            r.forEach((k, v) -> params.put("birth_" + k, v));
            params.put("birth_certainty", "EXACT");
        }
        params.putAll(HistoricalDateColumns.params("death", death));
        params.put("slug", slug);
        params.put("name", "{\"az\": \"" + name + "\"}");
        jdbc.sql("""
                        INSERT INTO person (slug, name,
                          birth_year, birth_month, birth_day, birth_precision, birth_certainty,
                          death_year, death_month, death_day, death_precision, death_certainty,
                          birth_location, death_location, short_bio, legacy, era_slugs, document_id)
                        VALUES (:slug, CAST(:name AS jsonb),
                          :birth_year, :birth_month, :birth_day, :birth_precision, :birth_certainty,
                          :death_year, :death_month, :death_day, :death_precision, :death_certainty,
                          '{}', '{}', '{"az": "..."}', '{"az": "..."}', '{sefevi}', uuidv7())
                        """).params(params).update();
    }

    void insertPlace(String slug, String nameJson) {
        jdbc.sql("""
                        INSERT INTO place (slug, historical_name, place_type, location, importance, document_id)
                        VALUES (:slug, CAST(:name AS jsonb), 'CITY', ST_SetSRID(ST_MakePoint(46.75, 39.76), 4326), 1, uuidv7())
                        """).param("slug", slug).param("name", nameJson).update();
    }

    void insertTerritory(UUID snapshot, String wkt) {
        jdbc.sql("""
                        INSERT INTO polity_territory (snapshot_id, polity_slug, name, color, geometry, label_at)
                        VALUES (:s, 'safavid', '{"az": "Səfəvilər"}', '#1f6f5c',
                                ST_GeomFromText(:wkt, 4326), ST_SetSRID(ST_MakePoint(46, 39), 4326))
                        """).param("s", snapshot).param("wkt", wkt).update();
    }
}
