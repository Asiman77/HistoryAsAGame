package az.tarix.platform.analytics.internal.domain;

import java.util.Locale;
import java.util.Optional;

/**
 * The event types of BACKEND_SPEC.md §12 and the fields each may carry. Wire names are
 * snake_case, as in the spec.
 */
public enum EventType {
    SIMULATION_STARTED,
    STEP_VIEWED,
    SIMULATION_COMPLETED,
    SIMULATION_ABANDONED,
    QUIZ_ANSWERED,
    CHOICE_MADE,
    MODE_SWITCHED,
    CROSS_LINK_FOLLOWED,
    LEGEND_TOGGLE,
    TIME_SLIDER_USED;

    /** {@code simulation_started}. */
    public String wireName() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static Optional<EventType> of(String wireName) {
        if (wireName == null) return Optional.empty();
        for (EventType t : values()) if (t.wireName().equals(wireName)) return Optional.of(t);
        return Optional.empty();
    }

    /** Whether the event is about one simulation (owner required). */
    boolean needsOwner() {
        return switch (this) {
            case SIMULATION_STARTED, STEP_VIEWED, SIMULATION_COMPLETED, SIMULATION_ABANDONED, QUIZ_ANSWERED, CHOICE_MADE -> true;
            default -> false;
        };
    }

    /** Whether the event is about one step (step key required). */
    boolean needsStep() {
        return switch (this) {
            case STEP_VIEWED, SIMULATION_ABANDONED, QUIZ_ANSWERED, CHOICE_MADE -> true;
            default -> false;
        };
    }

    /** Whether an owner may be given although not required (where in the site it happened). */
    boolean mayHaveOwner() {
        return needsOwner() || this == MODE_SWITCHED || this == CROSS_LINK_FOLLOWED || this == LEGEND_TOGGLE;
    }

    boolean mayHaveStep() {
        return needsStep() || this == CROSS_LINK_FOLLOWED || this == LEGEND_TOGGLE;
    }
}
