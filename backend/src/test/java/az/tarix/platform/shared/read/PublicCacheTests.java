package az.tarix.platform.shared.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.shared.content.DocumentType;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

class PublicCacheTests {

    final PublicCache cache = new PublicCache(100, Duration.ofHours(1),
            new StaticListableBeanFactory().getBeanProvider(io.micrometer.core.instrument.MeterRegistry.class));
    final AtomicInteger loads = new AtomicInteger();

    String load() {
        return "v" + loads.incrementAndGet();
    }

    @Test
    void theSameVersionLanguageAndKeyIsLoadedOnce() {
        ReadContext ctx = new ReadContext(1, Lang.AZ);
        assertThat(cache.get(ctx, "person", "a", this::load)).isEqualTo("v1");
        assertThat(cache.get(ctx, "person", "a", this::load)).isEqualTo("v1");
        assertThat(cache.get(new ReadContext(1, new Lang("en")), "person", "a", this::load)).isEqualTo("v2");
        assertThat(cache.get(ctx, "person", "b", this::load)).isEqualTo("v3");
        assertThat(cache.get(ctx, "conflict", "a", this::load)).isEqualTo("v4");
    }

    @Test
    void aPreviewIsNeverCachedNorServedFromTheCache() {
        ReadContext ctx = new ReadContext(1, Lang.AZ);
        assertThat(cache.get(ctx.asPreview(), "place", "tebriz", this::load)).isEqualTo("v1");
        assertThat(cache.size()).isZero();
        assertThat(cache.get(ctx, "place", "tebriz", this::load)).isEqualTo("v2");
        assertThat(cache.get(ctx.asPreview(), "place", "tebriz", this::load)).isEqualTo("v3");
        assertThat(cache.get(ctx, "place", "tebriz", this::load)).isEqualTo("v2");
    }

    @Test
    void aNewContentVersionDropsEverything() {
        cache.get(new ReadContext(1, Lang.AZ), "person", "a", this::load);
        cache.get(new ReadContext(1, Lang.AZ), "person", "b", this::load);
        assertThat(cache.size()).isEqualTo(2);
        assertThat(cache.get(new ReadContext(2, Lang.AZ), "person", "a", this::load)).isEqualTo("v3");
        assertThat(cache.size()).isEqualTo(1);
    }

    @Test
    void nullIsCachedButExceptionsAreNot() {
        ReadContext ctx = new ReadContext(1, Lang.AZ);
        assertThat((Object) cache.get(ctx, "x", 1, () -> {
            loads.incrementAndGet();
            return null;
        })).isNull();
        assertThat((Object) cache.get(ctx, "x", 1, this::load)).isNull();
        assertThat(loads).hasValue(1);

        assertThatThrownBy(() -> cache.get(ctx, "y", 1, () -> {
            throw new ResourceNotFoundException(DocumentType.PERSON, "nobody");
        })).isInstanceOf(ResourceNotFoundException.class);
        assertThat(cache.get(ctx, "y", 1, this::load)).isEqualTo("v2");
    }
}
