package az.tarix.platform.chronology.internal.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.SearchSource.Table;
import az.tarix.platform.shared.read.TableSearch;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Search over polities, rulers and eras. */
@Component
class ChronologySearch extends TableSearch {

    ChronologySearch(JdbcClient jdbc) {
        super(jdbc, List.of(
                new Table(EntityType.POLITY, "polity", List.of("name", "short_name"), "start_year", "end_year"),
                new Table(EntityType.RULER, "ruler", List.of("name"), "birth_year", "death_year"),
                new Table(EntityType.ERA, "era", List.of("name"), "start_year", "end_year")));
    }
}
