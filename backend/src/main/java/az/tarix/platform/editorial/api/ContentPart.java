package az.tarix.platform.editorial.api;

/**
 * One top-level key of a revision's content. Content is always a JSON object whose keys are
 * the parts of its {@link DocumentType} (docs/adr/0011-editorial-content-layout.md).
 *
 * @param key      property name in the content object, e.g. {@code events}
 * @param shape    what the value is and how it is validated
 * @param schema   shared/schema name: the object's schema ({@link Shape#OBJECT}), the item schema
 *                 ({@link Shape#LIST}) or the file schema the item is wrapped in ({@link Shape#WRAPPED_ITEM})
 * @param required whether the key must be present
 * @param minItems least number of items of a {@link Shape#LIST}
 * @param wrapKey  for {@link Shape#WRAPPED_ITEM}: the array property of the file schema
 */
public record ContentPart(String key, Shape shape, String schema, boolean required, int minItems, String wrapKey) {

    public enum Shape {
        /** An object validated against {@code schema}. */
        OBJECT,
        /** An array whose items are validated against {@code schema}. */
        LIST,
        /** An object that only has a file schema: validated as {@code {wrapKey: [value]}}. */
        WRAPPED_ITEM,
        /** A slug of another document, e.g. the conflict a hero belongs to. */
        SLUG,
        /** A non-empty string. */
        TEXT
    }

    static ContentPart object(String key, String schema) {
        return new ContentPart(key, Shape.OBJECT, schema, true, 0, null);
    }

    static ContentPart optionalObject(String key, String schema) {
        return new ContentPart(key, Shape.OBJECT, schema, false, 0, null);
    }

    static ContentPart list(String key, String itemSchema, boolean required, int minItems) {
        return new ContentPart(key, Shape.LIST, itemSchema, required, minItems, null);
    }

    static ContentPart wrappedItem(String key, String fileSchema, String wrapKey) {
        return new ContentPart(key, Shape.WRAPPED_ITEM, fileSchema, true, 0, wrapKey);
    }

    static ContentPart slug(String key) {
        return new ContentPart(key, Shape.SLUG, null, true, 0, null);
    }

    static ContentPart optionalText(String key) {
        return new ContentPart(key, Shape.TEXT, null, false, 0, null);
    }
}
