package az.tarix.platform.shared.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** ADR-0010: licence text → permission status; anything unclear stays PENDING. */
class PermissionStatusTests {

    @Test
    void explicitStatusWins() {
        assertThat(PermissionStatus.fromLicense("pending", "Public domain", null)).isEqualTo(PermissionStatus.PENDING);
        assertThat(PermissionStatus.fromLicense("granted", null, null)).isEqualTo(PermissionStatus.GRANTED);
    }

    @Test
    void freeLicencesNeedNoPermission() {
        assertThat(PermissionStatus.fromLicense(null, "Public domain", null)).isEqualTo(PermissionStatus.NOT_REQUIRED);
        assertThat(PermissionStatus.fromLicense(null, " cc0 1.0 (Met Open Access)", null)).isEqualTo(PermissionStatus.NOT_REQUIRED);
        assertThat(PermissionStatus.fromLicense(null, "Layihə lisenziyası", null)).isEqualTo(PermissionStatus.NOT_REQUIRED);
        assertThat(PermissionStatus.fromLicense(null, "CC BY-SA 4.0", null)).isEqualTo(PermissionStatus.NOT_REQUIRED);
        assertThat(PermissionStatus.fromLicense(null, null, "own")).isEqualTo(PermissionStatus.NOT_REQUIRED);
    }

    @Test
    void anythingElseIsPending() {
        assertThat(PermissionStatus.fromLicense(null, null, null)).isEqualTo(PermissionStatus.PENDING);
        assertThat(PermissionStatus.fromLicense(null, "© Müəllif, bütün hüquqlar qorunur", null)).isEqualTo(PermissionStatus.PENDING);
        assertThat(PermissionStatus.fromLicense(" ", "All rights reserved", "photo")).isEqualTo(PermissionStatus.PENDING);
    }
}
