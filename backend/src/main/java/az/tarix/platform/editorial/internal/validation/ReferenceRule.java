package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.editorial.internal.validation.ReferenceLookup.Target;
import az.tarix.platform.editorial.internal.validation.ValidationContext.Item;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;

/**
 * References to other documents, by slug. Fields the pages need to render (a place, a polity,
 * a theme, an era…) must point at an existing document: ERROR when missing, WARNING when it
 * is not published yet. Cross-links ({@code related}, a commemoration's {@code ref}) may point
 * at future content: INFO only (BACKEND_SPEC.md §5.3).
 */
final class ReferenceRule implements ValidationRule {

    /** Field name → the document type its value names. Matched wherever the field occurs. */
    private static final Map<String, DocumentType> SINGLE = Map.ofEntries(
            Map.entry("placeId", DocumentType.PLACE),
            Map.entry("capitalId", DocumentType.PLACE),
            Map.entry("territorySnapshotId", DocumentType.TERRITORY_SNAPSHOT),
            Map.entry("polityId", DocumentType.POLITY),
            Map.entry("ownPolityId", DocumentType.POLITY),
            Map.entry("enemyPolityId", DocumentType.POLITY),
            Map.entry("vassalOf", DocumentType.POLITY),
            Map.entry("themeId", DocumentType.THEME),
            Map.entry("rulerId", DocumentType.RULER),
            Map.entry("personId", DocumentType.PERSON),
            Map.entry("conflictId", DocumentType.CONFLICT));

    private static final Map<String, DocumentType> MANY = Map.of(
            "eraIds", DocumentType.ERA,
            "rivals", DocumentType.POLITY,
            "allies", DocumentType.POLITY);

    private static final Map<String, String> NAMES = Map.ofEntries(
            Map.entry("PLACE", "məkan"), Map.entry("TERRITORY_SNAPSHOT", "ərazi snapshot-u"), Map.entry("POLITY", "dövlət (polity)"),
            Map.entry("THEME", "tema"), Map.entry("RULER", "hökmdar"), Map.entry("PERSON", "şəxsiyyət"),
            Map.entry("CONFLICT", "müharibə"), Map.entry("ERA", "dövr"), Map.entry("HERO", "qəhrəman"),
            Map.entry("STATE", "dövlət simulyasiyası"));

    /** EntityRef.type values (shared/schema EntityRef) → document types. */
    private static final Map<String, DocumentType> REF_TYPES = Map.of(
            "person", DocumentType.PERSON, "conflict", DocumentType.CONFLICT, "battle", DocumentType.BATTLE,
            "state", DocumentType.STATE, "place", DocumentType.PLACE, "ruler", DocumentType.RULER);

    @Override
    public void check(ValidationContext ctx) {
        ctx.walk((pointer, node) -> {
            if (!node.isObject()) return;
            for (Map.Entry<String, JsonNode> field : node.properties()) {
                String at = pointer + "/" + field.getKey();
                DocumentType single = SINGLE.get(field.getKey());
                if (single != null && field.getValue().isString() && !isSelf(ctx, single, field.getValue().stringValue())) {
                    ctx.requireTarget(single, field.getValue().stringValue(), at, name(single));
                }
                DocumentType many = MANY.get(field.getKey());
                if (many != null && field.getValue().isArray()) {
                    for (int i = 0; i < field.getValue().size(); i++) {
                        JsonNode v = field.getValue().get(i);
                        if (v.isString()) ctx.requireTarget(many, v.stringValue(), at + "/" + i, name(many));
                    }
                }
                if (field.getKey().equals("related") && field.getValue().isArray()) {
                    for (int i = 0; i < field.getValue().size(); i++) entityRef(ctx, at + "/" + i, field.getValue().get(i));
                }
            }
        });
        switch (ctx.type()) {
            case PERSON -> {
                for (Item r : ctx.list("relations")) {
                    if (!ctx.slug().equals(r.text("to"))) ctx.requireTarget(DocumentType.PERSON, r.text("to"), r.at("to"), "şəxsiyyət");
                }
            }
            case THEME -> {
                Item theme = ctx.part("theme");
                if (theme.node().path("extends").isString()) {
                    ctx.requireTarget(DocumentType.THEME, theme.text("extends"), theme.at("extends"), "tema");
                }
            }
            case COMMEMORATION -> {
                Item c = ctx.part("commemoration");
                if (c.node().path("ref").isObject()) entityRef(ctx, c.at("ref"), c.node().path("ref"));
            }
            case CONFLICT -> conflict(ctx);
            case CURRICULUM_GRADE -> curriculum(ctx);
            default -> { }
        }
    }

    /** A person's events name the person itself; a polity's reigns the polity. Not a reference. */
    private static boolean isSelf(ValidationContext ctx, DocumentType target, String slug) {
        return target == ctx.type() && slug.equals(ctx.slug());
    }

    private static void entityRef(ValidationContext ctx, String pointer, JsonNode ref) {
        DocumentType type = REF_TYPES.get(ref.path("type").asString(""));
        String id = ref.path("id").isString() ? ref.path("id").stringValue() : null;
        if (type == null || id == null) return;
        if (isSelf(ctx, type, id)) {
            ctx.error("self-reference", pointer, "sənəd özünə istinad edir");
            return;
        }
        Target target = ctx.target(type, id);
        if (target == Target.MISSING) {
            ctx.info("missing-target", pointer, "istinad olunan %s:%s hələ yoxdur (gələcək məzmun ola bilər)".formatted(ref.path("type").asString(), id));
        } else if (target == Target.UNPUBLISHED) {
            ctx.info("unpublished-target", pointer, "istinad olunan %s:%s hələ dərc olunmayıb".formatted(ref.path("type").asString(), id));
        }
    }

    /**
     * A topic must play: every step it lists names an existing simulation (ERROR when missing,
     * WARNING when unpublished). Step keys are checked where the steps live (validate:data,
     * the topic reader skips a key that no longer exists).
     */
    private static void curriculum(ValidationContext ctx) {
        JsonNode sections = ctx.part("grade").node().path("sections");
        for (int s = 0; s < sections.size(); s++) {
            JsonNode topics = sections.get(s).path("topics");
            for (int t = 0; t < topics.size(); t++) {
                JsonNode steps = topics.get(t).path("steps");
                for (int i = 0; i < steps.size(); i++) {
                    JsonNode ref = steps.get(i);
                    DocumentType type = REF_TYPES.get(ref.path("type").asString(""));
                    if (type == null || !ref.path("id").isString()) continue;
                    String at = "/grade/sections/%d/topics/%d/steps/%d/id".formatted(s, t, i);
                    ctx.requireTarget(type, ref.path("id").stringValue(), at, name(type));
                }
            }
        }
    }

    /** Inside a conflict document: days point at its settlements and commanders, and at hero documents. */
    private static void conflict(ValidationContext ctx) {
        Set<String> settlements = ids(ctx, "settlements");
        Set<String> commanders = ids(ctx, "commanders");
        Set<String> days = ids(ctx, "days");
        for (Item day : ctx.list("days")) {
            local(ctx, day, "liberated", settlements, "yaşayış məntəqəsi");
            local(ctx, day, "commanders", commanders, "komandan");
            JsonNode heroes = day.node().path("fallenHeroes");
            for (int i = 0; i < heroes.size(); i++) {
                ctx.requireTarget(DocumentType.HERO, heroes.get(i).asString(), day.at("fallenHeroes") + "/" + i, "qəhrəman");
            }
        }
        for (Item commander : ctx.list("commanders")) local(ctx, commander, "days", days, "gün");
    }

    private static void local(ValidationContext ctx, Item owner, String field, Set<String> known, String what) {
        JsonNode values = owner.node().path(field);
        for (int i = 0; i < values.size(); i++) {
            String v = values.get(i).asString("");
            if (!known.contains(v)) ctx.error("unknown-reference", owner.at(field) + "/" + i, "naməlum %s: %s".formatted(what, v));
        }
    }

    private static Set<String> ids(ValidationContext ctx, String list) {
        Set<String> out = new HashSet<>();
        for (Item item : ctx.list(list)) if (item.text("id") != null) out.add(item.text("id"));
        return out;
    }

    private static String name(DocumentType type) {
        return NAMES.getOrDefault(type.name(), type.name());
    }
}
