package az.tarix.platform.media.internal.storage;

import java.io.InputStream;
import java.net.URL;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

/**
 * The media bucket over the S3 API (ADR-0008): presigned uploads, metadata, reading, listing
 * and deleting. Nothing else in the code talks to S3.
 */
public class ObjectStorage {

    private static final Logger log = LoggerFactory.getLogger(ObjectStorage.class);

    /** A URL the browser uploads one file to with {@code PUT}, sending exactly {@code headers}. */
    public record PresignedUpload(URL url, Map<String, String> headers, Instant expiresAt) {}

    /** What the store knows about an object. */
    public record ObjectInfo(long size, String contentType, Instant lastModified) {}

    /** One listed object. */
    public record Listed(String key, Instant lastModified) {}

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;

    public ObjectStorage(S3Client s3, S3Presigner presigner, String bucket) {
        this.s3 = s3;
        this.presigner = presigner;
        this.bucket = bucket;
    }

    public String bucket() {
        return bucket;
    }

    /**
     * A presigned {@code PUT} for {@code key}. The content type is part of the signature, so the
     * browser cannot store the file under another type than the one that was checked.
     */
    public PresignedUpload presignPut(String key, String contentType, Duration ttl) {
        PresignedPutObjectRequest req = presigner.presignPutObject(p -> p.signatureDuration(ttl)
                .putObjectRequest(o -> o.bucket(bucket).key(key).contentType(contentType)));
        Map<String, String> headers = Map.of("Content-Type", contentType);
        return new PresignedUpload(req.url(), headers, req.expiration());
    }

    /** The object's size and type, or empty when there is no such object. */
    public Optional<ObjectInfo> head(String key) {
        try {
            HeadObjectResponse h = s3.headObject(r -> r.bucket(bucket).key(key));
            return Optional.of(new ObjectInfo(h.contentLength(), h.contentType(), h.lastModified()));
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return Optional.empty();
            throw e;
        }
    }

    /** Writes an object (replacing it). */
    public void put(String key, byte[] body, String contentType, String cacheControl) {
        s3.putObject(r -> r.bucket(bucket).key(key).contentType(contentType).cacheControl(cacheControl), RequestBody.fromBytes(body));
    }

    /** The object's bytes; the caller closes the stream. */
    public InputStream open(String key) {
        return s3.getObject(r -> r.bucket(bucket).key(key));
    }

    public void delete(String key) {
        s3.deleteObject(r -> r.bucket(bucket).key(key));
    }

    /** Every object under {@code prefix}, page by page. */
    public void list(String prefix, Consumer<List<Listed>> page) {
        ListObjectsV2Request req = ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build();
        s3.listObjectsV2Paginator(req).forEach(res -> page.accept(res.contents().stream()
                .map((S3Object o) -> new Listed(o.key(), o.lastModified())).toList()));
    }

    /** Creates the bucket when it does not exist (tests and local runs; compose has an init container). */
    public void ensureBucket() {
        try {
            s3.headBucket(r -> r.bucket(bucket));
        } catch (NoSuchBucketException e) {
            create();
        } catch (S3Exception e) {
            if (e.statusCode() != 404) throw e;
            create();
        }
    }

    private void create() {
        s3.createBucket(r -> r.bucket(bucket));
        log.info("created bucket {}", bucket);
    }
}
