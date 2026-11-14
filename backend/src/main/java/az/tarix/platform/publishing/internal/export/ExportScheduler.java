package az.tarix.platform.publishing.internal.export;

import az.tarix.platform.publishing.api.ContentProjected;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.context.event.EventListener;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs the static export after publishing, debounced (BACKEND_SPEC.md §9.6, §15): publishes
 * within {@code debounce} of each other become one export; a steady stream of publishes still
 * exports at least every {@code max-delay}. On startup a missing or older export is caught up.
 */
@Component
@EnableConfigurationProperties(ExportScheduler.ExportProperties.class)
class ExportScheduler {

    private static final Logger log = LoggerFactory.getLogger(ExportScheduler.class);

    /**
     * {@code platform.export.*}.
     *
     * @param enabled  off where there is no bucket (most tests)
     * @param debounce quiet time after the last publish
     * @param maxDelay longest wait while publishes keep coming
     */
    @ConfigurationProperties("platform.export")
    record ExportProperties(@DefaultValue("true") boolean enabled, @DefaultValue("30s") Duration debounce,
                            @DefaultValue("5m") Duration maxDelay) {}

    /** When the oldest and the newest unexported change happened; null: nothing pending. */
    record Pending(Instant first, Instant last) {}

    private final StaticExporter exporter;
    private final ExportProperties props;
    private final Clock clock;
    private Pending pending;

    ExportScheduler(StaticExporter exporter, ExportProperties props, Clock clock) {
        this.exporter = exporter;
        this.props = props;
        this.clock = clock;
    }

    @ApplicationModuleListener
    void on(ContentProjected event) {
        changed();
    }

    @EventListener(ApplicationReadyEvent.class)
    void onStartup() {
        if (!props.enabled()) return;
        try {
            if (exporter.exportedVersion() < exporter.currentVersion()) changed();
        } catch (RuntimeException e) {
            log.warn("could not compare the export with the content; exporting on the next change", e);
        }
    }

    synchronized void changed() {
        if (!props.enabled()) return;
        Instant now = clock.instant();
        pending = new Pending(pending == null ? now : pending.first(), now);
    }

    @Scheduled(fixedDelayString = "${platform.export.poll:5s}", initialDelayString = "${platform.export.poll:5s}")
    void tick() {
        if (due(clock.instant())) run();
    }

    /** Whether an export should start now; takes the pending state when it does. */
    synchronized boolean due(Instant now) {
        if (pending == null) return false;
        boolean quiet = !now.isBefore(pending.last().plus(props.debounce()));
        boolean overdue = !now.isBefore(pending.first().plus(props.maxDelay()));
        if (!quiet && !overdue) return false;
        pending = null;     // changes during the export mark it pending again
        return true;
    }

    private void run() {
        try {
            exporter.export();
        } catch (RuntimeException e) {
            log.error("static export failed; retrying on the next tick", e);
            changed();
        }
    }

    synchronized Pending pending() {
        return pending;
    }
}
