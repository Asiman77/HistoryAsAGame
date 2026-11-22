package az.tarix.platform.chronology.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.read.PreviewSource;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Editorial preview of eras (the whole list, as the public API serves it), polities and rulers. */
@Component
class ChronologyPreview implements PreviewSource {

    private final ChronologyReader reader;

    ChronologyPreview(ChronologyReader reader) {
        this.reader = reader;
    }

    @Override
    public Map<String, Object> preview(DocumentType type, String slug, ReadContext ctx) {
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            switch (type) {
                case ERA -> out.put("eras", reader.eras(ctx));
                case POLITY -> out.put("polity", reader.polity(ctx, slug));
                case RULER -> out.put("ruler", reader.ruler(ctx, slug));
                default -> { }
            }
        } catch (ResourceNotFoundException e) {
            // not part of the public API in this state
        }
        return out;
    }
}
