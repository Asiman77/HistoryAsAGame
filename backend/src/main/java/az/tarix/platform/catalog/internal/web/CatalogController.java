package az.tarix.platform.catalog.internal.web;

import az.tarix.platform.catalog.internal.read.RelationReader;
import az.tarix.platform.catalog.internal.read.WarEntityReader;
import az.tarix.platform.catalog.internal.read.WarEntityReader.BattleView;
import az.tarix.platform.catalog.internal.read.WarEntityReader.HeroView;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.InvalidParameterException;
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

/** Battles, heroes and the links between entities (BACKEND_SPEC.md §10.1). */
@RestController
@PublicApi
@RequestMapping("/api/v1")
@Tag(name = "Kataloq")
class CatalogController {

    private final WarEntityReader wars;
    private final RelationReader relations;

    CatalogController(WarEntityReader wars, RelationReader relations) {
        this.wars = wars;
        this.relations = relations;
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
