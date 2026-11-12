package az.tarix.platform.editorial.internal.validation;

import java.util.Optional;

/** Validity of a GeoJSON geometry, as PostGIS sees it ({@code ST_IsValid}). */
public interface GeometryCheck {

    /** Empty when valid; otherwise the reason ({@code ST_IsValidReason}). */
    Optional<String> problem(String geoJsonGeometry);
}
