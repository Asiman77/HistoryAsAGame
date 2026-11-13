package az.tarix.platform;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * PostgreSQL + PostGIS, the same image as docker/docker-compose.yml (version pinned in pom.xml),
 * and a {@link QueryCounter} around the DataSource.
 *
 * <p>Without Docker, point the tests at a dedicated, empty PostGIS database instead: when
 * {@code spring.datasource.url} is set (e.g. {@code -Dspring.datasource.url=jdbc:postgresql://localhost:55432/tarix_test}),
 * no container is started. The tests truncate its tables.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    static final String IMAGE = System.getProperty("postgis.image", "postgis/postgis:18-3.7");

    @Bean
    @ServiceConnection
    @ConditionalOnExpression("'${spring.datasource.url:}'.isEmpty()")
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer(DockerImageName.parse(IMAGE).asCompatibleSubstituteFor("postgres"));
    }

    @Bean
    static QueryCounter queryCounter() {
        return new QueryCounter();
    }
}
