package az.tarix.platform.media.internal.read;

import az.tarix.platform.media.api.ApiPortrait;
import az.tarix.platform.media.api.Portraits;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiImage;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.MediaFiles;
import az.tarix.platform.shared.read.MediaIndex;
import az.tarix.platform.shared.read.ReadContext;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Portraits from the {@code portrait} projection. The file reference is kept as written
 * ({@code image}, V011) and resolved against the registry when read (ADR-0017): a file that may
 * not be shown leaves a placeholder.
 */
@Component
class JdbcPortraits implements Portraits {

    static final String OF_OWNER = """
            SELECT age_from, age_to, kind, alt, caption, prompt_id, image
            FROM portrait WHERE owner_type = :type AND owner_slug = :slug
            ORDER BY sort_order""";

    private final JdbcClient jdbc;
    private final MediaFiles media;

    JdbcPortraits(JdbcClient jdbc, MediaFiles media) {
        this.jdbc = jdbc;
        this.media = media;
    }

    @Override
    public List<ApiPortrait> of(String ownerType, String ownerSlug, ReadContext ctx) {
        Lang lang = ctx.lang();
        MediaIndex files = media.at(ctx);
        return jdbc.sql(OF_OWNER).param("type", ownerType).param("slug", ownerSlug).query((rs, n) -> {
            String kind = rs.getString("kind");
            JsonNode alt = JsonColumns.json(rs, "alt");
            JsonNode caption = JsonColumns.json(rs, "caption");
            JsonNode image = JsonColumns.json(rs, "image");
            ObjectNode asImage = image instanceof ObjectNode o ? o.deepCopy() : JsonNodeFactory.instance.objectNode();
            asImage.put("kind", kind.toLowerCase(Locale.ROOT));
            if (alt != null) asImage.set("alt", alt);
            if (caption != null) asImage.set("caption", caption);
            ApiImage file = ApiImage.of(asImage, lang, files);
            JsonNode disclosure = "AI_ILLUSTRATION".equals(kind)
                    ? (caption != null ? lang.text(caption) : lang.text(ApiImage.AI_DISCLOSURE)) : null;
            if (disclosure == null && file != null) disclosure = file.disclosure();
            return new ApiPortrait(rs.getInt("age_from"), rs.getInt("age_to"), kind, file == null ? null : file.url(),
                    lang.text(alt), lang.text(caption), disclosure,
                    file == null ? null : file.license(), file == null ? null : file.author(),
                    file == null ? null : file.source(), file == null ? null : file.sourceUrl(), rs.getString("prompt_id"));
        }).list();
    }
}
