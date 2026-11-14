package az.tarix.platform;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * PostgreSQL + PostGIS and SeaweedFS (S3), the same images as docker/docker-compose.yml
 * (versions pinned in pom.xml), and a {@link QueryCounter} around the DataSource.
 *
 * <p>Without Docker, point the tests at a dedicated, empty PostGIS database instead: when
 * {@code spring.datasource.url} is set (e.g. {@code -Dspring.datasource.url=jdbc:postgresql://localhost:55432/tarix_test}),
 * no container is started. The tests truncate its tables. The media tests then need an S3
 * endpoint too ({@code -Dplatform.media.s3.endpoint=http://localhost:18333}, a store with the
 * {@link #S3_CONFIG} identities); without one they are skipped.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    static final String IMAGE = System.getProperty("postgis.image", "postgis/postgis:18-3.7");
    static final String SEAWEEDFS_IMAGE = System.getProperty("seaweedfs.image", "chrislusf/seaweedfs:4.50");

    public static final String S3_ACCESS_KEY = "test-access";
    public static final String S3_SECRET_KEY = "test-secret-key";

    /** One identity for the backend, anonymous read on the public buckets (as docker/init/s3-entrypoint.sh). */
    static final String S3_CONFIG = """
            {"identities": [
              {"name": "platform", "credentials": [{"accessKey": "%s", "secretKey": "%s"}],
               "actions": ["Admin", "Read", "Write", "List", "Tagging"]},
              {"name": "anonymous", "actions": ["Read:media", "Read:public-content"]}
            ]}""".formatted(S3_ACCESS_KEY, S3_SECRET_KEY);

    /** Containers only when no external database is given (a Docker run, e.g. CI). */
    static final String DOCKER = "'${spring.datasource.url:}'.isEmpty()";

    @Bean
    @ServiceConnection
    @ConditionalOnExpression(DOCKER)
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer(DockerImageName.parse(IMAGE).asCompatibleSubstituteFor("postgres"));
    }

    @Bean
    @ConditionalOnExpression(DOCKER + " and '${platform.media.s3.endpoint:}'.isEmpty()")
    GenericContainer<?> seaweedfs() {
        return new GenericContainer<>(DockerImageName.parse(SEAWEEDFS_IMAGE))
                .withCopyToContainer(Transferable.of(S3_CONFIG), "/etc/seaweedfs/s3.json")
                .withCommand("server", "-dir=/data", "-s3", "-s3.config=/etc/seaweedfs/s3.json")
                .withExposedPorts(8333)
                .waitingFor(Wait.forHttp("/healthz").forPort(8333));
    }

    @Bean
    @ConditionalOnExpression(DOCKER + " and '${platform.media.s3.endpoint:}'.isEmpty()")
    DynamicPropertyRegistrar s3Properties(GenericContainer<?> seaweedfs) {
        // The keys are set by @IntegrationTest.
        return registry -> registry.add("platform.media.s3.endpoint",
                () -> "http://" + seaweedfs.getHost() + ":" + seaweedfs.getMappedPort(8333));
    }

    @Bean
    static QueryCounter queryCounter() {
        return new QueryCounter();
    }
}
