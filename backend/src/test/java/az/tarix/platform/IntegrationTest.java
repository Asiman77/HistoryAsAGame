package az.tarix.platform;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Full application on a random port against PostgreSQL + PostGIS (Testcontainers).
 * Every test class with this annotation shares one Spring context and one database container,
 * so tests must clean up the rows they create.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        // Test-only values; real ones come from the environment.
        "platform.identity.jwt-secret=" + IntegrationTest.JWT_SECRET,
        "platform.identity.admin.email=" + IntegrationTest.ADMIN_EMAIL,
        "platform.identity.admin.password=" + IntegrationTest.ADMIN_PASSWORD,
})
@Import(TestcontainersConfiguration.class)
public @interface IntegrationTest {

    String JWT_SECRET = "dGVzdC1vbmx5LWp3dC1zZWNyZXQtZm9yLWludGVncmF0aW9uLXRlc3RzLTAxMjM0NTY3ODk=";
    String ADMIN_EMAIL = "admin@test.invalid";
    String ADMIN_PASSWORD = "correct horse battery staple";
}
