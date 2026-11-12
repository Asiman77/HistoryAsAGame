package az.tarix.platform.editorial.internal.importing;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Where the importer reads from (BACKEND_SPEC.md §16). Plain strings: Spring would convert
 * a {@link Path} as a resource and reject relative paths such as {@code ../data}.
 *
 * @param dataDir             the frontend's {@code data/} folder
 * @param builtTerritoriesDir the built polygons ({@code public/data/territories}); may be missing
 */
@ConfigurationProperties("platform.import")
public record ImportProperties(String dataDir, String builtTerritoriesDir) {

    public Path dataPath() {
        return dataDir == null || dataDir.isBlank() ? null : Path.of(dataDir);
    }

    public Path builtTerritoriesPath() {
        return builtTerritoriesDir == null || builtTerritoriesDir.isBlank() ? null : Path.of(builtTerritoriesDir);
    }
}
