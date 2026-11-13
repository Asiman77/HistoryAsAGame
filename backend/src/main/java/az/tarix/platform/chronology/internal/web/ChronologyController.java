package az.tarix.platform.chronology.internal.web;

import az.tarix.platform.chronology.internal.read.ChronologyReader;
import az.tarix.platform.chronology.internal.read.ChronologyReader.EraView;
import az.tarix.platform.chronology.internal.read.ChronologyReader.PolityView;
import az.tarix.platform.chronology.internal.read.ChronologyReader.RulerView;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PublicApi
@RequestMapping("/api/v1")
@Tag(name = "Xronologiya")
class ChronologyController {

    private final ChronologyReader chronology;

    ChronologyController(ChronologyReader chronology) {
        this.chronology = chronology;
    }

    @GetMapping("/eras")
    @Operation(summary = "Dövrlər", description = "Hamısı, xronoloji sırada (az sayda olduğu üçün səhifələnmir).")
    List<EraView> eras(ReadContext ctx) {
        return chronology.eras(ctx);
    }

    @GetMapping("/polities/{slug}")
    @Operation(summary = "Siyasi qurum", description = "Rəng, emblem, mövcudluq dövrləri, dövrlərə görə faktlar və hakimiyyətlər.")
    PolityView polity(ReadContext ctx, @PathVariable String slug) {
        return chronology.polity(ctx, slug);
    }

    @GetMapping("/rulers/{slug}")
    @Operation(summary = "Hökmdar", description = "Titullar, sülalə, həyat tarixləri, hakimiyyətləri və əlaqələri.")
    RulerView ruler(ReadContext ctx, @PathVariable String slug) {
        return chronology.ruler(ctx, slug);
    }
}
