package az.tarix.platform.editorial.internal.persistence;

import az.tarix.platform.editorial.internal.validation.GeometryCheck;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Asks PostGIS ({@code geojson_problem}, V010) whether a geometry is valid. */
@Component
class PostgisGeometryCheck implements GeometryCheck {

    static final String PROBLEM = "SELECT geojson_problem(:g)";

    private final JdbcClient jdbc;

    PostgisGeometryCheck(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<String> problem(String geoJsonGeometry) {
        // One row; its value is NULL when the geometry is valid.
        return jdbc.sql(PROBLEM).param("g", geoJsonGeometry).query(String.class).list().stream()
                .filter(java.util.Objects::nonNull).findFirst();
    }
}
