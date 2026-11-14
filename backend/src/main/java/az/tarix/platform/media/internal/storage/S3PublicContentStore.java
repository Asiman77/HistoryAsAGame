package az.tarix.platform.media.internal.storage;

import az.tarix.platform.media.api.PublicContentStore;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

/** The static export's bucket over the S3 API (ADR-0008, ADR-0019). */
class S3PublicContentStore implements PublicContentStore {

    private final ObjectStorage bucket;

    S3PublicContentStore(ObjectStorage bucket) {
        this.bucket = bucket;
    }

    ObjectStorage bucket() {
        return bucket;
    }

    @Override
    public void put(String key, byte[] body, String contentType, String cacheControl) {
        bucket.put(key, body, contentType, cacheControl);
    }

    @Override
    public byte[] get(String key) {
        try (InputStream in = bucket.open(key)) {
            return in.readAllBytes();
        } catch (NoSuchKeyException e) {
            return null;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return null;
            throw e;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
