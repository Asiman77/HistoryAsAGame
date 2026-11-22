package az.tarix.platform.media.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.read.PreviewSource;
import az.tarix.platform.shared.read.ReadContext;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Editorial preview of a soundtrack track: present only when the public API would play it
 * (licence and permission allow it), as in {@code GET /soundtracks}.
 */
@Component
class MediaPreview implements PreviewSource {

    private final SoundtrackReader reader;

    MediaPreview(SoundtrackReader reader) {
        this.reader = reader;
    }

    @Override
    public Map<String, Object> preview(DocumentType type, String slug, ReadContext ctx) {
        if (type != DocumentType.SOUNDTRACK_TRACK) return Map.of();
        return reader.tracks(ctx, null, null).stream().filter(t -> t.slug().equals(slug)).findFirst()
                .<Map<String, Object>>map(t -> Map.of("track", t)).orElse(Map.of());
    }
}
