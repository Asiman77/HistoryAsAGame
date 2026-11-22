package az.tarix.platform;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

/**
 * Writes generated files that are committed (docs/modules, shared/openapi) so that CI's
 * {@code git diff --exit-code} only fails on real changes. Spring Modulith's Documenter emits
 * relations and events in a different order from run to run; a file whose new content has the
 * same lines as the committed one, in any order, is left untouched.
 */
final class StableFiles {

    private StableFiles() {}

    static void write(Path target, String content) {
        String normalized = content.replace("\r\n", "\n");
        try {
            if (Files.exists(target)) {
                String current = Files.readString(target, StandardCharsets.UTF_8).replace("\r\n", "\n");
                if (current.equals(normalized) || sortedLines(current).equals(sortedLines(normalized))) return;
            }
            Files.createDirectories(target.toAbsolutePath().getParent());
            Files.writeString(target, normalized, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Copies every file of {@code from} into {@code to} through {@link #write}. */
    static void copyTree(Path from, Path to) {
        try (Stream<Path> files = Files.walk(from)) {
            for (Path f : files.filter(Files::isRegularFile).toList())
                write(to.resolve(from.relativize(f).toString()), Files.readString(f, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * Lines in sorted order. An AsciiDoc table cell starts with {@code |* item}, so when the
     * items of a cell are reordered the {@code |} moves to another item: it is ignored here.
     */
    static List<String> sortedLines(String s) {
        return s.lines().map(String::stripTrailing).map(l -> l.startsWith("|* ") ? l.substring(1) : l).sorted().toList();
    }
}
