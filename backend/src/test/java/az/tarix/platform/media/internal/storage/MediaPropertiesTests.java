package az.tarix.platform.media.internal.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

/** Where uploaded files are read from (ADR-0017). */
class MediaPropertiesTests {

    static MediaProperties props(String endpoint, String presign, String publicBase) {
        return new MediaProperties(new MediaProperties.S3(endpoint, presign, "us-east-1", "k", "s", "media", "public-content", true, false),
                publicBase, Duration.ofMinutes(15), Duration.ofHours(24),
                new MediaProperties.MaxSize(DataSize.ofMegabytes(15), DataSize.ofMegabytes(50), DataSize.ofMegabytes(30)));
    }

    @Test
    void anExplicitPublicBaseUrlWins() {
        assertThat(props("http://s3:8333", null, "https://cdn.example.az/media/").objectBaseUrl())
                .isEqualTo("https://cdn.example.az/media");
    }

    @Test
    void otherwiseTheBrowserFacingEndpointAndBucket() {
        assertThat(props("http://s3:8333", "http://localhost:8333/", null).objectBaseUrl()).isEqualTo("http://localhost:8333/media");
        assertThat(props("http://s3:8333", " ", "").objectBaseUrl()).isEqualTo("http://s3:8333/media");
    }

    @Test
    void unknownWithoutAnyEndpoint() {
        assertThat(props(null, null, null).objectBaseUrl()).isNull();
    }
}
