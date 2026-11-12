package az.tarix.platform.editorial.api;

/**
 * A data import published documents in bulk. Instead of one {@link ContentPublished} per
 * document, the read model is rebuilt once: the import is a bulk change, and a rebuild does
 * not depend on the order of documents (a theme variant before its parent).
 */
public record ContentImported(int published) {}
