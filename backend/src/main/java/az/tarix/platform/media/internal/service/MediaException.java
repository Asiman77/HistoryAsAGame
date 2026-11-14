package az.tarix.platform.media.internal.service;

/** A media request that cannot be done; mapped to Problem Details by the web layer. */
public class MediaException extends RuntimeException {

    public enum Kind { NOT_FOUND, FORBIDDEN, CONFLICT, INVALID, TOO_LARGE, PRECONDITION_REQUIRED, PRECONDITION_FAILED }

    private final Kind kind;
    private final String code;
    private final Long currentVersion;

    private MediaException(Kind kind, String code, String message, Long currentVersion) {
        super(message);
        this.kind = kind;
        this.code = code;
        this.currentVersion = currentVersion;
    }

    public static MediaException notFound() {
        return new MediaException(Kind.NOT_FOUND, "not-found", "Media tapılmadı.", null);
    }

    public static MediaException forbidden(String code, String message) {
        return new MediaException(Kind.FORBIDDEN, code, message, null);
    }

    public static MediaException conflict(String code, String message) {
        return new MediaException(Kind.CONFLICT, code, message, null);
    }

    public static MediaException invalid(String code, String message) {
        return new MediaException(Kind.INVALID, code, message, null);
    }

    public static MediaException tooLarge(String message) {
        return new MediaException(Kind.TOO_LARGE, "file-too-large", message, null);
    }

    public static MediaException preconditionRequired(long current) {
        return new MediaException(Kind.PRECONDITION_REQUIRED, "precondition-required",
                "If-Match başlığı məcburidir (mediaın ETag-ı).", current);
    }

    public static MediaException preconditionFailed(long current) {
        return new MediaException(Kind.PRECONDITION_FAILED, "precondition-failed",
                "Media başqası tərəfindən dəyişdirilib; yenidən oxuyun.", current);
    }

    public Kind kind() {
        return kind;
    }

    public String code() {
        return code;
    }

    /** The asset's version for the ETag of a 412/428 answer, or null. */
    public Long currentVersion() {
        return currentVersion;
    }
}
