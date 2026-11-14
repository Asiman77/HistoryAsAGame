package az.tarix.platform.media.internal.domain;

/** Where a registered file lives (ADR-0017). */
public enum Origin {
    /** An object in the media bucket, uploaded through a presigned URL. */
    UPLOAD,
    /** A path under the frontend's {@code public/} folder or an absolute URL, served as written. */
    LINKED
}
