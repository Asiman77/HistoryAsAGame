package az.tarix.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

class ModularityTests {

    static final ApplicationModules MODULES = ApplicationModules.of(PlatformApplication.class);

    @Test
    void modulesRespectTheirBoundaries() {
        MODULES.verify();
    }

    @Test
    void allPlannedModulesExist() {
        assertThat(MODULES.stream().map(m -> m.getIdentifier().toString()))
                .contains("shared", "identity", "editorial", "publishing", "catalog", "geo", "chronology",
                        "theming", "media", "analytics");
    }

    /**
     * Regenerates the module diagrams and canvases in docs/modules (committed). Written to
     * target/ first and copied only where something really changed (see {@link StableFiles}).
     */
    @Test
    void writeDocumentation() {
        Path scratch = Path.of("target", "modulith-docs");
        new Documenter(MODULES, Documenter.Options.defaults().withOutputFolder(scratch.toString()))
                .writeDocumentation();
        StableFiles.copyTree(scratch, Path.of("..", "docs", "modules"));
    }
}
