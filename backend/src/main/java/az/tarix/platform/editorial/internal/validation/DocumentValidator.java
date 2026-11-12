package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.editorial.api.DocumentType;
import az.tarix.platform.shared.schema.ContentSchemas;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The pre-publish check (BACKEND_SPEC.md §8.3): runs every rule over a revision's content.
 * Rule levels and their reasons: docs/adr/0011-editorial-content-layout.md.
 */
@Component
public class DocumentValidator {

    private static final List<ValidationRule> RULES = List.of(
            new SchemaRule(), new IdentityRule(), new TextAndDateRule(), new StepRule(), new PersonRule(),
            new ReferenceRule(), new MediaRule(), new ConsistencyRule(), new GeometryRule());

    private final ContentSchemas schemas;
    private final ReferenceLookup references;
    private final GeometryCheck geometry;
    private final Set<String> musicThemes;

    public DocumentValidator(ContentSchemas schemas, ReferenceLookup references, GeometryCheck geometry) {
        this.schemas = schemas;
        this.references = references;
        this.geometry = geometry;
        this.musicThemes = loadMusicThemes();
    }

    public List<ValidationIssue> validate(DocumentType type, String slug, JsonNode content) {
        ValidationContext ctx = new ValidationContext(type, slug, content, schemas, references, geometry, musicThemes);
        for (ValidationRule rule : RULES) rule.check(ctx);
        return ctx.issues();
    }

    /** shared/schema/music-themes.json: the valid {@code Theme.musicThemeId} values (ADR-0007). */
    private static Set<String> loadMusicThemes() {
        try (InputStream in = DocumentValidator.class.getClassLoader().getResourceAsStream("schema/music-themes.json")) {
            if (in == null) throw new IllegalStateException("classpath:schema/music-themes.json missing; is shared/schema built?");
            Set<String> out = new HashSet<>();
            for (JsonNode n : JsonMapper.shared().readTree(in).path("musicThemes")) out.add(n.asString());
            return out;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
