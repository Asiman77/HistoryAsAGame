package az.tarix.platform.analytics.internal.domain;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.domain.Slugs;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Checks one incoming event against its type's fields and turns it into what is stored. A
 * field the type does not use is an error, not silently dropped: the client learns early that
 * it sends something the platform does not want.
 */
public final class EventRules {

    /** Client clocks are trusted only this far: older events or ones from the future get the receiving time. */
    public static final Duration MAX_AGE = Duration.ofHours(48);
    public static final Duration MAX_AHEAD = Duration.ofMinutes(5);
    static final long MAX_DURATION_MS = Duration.ofHours(1).toMillis();
    static final Set<String> MODES = Set.of("story", "learn");
    static final Set<String> OWNER_TYPES = Set.of("PERSON", "CONFLICT", "STATE");

    /** What is stored for an accepted event. {@code payload} holds only typed values. */
    public record Accepted(EventType type, Instant occurredAt, String ownerType, String ownerSlug, String stepKey, String detail,
                           Map<String, Object> payload) {}

    /** An event that is not stored, and why. */
    public static final class Rejected extends Exception {
        Rejected(String reason) {
            super(reason, null, false, false);
        }
    }

    private EventRules() {}

    public static Accepted check(IncomingEvent e, Instant receivedAt) throws Rejected {
        if (e == null) throw new Rejected("event is empty");
        EventType type = EventType.of(e.type()).orElseThrow(() -> new Rejected("unknown type: " + e.type()));

        String ownerType = null;
        if (e.ownerType() != null || e.ownerSlug() != null) {
            if (!type.mayHaveOwner()) throw new Rejected(type.wireName() + " has no owner");
            ownerType = e.ownerType() == null ? null : e.ownerType().toUpperCase(Locale.ROOT);
            if (!OWNER_TYPES.contains(ownerType)) throw new Rejected("ownerType: person, conflict or state");
            if (!Slugs.isValid(e.ownerSlug())) throw new Rejected("ownerSlug is not a slug");
        } else if (type.needsOwner()) {
            throw new Rejected(type.wireName() + " needs ownerType and ownerSlug");
        }
        if (e.stepKey() != null) {
            if (!type.mayHaveStep()) throw new Rejected(type.wireName() + " has no stepKey");
            if (ownerType == null) throw new Rejected("stepKey needs an owner");
            if (!Slugs.isValid(e.stepKey())) throw new Rejected("stepKey is not a slug");
        } else if (type.needsStep()) {
            throw new Rejected(type.wireName() + " needs stepKey");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        String detail = "";
        allow(type, "questionIndex", e.questionIndex(), EventType.QUIZ_ANSWERED);
        allow(type, "correct", e.correct(), EventType.QUIZ_ANSWERED);
        allow(type, "optionIndex", e.optionIndex(), EventType.CHOICE_MADE);
        allow(type, "mode", e.mode(), EventType.SIMULATION_STARTED, EventType.MODE_SWITCHED);
        allow(type, "durationMs", e.durationMs(), EventType.STEP_VIEWED, EventType.SIMULATION_COMPLETED);
        allow(type, "targetType", e.targetType(), EventType.CROSS_LINK_FOLLOWED);
        allow(type, "targetSlug", e.targetSlug(), EventType.CROSS_LINK_FOLLOWED);
        allow(type, "shown", e.shown(), EventType.LEGEND_TOGGLE);
        allow(type, "year", e.year(), EventType.TIME_SLIDER_USED);

        switch (type) {
            case QUIZ_ANSWERED -> {
                int q = required(e.questionIndex(), "questionIndex");
                if (q < 0 || q > 4) throw new Rejected("questionIndex 0–4");
                payload.put("correct", required(e.correct(), "correct"));
                detail = "q" + q;
            }
            case CHOICE_MADE -> {
                int o = required(e.optionIndex(), "optionIndex");
                if (o < 0 || o > 3) throw new Rejected("optionIndex 0–3");
                detail = "o" + o;
            }
            case MODE_SWITCHED, SIMULATION_STARTED -> {
                if (type == EventType.MODE_SWITCHED) required(e.mode(), "mode");
                if (e.mode() != null) {
                    if (!MODES.contains(e.mode())) throw new Rejected("mode: story or learn");
                    detail = e.mode();
                }
            }
            case CROSS_LINK_FOLLOWED -> {
                String t = required(e.targetType(), "targetType").toUpperCase(Locale.ROOT);
                try {
                    EntityType.valueOf(t);
                } catch (IllegalArgumentException x) {
                    throw new Rejected("targetType is not an entity type");
                }
                if (!Slugs.isValid(e.targetSlug())) throw new Rejected("targetSlug is not a slug");
                detail = t.toLowerCase(Locale.ROOT) + ":" + e.targetSlug();
            }
            case LEGEND_TOGGLE -> detail = required(e.shown(), "shown") ? "shown" : "hidden";
            case TIME_SLIDER_USED -> {
                int y = required(e.year(), "year");
                if (y < -3000 || y > 2100) throw new Rejected("year out of range");
                detail = Integer.toString(y);
            }
            default -> { }
        }
        if (e.durationMs() != null) {
            if (e.durationMs() < 0 || e.durationMs() > MAX_DURATION_MS) throw new Rejected("durationMs 0–3600000");
            payload.put("durationMs", e.durationMs());
        }
        return new Accepted(type, occurredAt(e.occurredAt(), receivedAt), ownerType, ownerType == null ? null : e.ownerSlug(),
                e.stepKey(), detail, payload);
    }

    /** The client's time when plausible, else the receiving time. */
    static Instant occurredAt(Instant client, Instant receivedAt) {
        if (client == null || client.isBefore(receivedAt.minus(MAX_AGE)) || client.isAfter(receivedAt.plus(MAX_AHEAD))) {
            return receivedAt;
        }
        return client;
    }

    private static void allow(EventType type, String field, Object value, EventType... types) throws Rejected {
        if (value == null) return;
        for (EventType t : types) if (t == type) return;
        throw new Rejected(type.wireName() + " has no " + field);
    }

    private static <T> T required(T value, String field) throws Rejected {
        if (value == null) throw new Rejected(field + " is required");
        return value;
    }
}
