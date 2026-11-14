package az.tarix.platform.media.internal.storage;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;

/**
 * {@code platform.media.*}: the S3 bucket for uploads and how uploaded files are served
 * (ADR-0008, ADR-0017). Credentials come only from the environment.
 *
 * @param s3            the S3-compatible store
 * @param publicBaseUrl where the bucket's objects can be read publicly (a CDN or the bucket's own
 *                      public URL), without a trailing slash; empty: {@code <presign endpoint>/<bucket>}
 * @param uploadUrlTtl  how long a presigned upload URL is valid
 * @param orphanTtl     uploaded objects that were never registered are deleted after this
 * @param maxSize       largest accepted file per media type
 */
@ConfigurationProperties("platform.media")
public record MediaProperties(
        @DefaultValue S3 s3,
        String publicBaseUrl,
        @DefaultValue("15m") Duration uploadUrlTtl,
        @DefaultValue("24h") Duration orphanTtl,
        @DefaultValue MaxSize maxSize) {

    /**
     * @param endpoint     e.g. {@code http://s3:8333}; empty: the AWS endpoint of {@code region}
     * @param presignEndpoint the endpoint as browsers reach it, used in presigned URLs (the host is
     *                     signed); empty: {@code endpoint}. In docker compose the backend reaches
     *                     {@code http://s3:8333}, the browser {@code http://localhost:8333}.
     * @param accessKey    empty: the AWS default credentials chain
     * @param pathStyle    {@code bucket} in the path, not in the host name (SeaweedFS, MinIO)
     * @param createBucket create {@code bucket} on startup when it is missing (tests, local runs)
     */
    public record S3(String endpoint, String presignEndpoint, @DefaultValue("us-east-1") String region, String accessKey, String secretKey,
                     @DefaultValue("media") String bucket, @DefaultValue("true") boolean pathStyle,
                     @DefaultValue("false") boolean createBucket) {

        public URI endpointUri() {
            return endpoint == null || endpoint.isBlank() ? null : URI.create(endpoint.strip());
        }

        public URI presignEndpointUri() {
            return presignEndpoint == null || presignEndpoint.isBlank() ? endpointUri() : URI.create(presignEndpoint.strip());
        }
    }

    public record MaxSize(@DefaultValue("15MB") DataSize image, @DefaultValue("50MB") DataSize audio,
                          @DefaultValue("30MB") DataSize geojson) {}

    /** The public URL prefix of uploaded objects, without a trailing slash; null when it cannot be known. */
    public String objectBaseUrl() {
        String base = publicBaseUrl;
        if (base == null || base.isBlank()) {
            URI endpoint = s3.presignEndpointUri();     // the browser-facing one
            if (endpoint == null) return null;
            base = endpoint.toString().replaceAll("/+$", "") + "/" + s3.bucket();
        }
        return base.strip().replaceAll("/+$", "");
    }
}
