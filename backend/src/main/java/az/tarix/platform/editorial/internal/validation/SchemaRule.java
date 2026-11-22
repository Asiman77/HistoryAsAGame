package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.shared.content.ContentPart;
import az.tarix.platform.shared.domain.Slugs;
import az.tarix.platform.shared.schema.SchemaViolation;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * The content layout of the document type (ADR-0011) and JSON Schema conformance of every
 * part against shared/schema. Unknown parts, and unknown keys at any depth inside a part, are
 * reported as warnings but do not block (Zod ignores them too; they are usually typos).
 */
final class SchemaRule implements ValidationRule {

    @Override
    public void check(ValidationContext ctx) {
        JsonNode content = ctx.content();
        for (ContentPart part : ctx.type().parts()) {
            String pointer = "/" + part.key();
            JsonNode value = content.get(part.key());
            if (value == null || value.isNull()) {
                if (part.required()) ctx.error("missing-part", pointer, "'%s' bölməsi tələb olunur".formatted(part.key()));
                continue;
            }
            switch (part.shape()) {
                case OBJECT -> {
                    if (!value.isObject()) ctx.error("schema", pointer, "obyekt olmalıdır");
                    else {
                        report(ctx, pointer, "", ctx.schemas().validate(part.schema(), value));
                        unknown(ctx, pointer, "", ctx.schemas().unknownKeys(part.schema(), value));
                    }
                }
                case LIST -> {
                    if (!value.isArray()) {
                        ctx.error("schema", pointer, "massiv olmalıdır");
                        continue;
                    }
                    if (value.size() < part.minItems()) {
                        ctx.error("schema", pointer, "ən azı %d element olmalıdır".formatted(part.minItems()));
                    }
                    for (int i = 0; i < value.size(); i++) {
                        JsonNode item = value.get(i);
                        report(ctx, pointer + "/" + i, "", ctx.schemas().validate(part.schema(), item));
                        unknown(ctx, pointer + "/" + i, "", ctx.schemas().unknownKeys(part.schema(), item));
                    }
                }
                case WRAPPED_ITEM -> {
                    ObjectNode wrapper = JsonNodeFactory.instance.objectNode();
                    wrapper.putArray(part.wrapKey()).add(value);
                    report(ctx, pointer, "/" + part.wrapKey() + "/0", ctx.schemas().validate(part.schema(), wrapper));
                    unknown(ctx, pointer, "/" + part.wrapKey() + "/0", ctx.schemas().unknownKeys(part.schema(), wrapper));
                }
                case SLUG -> {
                    if (!value.isString() || !Slugs.isValid(value.stringValue())) {
                        ctx.error("schema", pointer, "slug olmalıdır (kiçik latın hərfləri, rəqəmlər, tire)");
                    }
                }
                case TEXT -> {
                    if (!value.isString() || value.stringValue().isBlank()) ctx.error("schema", pointer, "boş olmayan mətn olmalıdır");
                }
            }
        }
        for (String key : content.propertyNames()) {
            if (ctx.type().part(key).isEmpty()) {
                ctx.warning("unknown-part", "/" + key, "'%s' bu sənəd tipində naməlum bölmədir (nəzərə alınmır)".formatted(key));
            }
        }
    }

    /** Keys no schema describes, as warnings at the object that holds them. */
    private static void unknown(ValidationContext ctx, String pointer, String strip, Iterable<SchemaViolation> violations) {
        for (SchemaViolation v : violations) {
            String p = v.pointer().equals("/") ? "" : v.pointer();
            if (!strip.isEmpty()) p = p.startsWith(strip) ? p.substring(strip.length()) : "";
            ctx.warning("unknown-key", pointer + p, "naməlum açar (nəzərə alınmır): " + v.message());
        }
    }

    /**
     * Reports violations under {@code pointer}. {@code strip} is the prefix the validator saw
     * but the content does not have (the wrapper of a {@link ContentPart.Shape#WRAPPED_ITEM}).
     */
    private static void report(ValidationContext ctx, String pointer, String strip, Iterable<SchemaViolation> violations) {
        for (SchemaViolation v : violations) {
            String p = v.pointer().equals("/") ? "" : v.pointer();
            if (!strip.isEmpty()) p = p.startsWith(strip) ? p.substring(strip.length()) : "";
            ctx.error("schema", pointer + p, v.message());
        }
    }
}
