package az.tarix.platform.shared.read;

/**
 * The media registry for public reads (ADR-0017). Implemented by the media module, used by
 * every module that gives out images or audio, so they need no dependency on it.
 */
public interface MediaFiles {

    /**
     * The registry as of {@code contentVersion}. Every change that affects public output bumps
     * the content version, so the index can be cached per version.
     */
    MediaIndex at(long contentVersion);

    /** Shortcut for a request's context. */
    default MediaIndex at(ReadContext ctx) {
        return at(ctx.contentVersion());
    }
}
