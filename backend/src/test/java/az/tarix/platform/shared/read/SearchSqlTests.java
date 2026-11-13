package az.tarix.platform.shared.read;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.shared.domain.EntityType;
import java.util.List;
import org.junit.jupiter.api.Test;

class SearchSqlTests {

    @Test
    void searchSqlMatchesEveryNameInAzerbaijaniAndEnglish() {
        String sql = new SearchSource.Table(EntityType.PERSON, "person", List.of("name", "short_name"), "birth_year", "death_year").sql();
        assertThat(sql).contains("FROM person", "'PERSON' AS type", "birth_year AS from_year", ":q", ":limit");
        assertThat(sql).contains("az_fold(coalesce(name ->> 'az', ''))", "az_fold(coalesce(short_name ->> 'en', ''))");
        assertThat(sql.split(" OR ")).hasSize(4);
    }
}
