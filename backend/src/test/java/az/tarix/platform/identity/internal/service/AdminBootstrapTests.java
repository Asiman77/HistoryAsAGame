package az.tarix.platform.identity.internal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.IntegrationTest;
import az.tarix.platform.identity.internal.persistence.AppUserRepository;
import java.time.Clock;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;

@IntegrationTest
class AdminBootstrapTests {

    @Autowired
    AppUserRepository users;

    @Autowired
    PasswordEncoder passwords;

    @Autowired
    IdentityProperties props;

    @Autowired
    JdbcClient jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.sql("DELETE FROM app_user WHERE email <> :admin").param("admin", IntegrationTest.ADMIN_EMAIL).update();
    }

    AdminBootstrap bootstrap(String email, String password) {
        IdentityProperties p = new IdentityProperties(props.jwtSecret(), props.issuer(), props.accessTokenTtl(),
                props.refreshTokenTtl(), new IdentityProperties.Admin(email, password, "Admin"));
        return new AdminBootstrap(users, passwords, p, Clock.systemUTC());
    }

    @Test
    void neverChangesAnExistingAccount() {
        String hashBefore = users.findByEmail(IntegrationTest.ADMIN_EMAIL).orElseThrow().passwordHash();
        bootstrap(IntegrationTest.ADMIN_EMAIL, "a different long passphrase").run(null);
        assertThat(users.findByEmail(IntegrationTest.ADMIN_EMAIL).orElseThrow().passwordHash()).isEqualTo(hashBefore);
        assertThat(users.findAll()).hasSize(1);
    }

    @Test
    void refusesAWeakBootstrapPassword() {
        assertThatThrownBy(() -> bootstrap("second-admin@test.invalid", "admin123").run(null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("password policy");
        assertThat(users.findByEmail("second-admin@test.invalid")).isEmpty();
    }

    @Test
    void doesNothingWhenNotConfigured() {
        bootstrap(null, null).run(null);
        assertThat(users.findAll()).hasSize(1);
    }

    @Test
    void lifetimesComeFromConfiguration() {
        assertThat(props.accessTokenTtl()).isEqualTo(Duration.ofMinutes(15));
        assertThat(props.refreshTokenTtl()).isEqualTo(Duration.ofDays(14));
    }
}
