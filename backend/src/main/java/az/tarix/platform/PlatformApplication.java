package az.tarix.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

/**
 * Modular monolith. Every direct sub-package is an application module; other modules may
 * only use its {@code api} package (see docs/ARCHITECTURE.md and ModularityTests).
 */
@Modulithic(sharedModules = "shared")
@SpringBootApplication
public class PlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(PlatformApplication.class, args);
    }
}
