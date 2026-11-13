package az.tarix.platform.geo.internal.web;

import az.tarix.platform.geo.internal.read.TerritoryReader;
import az.tarix.platform.geo.internal.read.TerritoryReader.PolitiesAt;
import az.tarix.platform.geo.internal.read.TerritoryReader.TerritoryMap;
import az.tarix.platform.shared.read.PublicParams;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PublicApi
@RequestMapping("/api/v1")
@Tag(name = "Ərazilər")
class TerritoryController {

    static final MediaType GEO_JSON = MediaType.parseMediaType("application/geo+json");

    private final TerritoryReader territories;

    TerritoryController(TerritoryReader territories) {
        this.territories = territories;
    }

    @GetMapping(value = "/territories", produces = {"application/geo+json", MediaType.APPLICATION_JSON_VALUE})
    @Operation(summary = "Siyasi xəritə (GeoJSON)",
            description = "İlin ərazi snapshot-u: hər dövlət bir Feature. Snapshot öz ilini və ən çox 30 il sonranı əhatə edir; "
                    + "əhatəsiz ildə ən yaxın snapshot `covered: false` ilə qaytarılır (solğun çəkmək üçün), "
                    + "`prevYear`/`nextYear` isə əhatəli illərə keçid üçündür.")
    ResponseEntity<TerritoryMap> map(ReadContext ctx,
                                     @Parameter(description = "İl (astronomik nömrələmə)") @RequestParam(required = false) Integer year,
                                     @Parameter(description = "Sadələşdirilmiş geometriya (≈ 1 km); `false` yalnız yaxın zoom üçün")
                                     @RequestParam(defaultValue = "true") boolean simplified) {
        return ResponseEntity.ok().contentType(GEO_JSON)
                .body(territories.map(ctx, PublicParams.year("year", year), simplified));
    }

    @GetMapping("/polities/at")
    @Operation(summary = "Nöqtə həmin il hansı dövlətdə idi",
            description = "Əhatəli snapshot-da nöqtəni ehtiva edən bütün dövlətlər (mübahisəli və vassal ərazilərdə bir neçə). "
                    + "İl heç bir snapshot ilə əhatə olunmayıbsa `covered: false` və boş siyahı.")
    PolitiesAt politiesAt(ReadContext ctx, @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lng,
                          @RequestParam(required = false) Integer year) {
        return territories.politiesAt(ctx, PublicParams.latitude("lat", lat), PublicParams.longitude("lng", lng),
                PublicParams.year("year", year));
    }
}
