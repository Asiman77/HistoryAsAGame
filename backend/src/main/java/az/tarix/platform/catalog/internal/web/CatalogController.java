package az.tarix.platform.catalog.internal.web;

import az.tarix.platform.catalog.internal.read.RelationReader;
import az.tarix.platform.catalog.internal.read.WarEntityReader;
import az.tarix.platform.catalog.internal.read.WarEntityReader.BattleView;
import az.tarix.platform.catalog.internal.read.WarEntityReader.HeroView;
import az.tarix.platform.catalog.internal.read.WorldEventReader;
import az.tarix.platform.catalog.internal.read.WorldEventReader.WorldEvents;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.PublicParams;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.domain.Slugs;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Locale;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Battles, heroes, the links between entities (BACKEND_SPEC.md §10.1) and world events. */
@RestController
@PublicApi
@RequestMapping("/api/v1")
@Tag(name = "Kataloq")
class CatalogController {

    private final WarEntityReader wars;
    private final RelationReader relations;
    private final WorldEventReader worldEvents;

    CatalogController(WarEntityReader wars, RelationReader relations, WorldEventReader worldEvents) {
        this.wars = wars;
        this.relations = relations;
        this.worldEvents = worldEvents;
    }

    @GetMapping("/world-events")
    @Operation(summary = "Bu zaman dünyada",
            description = "`year` ilə: o ilə ən yaxın (±12 il) ən çox `limit` hadisə, əvvəlcə fərqli regionlardan — "
                    + "frontend-in \"Bu zaman dünyada\" paneli. `from` və `to` ilə: bu illərlə kəsişən bütün hadisələr.")
    WorldEvents worldEvents(ReadContext ctx,
                            @Parameter(description = "İl (seçim rejimi)") @RequestParam(required = false) Integer year,
                            @Parameter(description = "Seçim rejimində hadisə sayı, 1–10 (defolt 3)") @RequestParam(required = false) Integer limit,
                            @Parameter(description = "Aralığın başlanğıcı") @RequestParam(required = false) Integer from,
                            @Parameter(description = "Aralığın sonu") @RequestParam(required = false) Integer to) {
        if (year != null) {
            if (from != null || to != null) throw new InvalidParameterException("year", "from/to ilə birlikdə verilmir");
            int n = limit == null ? 3 : limit;
            if (n < 1 || n > 10) throw new InvalidParameterException("limit", "1–10 olmalıdır");
            return worldEvents.around(ctx, PublicParams.year("year", year), n);
        }
        if (limit != null) throw new InvalidParameterException("limit", "yalnız year ilə verilir");
        int f = PublicParams.year("from", from);
        int t = PublicParams.year("to", to);
        if (t < f) throw new InvalidParameterException("to", "from-dan kiçik ola bilməz");
        if (t - f > 1000) throw new InvalidParameterException("to", "aralıq ən çox 1000 il ola bilər");
        return worldEvents.span(ctx, f, t);
    }

    @GetMapping("/battles/{slug}")
    @Operation(summary = "Döyüş")
    BattleView battle(ReadContext ctx, @PathVariable String slug) {
        return wars.battle(ctx, slug);
    }

    @GetMapping("/heroes/{slug}")
    @Operation(summary = "Qəhrəman / şəhid")
    HeroView hero(ReadContext ctx, @PathVariable String slug) {
        return wars.hero(ctx, slug);
    }

    @GetMapping("/relations")
    @Operation(summary = "Entity-nin bütün əlaqələri",
            description = "Öz və addımlarının əlaqələri (`OUTGOING`) və ona işarə edənlər (`INCOMING`). "
                    + "`available: false` — hədəf hələ dərc olunmayıb (passiv keçid).")
    List<ApiLink> relations(ReadContext ctx,
                            @Parameter(description = "person, conflict, battle, state, place, polity, ruler, era, hero")
                            @RequestParam String type,
                            @RequestParam String slug) {
        EntityType entityType;
        try {
            entityType = EntityType.valueOf(type.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new InvalidParameterException("type", "naməlum tip: " + type);
        }
        if (!Slugs.isValid(slug)) throw new InvalidParameterException("slug", "yanlış slug");
        return relations.all(ctx, entityType, slug);
    }
}
