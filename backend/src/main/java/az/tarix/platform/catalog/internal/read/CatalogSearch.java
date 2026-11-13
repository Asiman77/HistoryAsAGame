package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.SearchSource.Table;
import az.tarix.platform.shared.read.TableSearch;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Search over persons, wars, states, battles and heroes. */
@Component
class CatalogSearch extends TableSearch {

    CatalogSearch(JdbcClient jdbc) {
        super(jdbc, List.of(
                new Table(EntityType.PERSON, "person", List.of("name", "short_name"), "birth_year", "death_year"),
                new Table(EntityType.CONFLICT, "conflict", List.of("name"), "start_year", "end_year"),
                new Table(EntityType.STATE, "state_profile", List.of("name"), "start_year", "end_year"),
                new Table(EntityType.BATTLE, "battle", List.of("name"), "date_year", "date_year"),
                new Table(EntityType.HERO, "hero", List.of("full_name"), "birth_year", "death_year")));
    }
}
