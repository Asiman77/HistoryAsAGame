package az.tarix.platform.theming.internal.projection;

import static az.tarix.platform.shared.content.ContentValues.json;
import static az.tarix.platform.shared.content.ContentValues.text;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.content.MissingDependencyException;
import az.tarix.platform.shared.content.ProjectionWriter;
import az.tarix.platform.shared.content.PublishedContent;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Projects THEME documents (V007). A variant ({@code extends}) is stored as written in
 * {@code raw} and merged over its parent in the other columns, with the rules of the
 * frontend's {@code resolveThemes}: palette, fonts, textures, ornaments and mood tones merge
 * key by key; background art, ambient effect, map style and music replace. When a theme
 * changes, its variants are merged again.
 */
@Component
class ThemingProjectionWriter implements ProjectionWriter {

    static final String UPSERT = """
            INSERT INTO theme (slug, name, extends_slug, raw, palette, fonts, textures, ornaments, background_art,
                               mood_overrides, ambient_effect, map_style_variant, music_theme_slug, document_id)
            VALUES (:slug, CAST(:name AS jsonb), :extends, CAST(:raw AS jsonb), CAST(:palette AS jsonb), CAST(:fonts AS jsonb),
                    CAST(:textures AS jsonb), CAST(:ornaments AS jsonb), CAST(:art AS jsonb), CAST(:moods AS jsonb),
                    :ambient, :map, :music, :doc)
            ON CONFLICT (slug) DO UPDATE SET
              name = EXCLUDED.name, extends_slug = EXCLUDED.extends_slug, raw = EXCLUDED.raw, palette = EXCLUDED.palette,
              fonts = EXCLUDED.fonts, textures = EXCLUDED.textures, ornaments = EXCLUDED.ornaments,
              background_art = EXCLUDED.background_art, mood_overrides = EXCLUDED.mood_overrides,
              ambient_effect = EXCLUDED.ambient_effect, map_style_variant = EXCLUDED.map_style_variant,
              music_theme_slug = EXCLUDED.music_theme_slug, document_id = EXCLUDED.document_id""";

    static final String RESOLVED = """
            SELECT palette, fonts, textures, ornaments, background_art, mood_overrides,
                   lower(ambient_effect) AS ambient, lower(map_style_variant) AS map, music_theme_slug
            FROM theme WHERE slug = :slug""";

    static final String VARIANTS = "SELECT slug, raw, document_id FROM theme WHERE extends_slug = :slug";

    record Variant(String slug, JsonNode raw, UUID documentId) {}

    /** A theme with every field resolved, in the content spelling (lower-case enums). */
    record Resolved(JsonNode palette, JsonNode fonts, JsonNode textures, JsonNode ornaments, JsonNode backgroundArt,
                    JsonNode moodTones, String ambientEffect, String mapStyleVariant, String musicThemeId) {}

    private final JdbcClient jdbc;

    ThemingProjectionWriter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void delete(UUID documentId) {
        jdbc.sql("DELETE FROM theme WHERE document_id = :doc").param("doc", documentId).update();
    }

    @Override
    public void deleteAll() {
        jdbc.sql("DELETE FROM theme").update();
    }

    @Override
    public void write(PublishedContent doc) {
        if (doc.type() != DocumentType.THEME) return;
        JsonNode raw = doc.part("theme");
        upsert(doc.slug(), raw, doc.documentId());
        // Variants were merged over the old version of this theme: merge them again, all the way down.
        Deque<String> parents = new ArrayDeque<>(List.of(doc.slug()));
        Set<String> seen = new HashSet<>(parents);
        while (!parents.isEmpty()) {
            String parent = parents.pop();
            List<Variant> variants = jdbc.sql(VARIANTS).param("slug", parent).query((rs, n) -> new Variant(
                    rs.getString("slug"), JsonMapper.shared().readTree(rs.getString("raw")), rs.getObject("document_id", UUID.class)))
                    .list();
            for (Variant v : variants) {
                if (!seen.add(v.slug())) continue;
                upsert(v.slug(), v.raw(), v.documentId());
                parents.push(v.slug());
            }
        }
    }

    private void upsert(String slug, JsonNode raw, UUID documentId) {
        Resolved r = resolve(slug, raw);
        jdbc.sql(UPSERT).param("slug", slug).param("name", json(raw.path("name"))).param("extends", text(raw.path("extends")))
                .param("raw", json(raw)).param("palette", json(r.palette())).param("fonts", json(r.fonts()))
                .param("textures", json(r.textures())).param("ornaments", json(r.ornaments()))
                .param("art", json(r.backgroundArt())).param("moods", json(r.moodTones()))
                .param("ambient", upper(r.ambientEffect())).param("map", upper(r.mapStyleVariant()))
                .param("music", r.musicThemeId()).param("doc", documentId).update();
    }

    private Resolved resolve(String slug, JsonNode raw) {
        String parentSlug = text(raw.path("extends"));
        if (parentSlug == null) {
            return new Resolved(raw.path("palette"), raw.path("fonts"), raw.path("textures"), raw.path("ornaments"),
                    orEmptyArray(raw.path("backgroundArt")), orEmptyObject(raw.path("moodTones")),
                    text(raw.path("ambientEffect")), text(raw.path("mapStyleVariant")), text(raw.path("musicThemeId")));
        }
        Resolved parent = parent(parentSlug).orElseThrow(() ->
                new MissingDependencyException("tema '%s' əsas tema '%s' olmadan proyeksiya oluna bilməz".formatted(slug, parentSlug)));
        return new Resolved(
                merge(parent.palette(), raw.path("palette")),
                merge(parent.fonts(), raw.path("fonts")),
                merge(parent.textures(), raw.path("textures")),
                merge(parent.ornaments(), raw.path("ornaments")),
                raw.has("backgroundArt") ? raw.path("backgroundArt") : parent.backgroundArt(),
                merge(parent.moodTones(), raw.path("moodTones")),
                raw.has("ambientEffect") ? text(raw.path("ambientEffect")) : parent.ambientEffect(),
                raw.has("mapStyleVariant") ? text(raw.path("mapStyleVariant")) : parent.mapStyleVariant(),
                raw.has("musicThemeId") ? text(raw.path("musicThemeId")) : parent.musicThemeId());
    }

    private Optional<Resolved> parent(String slug) {
        JsonMapper json = JsonMapper.shared();
        return jdbc.sql(RESOLVED).param("slug", slug).query((rs, n) -> new Resolved(
                json.readTree(rs.getString("palette")), json.readTree(rs.getString("fonts")),
                json.readTree(rs.getString("textures")), json.readTree(rs.getString("ornaments")),
                json.readTree(rs.getString("background_art")), json.readTree(rs.getString("mood_overrides")),
                rs.getString("ambient"), rs.getString("map"), rs.getString("music_theme_slug"))).optional();
    }

    /** {@code {...parent, ...child}}: one level, like the spread in the frontend. */
    static JsonNode merge(JsonNode parent, JsonNode child) {
        ObjectNode out = JsonNodeFactory.instance.objectNode();
        if (parent.isObject()) out.setAll((ObjectNode) parent);
        if (child.isObject()) out.setAll((ObjectNode) child);
        return out;
    }

    private static String upper(String value) {
        return value == null ? null : value.toUpperCase(java.util.Locale.ROOT);
    }

    private static JsonNode orEmptyArray(JsonNode n) {
        return n.isArray() ? n : JsonNodeFactory.instance.arrayNode();
    }

    private static JsonNode orEmptyObject(JsonNode n) {
        return n.isObject() ? n : JsonNodeFactory.instance.objectNode();
    }
}
