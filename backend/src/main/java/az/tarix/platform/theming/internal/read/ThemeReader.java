package az.tarix.platform.theming.internal.read;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.MediaFiles;
import az.tarix.platform.shared.read.MediaIndex;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/** Visual themes of the public API ({@code /themes/{slug}}), already merged with their parent. */
@Service
public class ThemeReader {

    /**
     * A layer of the background. {@code url} is null for art drawn in code ({@code procedural})
     * and for placeholders; art whose licence is not public is left out.
     */
    public record BackgroundArt(String url, String procedural, String kind, JsonNode title, String source, String sourceUrl,
                                String license, String focus, String promptId) {}

    /**
     * @param moodOverrides tint per mood ({@code BATTLE → {tint, strength, brightness}})
     * @param ui            dark palette of the new design ({@code ThemeUi}); null when the theme has none
     */
    public record ThemeView(String slug, JsonNode name, String extendsSlug, JsonNode palette, JsonNode fonts, JsonNode textures,
                            JsonNode ornaments, List<BackgroundArt> backgroundArt, JsonNode moodOverrides, String ambientEffect,
                            String mapStyleVariant, String musicThemeSlug, JsonNode ui) {}

    static final String ONE = """
            SELECT slug, name, extends_slug, palette, fonts, textures, ornaments, background_art, mood_overrides,
                   ambient_effect, map_style_variant, music_theme_slug, ui
            FROM theme WHERE slug = :slug""";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final MediaFiles media;

    ThemeReader(JdbcClient jdbc, PublicCache cache, MediaFiles media) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.media = media;
    }

    public ThemeView theme(ReadContext ctx, String slug) {
        return cache.get(ctx, "theme", slug, () -> {
            Lang lang = ctx.lang();
            return jdbc.sql(ONE).param("slug", slug).query((rs, n) -> new ThemeView(rs.getString("slug"),
                    lang.text(JsonColumns.json(rs, "name")), rs.getString("extends_slug"), JsonColumns.json(rs, "palette"),
                    JsonColumns.json(rs, "fonts"), JsonColumns.json(rs, "textures"), JsonColumns.json(rs, "ornaments"),
                    art(JsonColumns.json(rs, "background_art"), lang, media.at(ctx)), upperKeys(JsonColumns.json(rs, "mood_overrides")),
                    rs.getString("ambient_effect"), rs.getString("map_style_variant"), rs.getString("music_theme_slug"),
                    JsonColumns.json(rs, "ui")))
                    .optional().orElseThrow(() -> new ResourceNotFoundException(DocumentType.THEME, slug));
        });
    }

    static List<BackgroundArt> art(JsonNode list, Lang lang, MediaIndex media) {
        List<BackgroundArt> out = new ArrayList<>();
        if (list == null) return out;
        for (JsonNode a : list) {
            String url = null;
            if (a.path("src").isString()) {
                ApiImage image = ApiImage.of(a, lang, media);
                if (image == null) continue;          // a file without public permission is not shown at all
                url = image.url();
            }
            out.add(new BackgroundArt(url, str(a.path("procedural")), upper(str(a.path("kind"))), lang.text(a.path("title")),
                    str(a.path("source")), str(a.path("sourceUrl")), str(a.path("license")), str(a.path("focus")),
                    str(a.path("promptId"))));
        }
        return out;
    }

    /** Mood keys as the API spells enums ({@code battle} → {@code BATTLE}). */
    static JsonNode upperKeys(JsonNode moods) {
        if (moods == null || !moods.isObject()) return moods;
        ObjectNode out = JsonNodeFactory.instance.objectNode();
        for (Map.Entry<String, JsonNode> e : moods.properties()) out.set(upper(e.getKey()), e.getValue());
        return out;
    }

    private static String upper(String s) {
        return s == null ? null : s.replace('-', '_').toUpperCase(Locale.ROOT);
    }

    private static String str(JsonNode node) {
        return node.isString() ? node.stringValue() : null;
    }
}
