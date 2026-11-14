package az.tarix.platform.media.internal.projection;

import static az.tarix.platform.shared.content.ContentValues.enumName;
import static az.tarix.platform.shared.content.ContentValues.integer;
import static az.tarix.platform.shared.content.ContentValues.json;
import static az.tarix.platform.shared.content.ContentValues.text;

import az.tarix.platform.shared.content.ProjectionWriter;
import az.tarix.platform.shared.content.PublishedContent;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Projects a person's portraits by age and SOUNDTRACK_TRACK documents (V008). The file
 * reference is kept as written (V011) and {@code media_id} points at the registered asset when
 * there is one (ADR-0017); whether it is shown is decided when reading, by the registry.
 */
@Component
class MediaProjectionWriter implements ProjectionWriter {

    /** The registered asset for a content reference ({@code media:<id>} or a linked path), or NULL. */
    static final String MEDIA_ID = """
            (SELECT id FROM media_asset
             WHERE (origin = 'LINKED' AND storage_key = CAST(:ref AS text))
                OR (CAST(:ref AS text) LIKE 'media:%' AND CAST(id AS text) = substr(CAST(:ref AS text), 7)))""";

    static final String INSERT_PORTRAIT = """
            INSERT INTO portrait (owner_type, owner_slug, age_from, age_to, kind, alt, caption, prompt_id, sort_order, image,
                                  media_id, document_id)
            VALUES (:ownerType, :owner, :from, :to, :kind, CAST(:alt AS jsonb), CAST(:caption AS jsonb), :prompt, :sort,
                    CAST(:image AS jsonb), """ + MEDIA_ID + ", :doc)";

    static final String INSERT_TRACK = """
            INSERT INTO soundtrack_track (slug, conflict_slug, title, performer, moods, license, permission_status,
                                          rights_holder, file_path, media_id, document_id)
            VALUES (:slug, :conflict, CAST(:title AS jsonb), :performer, CAST(:moods AS text[]), :license, :permission,
                    :rights, :file, """ + MEDIA_ID + ", :doc)";

    /** Fields of an AgePortrait that describe the image file itself. */
    private static final String[] IMAGE_FIELDS = {"src", "license", "author", "source", "sourceUrl"};

    private final JdbcClient jdbc;

    MediaProjectionWriter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void delete(UUID documentId) {
        jdbc.sql("DELETE FROM portrait WHERE document_id = :doc").param("doc", documentId).update();
        jdbc.sql("DELETE FROM soundtrack_track WHERE document_id = :doc").param("doc", documentId).update();
    }

    @Override
    public void deleteAll() {
        jdbc.sql("DELETE FROM portrait").update();
        jdbc.sql("DELETE FROM soundtrack_track").update();
    }

    @Override
    public void write(PublishedContent doc) {
        switch (doc.type()) {
            case PERSON -> portraits(doc);
            case SOUNDTRACK_TRACK -> track(doc);
            default -> { }
        }
    }

    private void portraits(PublishedContent doc) {
        int sort = 0;
        for (JsonNode p : doc.part("person").path("portraits")) {
            jdbc.sql(INSERT_PORTRAIT).param("ownerType", "PERSON").param("owner", doc.slug())
                    .param("from", integer(p.path("ageFrom"))).param("to", integer(p.path("ageTo")))
                    .param("kind", enumName(p.path("kind"))).param("alt", json(p.path("alt")))
                    .param("caption", json(p.path("caption"))).param("prompt", text(p.path("promptId")))
                    .param("sort", sort++).param("image", p.has("src") ? json(image(p)) : null).param("ref", text(p.path("src")))
                    .param("doc", doc.documentId()).update();
        }
    }

    private static ObjectNode image(JsonNode portrait) {
        ObjectNode out = JsonNodeFactory.instance.objectNode();
        for (String f : IMAGE_FIELDS) if (portrait.has(f)) out.set(f, portrait.get(f));
        return out;
    }

    private void track(PublishedContent doc) {
        JsonNode t = doc.part("track");
        String mood = enumName(t.path("mood"));
        jdbc.sql(INSERT_TRACK).param("slug", doc.slug()).param("conflict", text(doc.part("conflictId")))
                .param("title", json(t.path("title"))).param("performer", text(t.path("performer")))
                .param("moods", mood == null ? new String[0] : new String[] {mood})
                .param("license", text(t.path("license"))).param("permission", enumName(t.path("permissionStatus")))
                .param("rights", text(t.path("rightsHolder"))).param("file", text(t.path("file"))).param("ref", text(t.path("file")))
                .param("doc", doc.documentId()).update();
    }
}
