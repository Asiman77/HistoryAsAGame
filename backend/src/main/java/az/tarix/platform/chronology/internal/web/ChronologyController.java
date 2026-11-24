package az.tarix.platform.chronology.internal.web;

import az.tarix.platform.chronology.internal.read.ChronologyReader;
import az.tarix.platform.chronology.internal.read.ChronologyReader.EraView;
import az.tarix.platform.chronology.internal.read.ChronologyReader.PolityView;
import az.tarix.platform.chronology.internal.read.ChronologyReader.RulerPanel;
import az.tarix.platform.chronology.internal.read.ChronologyReader.RulerView;
import az.tarix.platform.shared.read.PublicParams;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    @Operation(summary = "Dövrlər",
            description = "Xronoloji sırada (az sayda olduğu üçün səhifələnmir). `subject` verilsə yalnız o fənnin dövrləri. "
                    + "`weight`: zaman şkalasında bir ilin digər dövrlərə nisbətən payı (1 = bərabər).")
    List<EraView> eras(ReadContext ctx,
                       @Parameter(description = "Fənn, məs. `azerbaijan-history`") @RequestParam(required = false) String subject) {
        return chronology.eras(ctx, PublicParams.slug("subject", subject));
    }

    @GetMapping("/polities/{slug}")
    @Operation(summary = "Siyasi qurum", description = "Rəng, emblem, mövcudluq dövrləri, dövrlərə görə faktlar və hakimiyyətlər.")
    PolityView polity(ReadContext ctx, @PathVariable String slug) {
        return chronology.polity(ctx, slug);
    }

    @GetMapping("/polities/{slug}/ruler")
    @Operation(summary = "Hökmdar paneli",
            description = "İldə hakimiyyətdə olan hökmdar(lar): həmhökmdarlar və həmin il hakimiyyət dəyişibsə bir neçə. "
                    + "`exists`: dövlət həmin il mövcud idimi; `facts`: həmin ilin faktları.")
    RulerPanel rulerPanel(ReadContext ctx, @PathVariable String slug,
                          @Parameter(description = "İl") @RequestParam(required = false) Integer year) {
        return chronology.rulerPanel(ctx, slug, PublicParams.year("year", year));
    }

    @GetMapping("/rulers/{slug}")
    @Operation(summary = "Hökmdar", description = "Titullar, sülalə, həyat tarixləri, hakimiyyətləri və əlaqələri.")
    RulerView ruler(ReadContext ctx, @PathVariable String slug) {
        return chronology.ruler(ctx, slug);
    }
}
