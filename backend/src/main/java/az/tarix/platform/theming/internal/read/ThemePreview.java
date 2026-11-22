package az.tarix.platform.theming.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.read.PreviewSource;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Editorial preview of a theme, with its parent merged in as the public API serves it. */
@Component
class ThemePreview implements PreviewSource {

    private final ThemeReader reader;

    ThemePreview(ThemeReader reader) {
        this.reader = reader;
    }

    @Override
    public Map<String, Object> preview(DocumentType type, String slug, ReadContext ctx) {
        if (type != DocumentType.THEME) return Map.of();
        try {
            return Map.of("theme", reader.theme(ctx, slug));
        } catch (ResourceNotFoundException e) {
            return Map.of();
        }
    }
}
