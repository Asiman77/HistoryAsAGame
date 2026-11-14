package az.tarix.platform.media.internal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.media.internal.storage.MediaProperties;
import az.tarix.platform.media.internal.storage.ObjectStorage;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import software.amazon.awssdk.core.exception.SdkException;

/** Abandoned uploads are deleted; registered files and fresh uploads are not (ADR-0017). */
@IntegrationTest
class OrphanUploadCleanupTests {

    @Autowired
    OrphanUploadCleanup cleanup;

    @Autowired
    ObjectStorage storage;

    @Autowired
    MediaProperties props;

    @Autowired
    JdbcClient jdbc;

    @BeforeEach
    void s3() {
        assumeTrue(props.s3().endpointUri() != null, "no S3 endpoint (see TestcontainersConfiguration)");
        try {
            storage.ensureBucket();
        } catch (SdkException e) {
            assumeTrue(false, "no S3 endpoint (see TestcontainersConfiguration)");
        }
    }

    @AfterEach
    void cleanUp() {
        jdbc.sql("DELETE FROM media_asset").update();
    }

    String put(String key) throws Exception {
        var upload = storage.presignPut(key, "image/png", java.time.Duration.ofMinutes(5));
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(upload.url().toString()))
                .PUT(HttpRequest.BodyPublishers.ofByteArray(new byte[] {1, 2, 3}));
        upload.headers().forEach(req::header);
        assertThat(HttpClient.newHttpClient().send(req.build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);
        return key;
    }

    @Test
    void deletesOnlyOldUnregisteredUploads() throws Exception {
        String orphan = put("uploads/" + UUID.randomUUID() + ".png");
        String kept = put("uploads/" + UUID.randomUUID() + ".png");
        jdbc.sql("""
                INSERT INTO media_asset (storage_key, origin, media_type, mime_type, size_bytes, checksum, license,
                                         permission_status, created_at, updated_at)
                VALUES (:key, 'UPLOAD', 'IMAGE', 'image/png', 3, '\\x00', 'CC0', 'NOT_REQUIRED', now(), now())""")
                .param("key", kept).update();

        // Nothing is old enough yet: an upload in progress must survive.
        assertThat(cleanup.run(Instant.now().minusSeconds(3600))).isZero();
        assertThat(storage.head(orphan)).isPresent();

        assertThat(cleanup.run(Instant.now().plusSeconds(60))).isGreaterThanOrEqualTo(1);
        assertThat(storage.head(orphan)).isEmpty();
        assertThat(storage.head(kept)).isPresent();
        storage.delete(kept);
    }
}
