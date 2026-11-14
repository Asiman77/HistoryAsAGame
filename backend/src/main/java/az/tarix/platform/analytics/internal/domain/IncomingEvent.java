package az.tarix.platform.analytics.internal.domain;

import java.time.Instant;

/**
 * One event as the client sends it. These are all the fields there are: a field that is not
 * listed here makes the whole request a 400, so personal data cannot slip in by accident
 * (BACKEND_SPEC.md §12). Which of them an event type may carry: {@link EventType}.
 *
 * @param type          {@code simulation_started}, {@code step_viewed}, …
 * @param occurredAt    client time; clamped to the receiving time when implausible
 * @param ownerType     {@code person}, {@code conflict} or {@code state}
 * @param questionIndex which question of the step's quiz (0–4)
 * @param optionIndex   which option of the step's choice (0–3)
 * @param mode          {@code story} or {@code learn}
 * @param durationMs    time spent, at most an hour
 * @param targetType    of a followed cross-link: an EntityRef type ({@code battle}, {@code place}…)
 * @param shown         legends shown after the toggle
 * @param year          of the time slider
 */
public record IncomingEvent(String type, Instant occurredAt, String ownerType, String ownerSlug, String stepKey,
                            Integer questionIndex, Boolean correct, Integer optionIndex, String mode, Long durationMs,
                            String targetType, String targetSlug, Boolean shown, Integer year) {}
