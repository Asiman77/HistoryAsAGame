package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.ApiLink.Direction;
import az.tarix.platform.shared.read.ApiSource;
import az.tarix.platform.shared.read.EntityLinks;
import az.tarix.platform.shared.read.EntityLinks.Target;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Links between entities ({@code entity_relation}), in both directions: a link written in
 * this entity's document is {@code OUTGOING}, one written in another document and pointing
 * here is {@code INCOMING}. Two queries plus the target lookup.
 */
@Component
public class RelationReader {

    /** A row seen from {@code this} entity: {@code other} is the entity at the other end. */
    record Row(Direction direction, EntityType otherType, String otherSlug, String otherStep, String ownStep, String relation,
               JsonNode label, JsonNode note, JsonNode sources) {}

    static final String COLUMNS = "relation_type, label, note, sources";

    /** {@code withSteps}: also the links that start from a step of this entity. */
    static final String OUTGOING = """
            SELECT target_type AS other_type, target_slug AS other_slug, target_step_key AS other_step,
                   source_step_key AS own_step, %s
            FROM entity_relation
            WHERE source_type = :type AND source_slug = :slug AND (:withSteps OR source_step_key IS NULL)
            ORDER BY sort_order, id""".formatted(COLUMNS);

    static final String INCOMING = """
            SELECT source_type AS other_type, source_slug AS other_slug, source_step_key AS other_step,
                   target_step_key AS own_step, %s
            FROM entity_relation
            WHERE target_type = :type AND target_slug = :slug
              AND NOT (source_type = target_type AND source_slug = target_slug)
            ORDER BY source_type, source_slug, sort_order, id""".formatted(COLUMNS);

    private final JdbcClient jdbc;
    private final EntityLinks links;
    private final PublicCache cache;

    RelationReader(JdbcClient jdbc, EntityLinks links, PublicCache cache) {
        this.jdbc = jdbc;
        this.links = links;
        this.cache = cache;
    }

    /**
     * Every link of an entity ({@code /relations}): its own and its steps' outgoing links and all
     * incoming ones. An entity without links, or one that does not exist, has an empty list.
     */
    public List<ApiLink> all(ReadContext ctx, EntityType type, String slug) {
        return cache.get(ctx, "relations", type + ":" + slug, () -> of(type, slug, true, ctx.lang()));
    }

    /**
     * Outgoing links of the entity itself ({@code withSteps}: and of its steps) and every
     * incoming link, outgoing first.
     */
    List<ApiLink> of(EntityType type, String slug, boolean withSteps, Lang lang) {
        List<Row> rows = new java.util.ArrayList<>(query(OUTGOING, Direction.OUTGOING, type, slug, withSteps));
        rows.addAll(query(INCOMING, Direction.INCOMING, type, slug, true));
        EntityLinks.Resolved resolved = links.resolve(rows.stream().map(r -> new Target(r.otherType(), r.otherSlug())).toList());
        return rows.stream().map(r -> toLink(r, resolved, lang)).toList();
    }

    static ApiLink toLink(Row r, EntityLinks.Resolved resolved, Lang lang) {
        Target target = new Target(r.otherType(), r.otherSlug());
        JsonNode name = resolved.name(target);
        return new ApiLink(r.otherType(), r.otherSlug(), r.otherStep(), r.relation(), r.direction(), resolved.available(target),
                lang.text(name != null ? name : r.label()), lang.text(r.label()), lang.text(r.note()), r.ownStep(),
                ApiSource.all(r.sources()));
    }

    private List<Row> query(String sql, Direction direction, EntityType type, String slug, boolean withSteps) {
        return jdbc.sql(sql).param("type", type.name()).param("slug", slug).param("withSteps", withSteps)
                .query((rs, n) -> new Row(direction, EntityType.valueOf(rs.getString("other_type")), rs.getString("other_slug"),
                        rs.getString("other_step"), rs.getString("own_step"), rs.getString("relation_type"),
                        JsonColumns.json(rs, "label"), JsonColumns.json(rs, "note"), JsonColumns.json(rs, "sources")))
                .list();
    }
}
