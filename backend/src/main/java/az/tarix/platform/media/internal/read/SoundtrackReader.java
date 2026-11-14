package az.tarix.platform.media.internal.read;

import az.tarix.platform.shared.domain.Mood;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.ApiImage.Resolved;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.MediaFiles;
import az.tarix.platform.shared.read.MediaIndex;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * {@code GET /soundtracks} (BACKEND_SPEC.md §10.1): only tracks whose recording may be played
 * publicly. A track without a file, or whose file is not GRANTED / NOT_REQUIRED, is left out
 * entirely: its title and performer are part of the rights question too.
 */
@Component
public class SoundtrackReader {

    static final String TRACKS = """
            SELECT slug, conflict_slug, title, performer, moods, license, permission_status, rights_holder, file_path
            FROM soundtrack_track
            WHERE (CAST(:mood AS text) IS NULL OR CAST(:mood AS text) = ANY (moods))
              AND (CAST(:conflict AS text) IS NULL OR conflict_slug = CAST(:conflict AS text))
            ORDER BY conflict_slug NULLS LAST, slug""";

    /**
     * A playable track.
     *
     * @param url path under the site root without extension (the client tries {@code .webm},
     *            then {@code .mp3}) for files that ship with the site, or the full URL of an upload
     */
    public record ApiTrack(String slug, String conflictSlug, JsonNode title, String performer, List<Mood> moods, String license,
                           String rightsHolder, String url) {}

    private record Query(Mood mood, String conflict) {}

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final MediaFiles media;

    SoundtrackReader(JdbcClient jdbc, PublicCache cache, MediaFiles media) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.media = media;
    }

    public List<ApiTrack> tracks(ReadContext ctx, Mood mood, String conflict) {
        return cache.get(ctx, "soundtracks", new Query(mood, conflict), () -> {
            Lang lang = ctx.lang();
            MediaIndex files = media.at(ctx);
            List<ApiTrack> out = new ArrayList<>();
            jdbc.sql(TRACKS).params(params(mood, conflict)).query(rs -> {
                ObjectNode file = JsonNodeFactory.instance.objectNode();
                if (rs.getString("file_path") != null) file.put("file", rs.getString("file_path"));
                file.put("license", rs.getString("license"));
                file.put("permissionStatus", rs.getString("permission_status"));
                Resolved r = ApiImage.resolve(file, "file", files);
                if (r != null) {
                    List<Mood> moods = JsonColumns.strings(rs, "moods").stream().map(Mood::valueOf).toList();
                    out.add(new ApiTrack(rs.getString("slug"), rs.getString("conflict_slug"), lang.text(JsonColumns.json(rs, "title")),
                            rs.getString("performer"), moods, r.license() != null ? r.license() : rs.getString("license"),
                            r.rightsHolder() != null ? r.rightsHolder() : rs.getString("rights_holder"), r.url()));
                }
            });
            return List.copyOf(out);
        });
    }

    private static Map<String, Object> params(Mood mood, String conflict) {
        Map<String, Object> p = new HashMap<>();
        p.put("mood", mood == null ? null : mood.name());
        p.put("conflict", conflict);
        return p;
    }
}
