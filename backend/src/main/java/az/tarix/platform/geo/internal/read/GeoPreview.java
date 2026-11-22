package az.tarix.platform.geo.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.read.PreviewSource;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Editorial preview of places and territory snapshots (the map of the snapshot's year). */
@Component
class GeoPreview implements PreviewSource {

    private final PlaceReader places;
    private final TerritoryReader territories;
    private final JdbcClient jdbc;

    GeoPreview(PlaceReader places, TerritoryReader territories, JdbcClient jdbc) {
        this.places = places;
        this.territories = territories;
        this.jdbc = jdbc;
    }

    @Override
    public Map<String, Object> preview(DocumentType type, String slug, ReadContext ctx) {
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            switch (type) {
                case PLACE -> out.put("place", places.detail(ctx, slug));
                case TERRITORY_SNAPSHOT -> jdbc.sql("SELECT year FROM territory_snapshot WHERE slug = :slug").param("slug", slug)
                        .query(Integer.class).optional().ifPresent(year -> out.put("territories", territories.map(ctx, year, true)));
                default -> { }
            }
        } catch (ResourceNotFoundException e) {
            // not part of the public API in this state
        }
        return out;
    }
}
