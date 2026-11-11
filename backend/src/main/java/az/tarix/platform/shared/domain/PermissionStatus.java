package az.tarix.platform.shared.domain;

/** Rights clearance of a media asset; only GRANTED and NOT_REQUIRED are public. */
public enum PermissionStatus implements DataEnum {
    PENDING, GRANTED, NOT_REQUIRED, DENIED;

    /** Whether an asset with this status may appear in the public API and the export. */
    public boolean isPublic() {
        return this == GRANTED || this == NOT_REQUIRED;
    }
}
