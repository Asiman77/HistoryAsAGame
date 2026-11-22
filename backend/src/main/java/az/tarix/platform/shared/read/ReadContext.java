package az.tarix.platform.shared.read;

/**
 * What a public API request reads against: the content version (one per publish, used for
 * the ETag and as part of every cache key) and the response language. Controllers receive it
 * as a method argument, resolved once per request.
 */
public record ReadContext(long contentVersion, Lang lang, boolean preview) {

    public ReadContext(long contentVersion, Lang lang) {
        this(contentVersion, lang, false);
    }

    /**
     * The same request as an editorial preview: it reads rows written in a transaction that is
     * rolled back afterwards, so nothing it builds may be cached ({@link PublicCache}).
     */
    public ReadContext asPreview() {
        return new ReadContext(contentVersion, lang, true);
    }

    /**
     * Weak validator {@code W/"cv-<version>-<lang>"}: the representation depends on the
     * content version and the language. Weak, because the body is the same content whether
     * or not it is gzip-compressed.
     */
    public String etag() {
        return "W/\"cv-" + contentVersion + "-" + lang.code() + "\"";
    }
}
