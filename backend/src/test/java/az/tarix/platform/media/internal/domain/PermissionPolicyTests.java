package az.tarix.platform.media.internal.domain;

import static az.tarix.platform.shared.domain.PermissionStatus.DENIED;
import static az.tarix.platform.shared.domain.PermissionStatus.GRANTED;
import static az.tarix.platform.shared.domain.PermissionStatus.NOT_REQUIRED;
import static az.tarix.platform.shared.domain.PermissionStatus.PENDING;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.media.internal.domain.PermissionPolicy.Actor;
import az.tarix.platform.media.internal.domain.PermissionPolicy.PolicyViolation;
import org.junit.jupiter.api.Test;

/** Who may set which status, and what a licence change does (ADR-0017; BACKEND_SPEC.md §11). */
class PermissionPolicyTests {

    static final Actor AUTHOR = new Actor(false, false);
    static final Actor REVIEWER = new Actor(false, true);
    static final Actor ADMIN = new Actor(true, false);
    static final String FREE = "Public domain";
    static final String RESTRICTED = "Muzeyin icazəsi ilə";

    @Test
    void aNewFileIsFreeOnlyByItsLicence() {
        assertThat(PermissionPolicy.initial(FREE)).isEqualTo(NOT_REQUIRED);
        assertThat(PermissionPolicy.initial("CC BY-SA 4.0")).isEqualTo(NOT_REQUIRED);
        assertThat(PermissionPolicy.initial(RESTRICTED)).isEqualTo(PENDING);
    }

    @Test
    void onlyAnAdminGrants() {
        assertThat(PermissionPolicy.next(PENDING, GRANTED, RESTRICTED, false, ADMIN)).isEqualTo(GRANTED);
        for (Actor a : new Actor[] {AUTHOR, REVIEWER}) {
            assertThatThrownBy(() -> PermissionPolicy.next(PENDING, GRANTED, RESTRICTED, false, a))
                    .isInstanceOfSatisfying(PolicyViolation.class, e -> {
                        assertThat(e.forbidden()).isTrue();
                        assertThat(e.code()).isEqualTo("grant-requires-admin");
                    });
        }
    }

    @Test
    void reviewersAndAdminsDeny() {
        assertThat(PermissionPolicy.next(PENDING, DENIED, RESTRICTED, false, REVIEWER)).isEqualTo(DENIED);
        assertThat(PermissionPolicy.next(GRANTED, DENIED, RESTRICTED, false, ADMIN)).isEqualTo(DENIED);
        assertThatThrownBy(() -> PermissionPolicy.next(PENDING, DENIED, RESTRICTED, false, AUTHOR))
                .isInstanceOfSatisfying(PolicyViolation.class, e -> assertThat(e.forbidden()).isTrue());
    }

    @Test
    void notRequiredOnlyForAFreeLicence() {
        assertThat(PermissionPolicy.next(PENDING, NOT_REQUIRED, FREE, false, AUTHOR)).isEqualTo(NOT_REQUIRED);
        assertThatThrownBy(() -> PermissionPolicy.next(PENDING, NOT_REQUIRED, RESTRICTED, false, ADMIN))
                .isInstanceOfSatisfying(PolicyViolation.class, e -> {
                    assertThat(e.forbidden()).isFalse();
                    assertThat(e.code()).isEqualTo("permission-not-applicable");
                });
    }

    @Test
    void anyoneMayGoBackToPending() {
        assertThat(PermissionPolicy.next(GRANTED, PENDING, RESTRICTED, false, AUTHOR)).isEqualTo(PENDING);
    }

    @Test
    void newTermsReDeriveTheStatus() {
        // A grant was about the old terms: an author's change drops it, an admin's keeps it.
        assertThat(PermissionPolicy.next(GRANTED, null, RESTRICTED + " (yeni)", true, AUTHOR)).isEqualTo(PENDING);
        assertThat(PermissionPolicy.next(GRANTED, null, RESTRICTED + " (yeni)", true, ADMIN)).isEqualTo(GRANTED);
        // A free licence that becomes restricted is no longer free.
        assertThat(PermissionPolicy.next(NOT_REQUIRED, null, RESTRICTED, true, ADMIN)).isEqualTo(PENDING);
        assertThat(PermissionPolicy.next(PENDING, null, "CC0 1.0", true, AUTHOR)).isEqualTo(NOT_REQUIRED);
        // A denial stands until a reviewer lifts it.
        assertThat(PermissionPolicy.next(DENIED, null, FREE, true, AUTHOR)).isEqualTo(DENIED);
        // Nothing about the terms changed: the status stays.
        assertThat(PermissionPolicy.next(GRANTED, null, RESTRICTED, false, AUTHOR)).isEqualTo(GRANTED);
    }
}
