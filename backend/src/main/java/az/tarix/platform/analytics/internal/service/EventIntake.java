package az.tarix.platform.analytics.internal.service;

import az.tarix.platform.analytics.internal.domain.EventRules;
import az.tarix.platform.analytics.internal.domain.EventRules.Accepted;
import az.tarix.platform.analytics.internal.domain.IncomingEvent;
import az.tarix.platform.identity.api.ClassGroups;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Stores a batch of anonymous learning events (BACKEND_SPEC.md §12). Each event is checked on
 * its own: a bad one is reported and skipped, the others are kept. A class code that does not
 * exist is dropped (the events still count, only not for a class).
 */
@Service
public class EventIntake {

    static final String INSERT = """
            INSERT INTO learning_event (received_at, occurred_at, session_id, event_type, owner_type, owner_slug, step_key,
                                        class_code, detail, payload)
            VALUES (:received, :occurred, :session, :type, :ownerType, :ownerSlug, :stepKey, :classCode, :detail,
                    CAST(:payload AS jsonb))""";

    /** What happened to a batch. {@code classCode}: whether the class code was known and kept. */
    public record Result(int accepted, List<Rejection> rejected, boolean classCode) {}

    /** An event that was not stored: its position in the batch and why. */
    public record Rejection(int index, String reason) {}

    private final JdbcClient jdbc;
    private final ClassGroups classes;
    private final PartitionMaintenance partitions;
    private final Clock clock;

    EventIntake(JdbcClient jdbc, ClassGroups classes, PartitionMaintenance partitions, Clock clock) {
        this.jdbc = jdbc;
        this.classes = classes;
        this.partitions = partitions;
        this.clock = clock;
    }

    @Transactional
    public Result accept(UUID session, String classCode, List<IncomingEvent> events) {
        Instant received = clock.instant();
        String code = classCode == null ? null : classes.byCode(classCode).map(ClassGroups.ClassGroupRef::code).orElse(null);
        List<Accepted> ok = new ArrayList<>();
        List<Rejection> rejected = new ArrayList<>();
        for (int i = 0; i < events.size(); i++) {
            try {
                ok.add(EventRules.check(events.get(i), received));
            } catch (EventRules.Rejected e) {
                rejected.add(new Rejection(i, e.getMessage()));
            }
        }
        if (!ok.isEmpty()) {
            partitions.ensureFor(received);
            for (Accepted a : ok) insert(a, session, code, received);
        }
        return new Result(ok.size(), rejected, code != null);
    }

    private void insert(Accepted a, UUID session, String classCode, Instant received) {
        jdbc.sql(INSERT).param("received", Timestamp.from(received)).param("occurred", Timestamp.from(a.occurredAt()))
                .param("session", session).param("type", a.type().wireName()).param("ownerType", a.ownerType())
                .param("ownerSlug", a.ownerSlug()).param("stepKey", a.stepKey()).param("classCode", classCode)
                .param("detail", a.detail()).param("payload", JsonMapper.shared().writeValueAsString(a.payload())).update();
    }
}
