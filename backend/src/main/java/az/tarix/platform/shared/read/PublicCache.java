package az.tarix.platform.shared.read;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.cache.CaffeineCacheMetrics;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * In-memory cache of public API responses (BACKEND_SPEC.md §14). Every key contains the
 * content version and the language, so a publish can never serve stale content; when a newer
 * version is first seen the whole cache is dropped, so old entries do not linger.
 *
 * <p>No event listener is needed for that (the modules that read cannot depend on
 * {@code publishing}, which depends on them). Values are shared between requests and must
 * not be modified after they are built.
 */
@Component
public class PublicCache {

    record Key(long version, String lang, String name, Object argument) {}

    /** Caffeine does not store null; a missing optional result is cached as an empty holder. */
    private record Holder(Object value) {}

    private final Cache<Key, Holder> cache;
    private final AtomicLong newestVersion = new AtomicLong(Long.MIN_VALUE);

    public PublicCache(@Value("${platform.public-api.cache.max-entries:20000}") long maxEntries,
                       @Value("${platform.public-api.cache.expire-after-access:1h}") Duration expireAfterAccess,
                       ObjectProvider<MeterRegistry> metrics) {
        this.cache = Caffeine.newBuilder().maximumSize(maxEntries).expireAfterAccess(expireAfterAccess).recordStats().build();
        metrics.ifAvailable(registry -> CaffeineCacheMetrics.monitor(registry, cache, "public-api"));
    }

    /**
     * The cached value of {@code name(argument)} for this request's version and language, or
     * {@code loader}'s result, which is then cached. Exceptions (e.g. not found) are not cached.
     */
    @SuppressWarnings("unchecked")
    public <T> T get(ReadContext ctx, String name, Object argument, Supplier<T> loader) {
        // A preview reads rows that are rolled back: caching it would serve unpublished content.
        if (ctx.preview()) return loader.get();
        long version = ctx.contentVersion();
        long previous = newestVersion.getAndAccumulate(version, Math::max);
        if (version > previous && previous != Long.MIN_VALUE) cache.invalidateAll();
        return (T) cache.get(new Key(version, ctx.lang().code(), name, argument), k -> new Holder(loader.get())).value();
    }

    /** Drops everything (tests). */
    public void clear() {
        cache.invalidateAll();
    }

    long size() {
        cache.cleanUp();
        return cache.estimatedSize();
    }
}
