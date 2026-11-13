package az.tarix.platform.theming.internal.web;

import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.web.PublicApi;
import az.tarix.platform.theming.internal.read.ThemeReader;
import az.tarix.platform.theming.internal.read.ThemeReader.ThemeView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PublicApi
@RequestMapping("/api/v1/themes")
@Tag(name = "Temalar")
class ThemeController {

    private final ThemeReader themes;

    ThemeController(ThemeReader themes) {
        this.themes = themes;
    }

    @GetMapping("/{slug}")
    @Operation(summary = "Vizual tema", description = "Variantlar əsas tema ilə birləşdirilmiş halda (frontend `resolveThemes` qaydası).")
    ThemeView theme(ReadContext ctx, @PathVariable String slug) {
        return themes.theme(ctx, slug);
    }
}
