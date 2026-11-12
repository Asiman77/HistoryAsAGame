package az.tarix.platform.editorial;

import az.tarix.platform.editorial.internal.importing.DataFolder;
import az.tarix.platform.shared.content.DocumentType;
import java.nio.file.Path;
import java.util.List;
import tools.jackson.databind.node.ObjectNode;

/** Test fixture: today's data/ folder as editorial documents, read by the importer's {@link DataFolder}. */
public final class DataDocuments {

    public record Doc(DocumentType type, String slug, ObjectNode content) {}

    static final Path ROOT = Path.of("..");
    public static final Path DATA = ROOT.resolve("data");
    public static final Path BUILT_TERRITORIES = ROOT.resolve("public/data/territories");

    private static List<Doc> cache;

    private DataDocuments() {}

    /** Every document; each call returns fresh copies, so tests may change them. */
    public static synchronized List<Doc> all() {
        if (cache == null) {
            cache = DataFolder.read(DATA, BUILT_TERRITORIES).documents().stream()
                    .map(d -> new Doc(d.type(), d.slug(), d.content())).toList();
        }
        return cache.stream().map(d -> new Doc(d.type(), d.slug(), d.content().deepCopy())).toList();
    }

    public static Doc find(DocumentType type, String slug) {
        return all().stream().filter(d -> d.type() == type && d.slug().equals(slug)).findFirst().orElseThrow();
    }
}
