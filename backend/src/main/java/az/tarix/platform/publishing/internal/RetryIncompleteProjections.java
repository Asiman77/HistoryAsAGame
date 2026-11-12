package az.tarix.platform.publishing.internal;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Resubmits event publications whose listener failed (BACKEND_SPEC.md §9.7), e.g. a projection
 * that hit a missing dependency or a database error. Publications younger than
 * {@code platform.publishing.retry-after} are left alone: they may still be running.
 */
@Component
class RetryIncompleteProjections {

    private static final Logger log = LoggerFactory.getLogger(RetryIncompleteProjections.class);

    private final IncompleteEventPublications incomplete;
    private final Duration retryAfter;

    RetryIncompleteProjections(IncompleteEventPublications incomplete,
                               @Value("${platform.publishing.retry-after:PT1M}") Duration retryAfter) {
        this.incomplete = incomplete;
        this.retryAfter = retryAfter;
    }

    @Scheduled(fixedDelayString = "${platform.publishing.retry-interval:PT1M}", initialDelayString = "${platform.publishing.retry-interval:PT1M}")
    void resubmit() {
        log.debug("resubmitting incomplete event publications older than {}", retryAfter);
        incomplete.resubmitIncompletePublicationsOlderThan(retryAfter);
    }
}
