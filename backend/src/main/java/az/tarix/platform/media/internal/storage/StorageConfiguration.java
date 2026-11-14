package az.tarix.platform.media.internal.storage;

import java.net.URI;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * S3 client and presigner from {@code platform.media.s3.*} (ADR-0008). Creating them does not
 * connect anywhere, so the application starts without a reachable store; only the media
 * endpoints need it.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(MediaProperties.class)
class StorageConfiguration {

    @Bean(destroyMethod = "close")
    S3Client s3Client(MediaProperties props) {
        MediaProperties.S3 c = props.s3();
        var builder = S3Client.builder().region(Region.of(c.region())).credentialsProvider(credentials(c))
                .httpClientBuilder(UrlConnectionHttpClient.builder())     // JDK HTTP; see pom.xml
                // S3-compatible stores (SeaweedFS, R2…) do not all support the SDK's default checksums.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(c.pathStyle()).build());
        URI endpoint = c.endpointUri();
        if (endpoint != null) builder.endpointOverride(endpoint);
        return builder.build();
    }

    @Bean(destroyMethod = "close")
    S3Presigner s3Presigner(MediaProperties props) {
        MediaProperties.S3 c = props.s3();
        var builder = S3Presigner.builder().region(Region.of(c.region())).credentialsProvider(credentials(c))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(c.pathStyle()).build());
        URI endpoint = c.presignEndpointUri();
        if (endpoint != null) builder.endpointOverride(endpoint);
        return builder.build();
    }

    @Bean
    ObjectStorage objectStorage(S3Client s3, S3Presigner presigner, MediaProperties props) {
        ObjectStorage storage = new ObjectStorage(s3, presigner, props.s3().bucket());
        if (props.s3().createBucket()) storage.ensureBucket();
        return storage;
    }

    private static AwsCredentialsProvider credentials(MediaProperties.S3 c) {
        if (c.accessKey() == null || c.accessKey().isBlank()) return DefaultCredentialsProvider.builder().build();
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(c.accessKey(), c.secretKey()));
    }
}
