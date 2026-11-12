package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.editorial.api.DocumentType;
import az.tarix.platform.editorial.internal.content.ContentJson;
import az.tarix.platform.editorial.internal.validation.ValidationContext.Item;
import tools.jackson.databind.JsonNode;

/**
 * Built territory polygons ({@code /built}, the output of scripts/build-territories.ts) must
 * be valid for PostGIS ({@code ST_IsValid}), or the projection would fail; and they must be
 * built from this snapshot.
 */
final class GeometryRule implements ValidationRule {

    @Override
    public void check(ValidationContext ctx) {
        if (ctx.type() != DocumentType.TERRITORY_SNAPSHOT) return;
        Item built = ctx.part("built");
        if (!built.node().isObject()) return;
        String id = built.text("id");
        if (id != null && !id.equals(ctx.slug())) {
            ctx.error("slug-mismatch", built.at("id"), "qurulmuş fayl başqa snapshot-dandır: " + id);
        }
        JsonNode sourceYear = ctx.content().path("snapshot").path("year");
        if (sourceYear.isIntegralNumber() && built.node().path("year").isIntegralNumber()
                && sourceYear.intValue() != built.node().path("year").intValue()) {
            ctx.error("built-out-of-date", built.at("year"), "qurulmuş faylın ili snapshot-un ili ilə uyğun gəlmir");
        }
        for (Item polity : ValidationContext.items(ValidationContext.child(built, "polities"))) {
            JsonNode geometry = polity.node().path("geometry");
            if (!geometry.isObject() || !geometry.path("coordinates").isArray()) continue;   // reported by the schema rule
            ctx.geometry().problem(ContentJson.write(geometry)).ifPresent(reason ->
                    ctx.error("invalid-geometry", polity.at("geometry"), "%s: etibarsız poliqon (%s)".formatted(polity.text("id"), reason)));
        }
    }
}
