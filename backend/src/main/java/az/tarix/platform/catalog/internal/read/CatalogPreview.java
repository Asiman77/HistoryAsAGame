package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.read.PreviewSource;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/** Editorial preview of simulations, battles, heroes and a place's timeline, by the public readers. */
@Component
class CatalogPreview implements PreviewSource {

    private final PersonReader persons;
    private final ConflictReader conflicts;
    private final StateReader states;
    private final WarEntityReader warEntities;
    private final PlaceTimelineReader places;
    private final CurriculumReader curriculum;

    CatalogPreview(PersonReader persons, ConflictReader conflicts, StateReader states, WarEntityReader warEntities,
                   PlaceTimelineReader places, CurriculumReader curriculum) {
        this.persons = persons;
        this.conflicts = conflicts;
        this.states = states;
        this.warEntities = warEntities;
        this.places = places;
        this.curriculum = curriculum;
    }

    @Override
    public Map<String, Object> preview(DocumentType type, String slug, ReadContext ctx) {
        Map<String, Object> out = new LinkedHashMap<>();
        switch (type) {
            case PERSON -> {
                put(out, "profile", () -> persons.profile(ctx, slug));
                put(out, "steps", () -> persons.steps(ctx, slug));
            }
            case CONFLICT -> {
                put(out, "conflict", () -> conflicts.detail(ctx, slug));
                put(out, "days", () -> conflicts.days(ctx, slug));
            }
            case STATE -> {
                put(out, "state", () -> states.detail(ctx, slug));
                put(out, "steps", () -> states.steps(ctx, slug));
            }
            case BATTLE -> put(out, "battle", () -> warEntities.battle(ctx, slug));
            case HERO -> put(out, "hero", () -> warEntities.hero(ctx, slug));
            case PLACE -> put(out, "timeline", () -> places.timeline(ctx, slug));
            case CURRICULUM_GRADE -> put(out, "grade", () -> curriculum.gradeBySlug(ctx, slug));
            default -> { }
        }
        return out;
    }

    /** A part that is not there (e.g. a document the reader leaves out) is simply missing from the preview. */
    static void put(Map<String, Object> out, String name, Supplier<Object> read) {
        try {
            out.put(name, read.get());
        } catch (ResourceNotFoundException e) {
            // not part of the public API in this state
        }
    }
}
