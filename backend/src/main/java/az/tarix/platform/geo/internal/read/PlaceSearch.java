package az.tarix.platform.geo.internal.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.SearchSource.Table;
import az.tarix.platform.shared.read.TableSearch;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Search over places, by historical and modern name. */
@Component
class PlaceSearch extends TableSearch {

    PlaceSearch(JdbcClient jdbc) {
        super(jdbc, List.of(
                new Table(EntityType.PLACE, "place", List.of("historical_name", "modern_name"), "CAST(NULL AS int)",
                        "CAST(NULL AS int)")));
    }
}
