package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.editorial.api.ContentPart;
import az.tarix.platform.editorial.internal.content.ContentJson;
import az.tarix.platform.editorial.internal.validation.ValidationContext.Item;
import java.util.HashMap;
import java.util.Map;

/**
 * Ids: the content's id is the document slug; rows that belong to the document point back at
 * it (a person's events and relations, a polity's reigns); ids inside a list and claim ids
 * across the document are unique.
 */
final class IdentityRule implements ValidationRule {

    @Override
    public void check(ValidationContext ctx) {
        ctx.type().idPointer().ifPresent(pointer -> {
            String id = ContentJson.text(ctx.content(), pointer);
            if (id != null && !id.equals(ctx.slug())) {
                ctx.error("slug-mismatch", pointer, "id '%s' sənədin slug-ı '%s' ilə eyni olmalıdır".formatted(id, ctx.slug()));
            }
        });
        switch (ctx.type()) {
            case PERSON -> {
                ownedBy(ctx, "events", "personId");
                ownedBy(ctx, "relations", "from");
                for (Item r : ctx.list("relations")) {
                    if (ctx.slug().equals(r.text("to"))) ctx.error("self-reference", r.at("to"), "şəxsiyyət özü ilə əlaqələndirilə bilməz");
                }
            }
            case POLITY -> ownedBy(ctx, "reigns", "polityId");
            default -> { }
        }
        for (ContentPart part : ctx.type().parts()) {
            if (part.shape() != ContentPart.Shape.LIST) continue;
            Map<String, String> seen = new HashMap<>();
            for (Item item : ctx.list(part.key())) {
                String id = item.text("id");
                if (id != null && seen.putIfAbsent(id, item.pointer()) != null) {
                    ctx.error("duplicate-id", item.at("id"), "təkrarlanan id: " + id);
                }
            }
        }
        Map<String, String> claims = new HashMap<>();
        for (Item step : ctx.steps()) {
            for (Item claim : ValidationContext.items(ValidationContext.child(step, "claims"))) {
                String id = claim.text("id");
                if (id != null && claims.putIfAbsent(id, step.text("id")) != null) {
                    ctx.error("duplicate-id", claim.at("id"), "iddia id-si təkrarlanır: %s (%s)".formatted(id, claims.get(id)));
                }
            }
        }
    }

    private static void ownedBy(ValidationContext ctx, String list, String field) {
        for (Item item : ctx.list(list)) {
            String owner = item.text(field);
            if (owner != null && !owner.equals(ctx.slug())) {
                ctx.error("foreign-row", item.at(field), "%s '%s' ≠ sənədin slug-ı '%s'".formatted(field, owner, ctx.slug()));
            }
        }
    }
}
