package az.tarix.platform.shared.domain;

import java.util.Locale;

/** Rights clearance of a media asset; only GRANTED and NOT_REQUIRED are public. */
public enum PermissionStatus implements DataEnum {
    PENDING, GRANTED, NOT_REQUIRED, DENIED;

    /** Whether an asset with this status may appear in the public API and the export. */
    public boolean isPublic() {
        return this == GRANTED || this == NOT_REQUIRED;
    }

    /**
     * The status of a file described only by its licence text, as long as there is no media
     * registry (ADR-0010, first matching rule wins). Permission is never assumed: anything not
     * clearly free is PENDING.
     *
     * @param explicitStatus    a {@code permissionStatus} written in the content, or null
     * @param license           the licence text, or null
     * @param backgroundArtKind {@code BackgroundArt.kind} ({@code own} = the project's own work), or null
     */
    public static PermissionStatus fromLicense(String explicitStatus, String license, String backgroundArtKind) {
        if (explicitStatus != null && !explicitStatus.isBlank()) return valueOf(explicitStatus.toUpperCase(Locale.ROOT));
        String l = license == null ? "" : license.strip().toLowerCase(Locale.ROOT);
        if (l.startsWith("public domain") || l.startsWith("cc0")) return NOT_REQUIRED;
        if (l.startsWith("layihə lisenziyası") || "own".equals(backgroundArtKind)) return NOT_REQUIRED;
        if (l.startsWith("cc by")) return NOT_REQUIRED;
        return PENDING;
    }
}
