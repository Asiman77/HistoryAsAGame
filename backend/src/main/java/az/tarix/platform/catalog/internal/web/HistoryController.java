package az.tarix.platform.catalog.internal.web;

import az.tarix.platform.catalog.internal.read.CompareReader;
import az.tarix.platform.catalog.internal.read.CompareReader.Comparison;
import az.tarix.platform.catalog.internal.read.PlaceTimelineReader;
import az.tarix.platform.catalog.internal.read.PlaceTimelineReader.PlaceTimeline;
import az.tarix.platform.catalog.internal.read.SearchReader;
import az.tarix.platform.catalog.internal.read.SearchReader.SearchResult;
import az.tarix.platform.catalog.internal.read.TimelineReader;
import az.tarix.platform.catalog.internal.read.TimelineReader.OnThisDay;
import az.tarix.platform.catalog.internal.read.TimelineReader.YearView;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.PublicParams;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Queries across all simulations: by year, by day, by place, side by side. */
@RestController
@PublicApi
@RequestMapping("/api/v1")
@Tag(name = "Zaman və məkan")
class HistoryController {

    private final TimelineReader timeline;
    private final PlaceTimelineReader placeTimeline;
    private final CompareReader compare;
    private final SearchReader search;

    HistoryController(TimelineReader timeline, PlaceTimelineReader placeTimeline, CompareReader compare, SearchReader search) {
        this.timeline = timeline;
        this.placeTimeline = placeTimeline;
        this.compare = compare;
        this.search = search;
    }

    @GetMapping("/timeline")
    @Operation(summary = "İl üzrə tarix (zaman sürüşdürücüsü)",
            description = "İlin xəritəsi (snapshot seçimi və paytaxtlar), hakimiyyətdə olan hökmdarlar, sağ olan şəxsiyyətlər "
                    + "(yaş və son məlum yer), həmin ilin hadisələri. `coverage`: FULL — xəritə ili əhatə edir, PARTIAL — xəritə "
                    + "yoxdur, digər məlumat var, NONE — heç nə yoxdur.")
    YearView timeline(ReadContext ctx, @Parameter(description = "İl") @RequestParam(required = false) Integer year,
                      @Parameter(description = "Sinif, 1–11: hadisələr yalnız bu sinfin mövzularından") @RequestParam(required = false) Integer grade,
                      @Parameter(description = "Fənn (defolt `azerbaijan-history`), `grade` ilə birlikdə") @RequestParam(required = false) String subject) {
        int y = PublicParams.year("year", year);
        if (grade == null) return timeline.year(ctx, y);
        if (grade < 1 || grade > 11) throw new InvalidParameterException("grade", "1…11 aralığında olmalıdır");
        String s = PublicParams.slug("subject", subject);
        return timeline.year(ctx, y, s == null ? "azerbaijan-history" : s, grade);
    }

    @GetMapping("/on-this-day")
    @Operation(summary = "Tarixdə bu gün",
            description = "Həmin gün və ayda baş vermiş hadisələr (yalnız günə qədər dəqiq tarixlər), illərə görə. Yoxdursa, həmin "
                    + "ayın hadisələri (`mode: MONTH`). Xüsusi tarixlər `commemoration` ilə gəlir.")
    OnThisDay onThisDay(ReadContext ctx, @Parameter(description = "Ay, 1–12") @RequestParam(required = false) Integer month,
                        @Parameter(description = "Gün") @RequestParam(required = false) Integer day) {
        return timeline.onThisDay(ctx, month, day);
    }

    @GetMapping("/places/{slug}/timeline")
    @Operation(summary = "Məkanın tarixi",
            description = "Bütün kateqoriyalardan bu məkanda baş vermiş addımlar (xronoloji) və məkanın dövrlərə görə hansı "
                    + "dövlətə aid olduğu (ərazi snapshot-larından; xəritəsiz illər GAP).")
    PlaceTimeline placeTimeline(ReadContext ctx, @PathVariable String slug) {
        return placeTimeline.timeline(ctx, slug);
    }

    @GetMapping("/search")
    @Operation(summary = "Axtarış",
            description = "Şəxsiyyətlər, müharibələr, dövlətlər, döyüşlər, qəhrəmanlar, məkanlar, dövlət qurumları, hökmdarlar və "
                    + "dövrlər üzrə. Azərbaycan hərfləri və böyük-kiçik hərf fərq etmir (`seh ismayil` → Şah İsmayıl), "
                    + "yazı səhvlərinə dözümlüdür (trigram). Ən uyğun nəticələr əvvəldə.")
    SearchResult search(ReadContext ctx, @Parameter(description = "Sorğu, 2–100 simvol") @RequestParam(required = false) String q,
                        @Parameter(description = "Vergüllə tiplər, məs. PERSON,PLACE; verilməyibsə hamısı")
                        @RequestParam(required = false) String types,
                        @Parameter(description = "Nəticə sayı, 1–50 (defolt 20)") @RequestParam(required = false) Integer limit) {
        return search.search(ctx, q, types, limit);
    }

    @GetMapping("/compare")
    @Operation(summary = "Paralel müqayisə",
            description = "İki simulyasiya (şəxsiyyət, dövlət və ya müharibə) eyni zaman oxunda. Kəsişmə: eyni il və eyni məkan "
                    + "(və ya 25 km-dən yaxın), ya da eyni döyüşə istinad.")
    Comparison compare(ReadContext ctx,
                       @Parameter(description = "type:slug, məs. person:uzun-hasan") @RequestParam(required = false) String a,
                       @Parameter(description = "type:slug, məs. person:shah-ismayil") @RequestParam(required = false) String b) {
        return compare.compare(ctx, a, b);
    }
}
