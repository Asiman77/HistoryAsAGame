package az.tarix.platform.catalog.internal.web;

import az.tarix.platform.catalog.internal.read.ConflictReader;
import az.tarix.platform.catalog.internal.read.ConflictReader.ConflictCard;
import az.tarix.platform.catalog.internal.read.ConflictReader.ConflictDetail;
import az.tarix.platform.catalog.internal.read.PersonReader;
import az.tarix.platform.catalog.internal.read.PersonReader.PersonCard;
import az.tarix.platform.catalog.internal.read.PersonReader.PersonProfile;
import az.tarix.platform.catalog.internal.read.StateReader;
import az.tarix.platform.catalog.internal.read.StateReader.StateCard;
import az.tarix.platform.catalog.internal.read.StateReader.StateDetail;
import az.tarix.platform.catalog.internal.read.StepReader.StepView;
import az.tarix.platform.catalog.internal.read.Steps;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResultPage;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The three simulation categories: persons, wars and states (BACKEND_SPEC.md §10.1). */
@RestController
@PublicApi
@RequestMapping("/api/v1")
@Tag(name = "Simulyasiyalar")
class SimulationController {

    private final PersonReader persons;
    private final ConflictReader conflicts;
    private final StateReader states;

    SimulationController(PersonReader persons, ConflictReader conflicts, StateReader states) {
        this.persons = persons;
        this.conflicts = conflicts;
        this.states = states;
    }

    // --- persons ----------------------------------------------------------------------------

    @GetMapping("/persons")
    @Operation(summary = "Şəxsiyyətlər", description = "Kartlar üçün: ad, illər, dövrlər, portret, tema. Seçilmişlər əvvəldə.")
    ResultPage<PersonCard> persons(ReadContext ctx, @RequestParam(required = false) Integer page,
                                   @RequestParam(required = false) Integer size) {
        return persons.list(ctx, ResultPage.Request.of(page, size));
    }

    @GetMapping("/persons/{slug}")
    @Operation(summary = "Şəxsiyyətin profili", description = "Doğum və ölüm, yaşa görə portretlər, əlaqələr.")
    PersonProfile person(ReadContext ctx, @PathVariable String slug) {
        return persons.profile(ctx, slug);
    }

    @GetMapping("/persons/{slug}/steps")
    @Operation(summary = "Həyat mərhələləri", description = "Sıra ilə, iddialar, mənbələr, əlaqələr və yaşa uyğun portretlə.")
    Steps personSteps(ReadContext ctx, @PathVariable String slug) {
        return persons.steps(ctx, slug);
    }

    @GetMapping("/persons/{slug}/steps/{stepKey}")
    @Operation(summary = "Tək həyat mərhələsi", description = "Dərin link üçün.")
    StepView personStep(ReadContext ctx, @PathVariable String slug, @PathVariable String stepKey) {
        return persons.step(ctx, slug, stepKey);
    }

    // --- conflicts --------------------------------------------------------------------------

    @GetMapping("/conflicts")
    @Operation(summary = "Müharibələr")
    ResultPage<ConflictCard> conflicts(ReadContext ctx, @RequestParam(required = false) Integer page,
                                       @RequestParam(required = false) Integer size) {
        return conflicts.list(ctx, ResultPage.Request.of(page, size));
    }

    @GetMapping("/conflicts/{slug}")
    @Operation(summary = "Müharibə", description = "Yaşayış məntəqələri, komandanlar, qəhrəmanlar, döyüşlər, əlaqələr.")
    ConflictDetail conflict(ReadContext ctx, @PathVariable String slug) {
        return conflicts.detail(ctx, slug);
    }

    @GetMapping("/conflicts/{slug}/days")
    @Operation(summary = "Müharibənin günləri")
    Steps conflictDays(ReadContext ctx, @PathVariable String slug) {
        return conflicts.days(ctx, slug);
    }

    @GetMapping("/conflicts/{slug}/days/{stepKey}")
    @Operation(summary = "Müharibənin bir günü", description = "Dərin link üçün.")
    StepView conflictDay(ReadContext ctx, @PathVariable String slug, @PathVariable String stepKey) {
        return conflicts.day(ctx, slug, stepKey);
    }

    // --- states -----------------------------------------------------------------------------

    @GetMapping("/states")
    @Operation(summary = "Dövlətlər")
    ResultPage<StateCard> states(ReadContext ctx, @RequestParam(required = false) Integer page,
                                 @RequestParam(required = false) Integer size) {
        return states.list(ctx, ResultPage.Request.of(page, size));
    }

    @GetMapping("/states/{slug}")
    @Operation(summary = "Dövlət simulyasiyası")
    StateDetail state(ReadContext ctx, @PathVariable String slug) {
        return states.detail(ctx, slug);
    }

    @GetMapping("/states/{slug}/steps")
    @Operation(summary = "Dövlətin mərhələləri")
    Steps stateSteps(ReadContext ctx, @PathVariable String slug) {
        return states.steps(ctx, slug);
    }

    @GetMapping("/states/{slug}/steps/{stepKey}")
    @Operation(summary = "Dövlətin bir mərhələsi", description = "Dərin link üçün.")
    StepView stateStep(ReadContext ctx, @PathVariable String slug, @PathVariable String stepKey) {
        return states.step(ctx, slug, stepKey);
    }
}
