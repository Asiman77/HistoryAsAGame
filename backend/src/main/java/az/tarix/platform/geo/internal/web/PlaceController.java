package az.tarix.platform.geo.internal.web;

import az.tarix.platform.geo.internal.read.PlaceReader;
import az.tarix.platform.geo.internal.read.PlaceReader.BoundingBox;
import az.tarix.platform.geo.internal.read.PlaceReader.PlaceCard;
import az.tarix.platform.geo.internal.read.PlaceReader.PlaceDetail;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResultPage;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PublicApi
@RequestMapping("/api/v1/places")
@Tag(name = "Məkanlar")
class PlaceController {

    private final PlaceReader places;

    PlaceController(PlaceReader places) {
        this.places = places;
    }

    @GetMapping
    @Operation(summary = "Xəritə görünüşündəki məkanlar", description = "Ən vacib məkanlar əvvəldə.")
    ResultPage<PlaceCard> list(ReadContext ctx,
                               @Parameter(description = "minLng,minLat,maxLng,maxLat (WGS 84); verilməyibsə hamısı")
                               @RequestParam(required = false) String bbox,
                               @Parameter(description = "Vaciblik həddi: 1 = yalnız ən vacib məkanlar, 3 = hamısı")
                               @RequestParam(required = false) Integer minImportance,
                               @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return places.list(ctx, BoundingBox.parse(bbox), minImportance, ResultPage.Request.of(page, size));
    }

    @GetMapping("/{slug}")
    @Operation(summary = "Məkan", description = "Tarixi və müasir ad, dövrlərə görə adlar, gələcək məzmun.")
    PlaceDetail detail(ReadContext ctx, @PathVariable String slug) {
        return places.detail(ctx, slug);
    }
}
