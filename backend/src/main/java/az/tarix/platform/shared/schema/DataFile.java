package az.tarix.platform.shared.schema;

import java.util.regex.Pattern;

/**
 * One entry of shared/schema/files.json: files under data/ matching {@code pattern} follow
 * {@code schema}. In the pattern, {@code *} matches within a single path segment.
 */
public record DataFile(String pattern, String schema) {

    public boolean matches(String relativePath) {
        return toRegex(pattern).matcher(relativePath.replace('\\', '/')).matches();
    }

    private static Pattern toRegex(String glob) {
        StringBuilder re = new StringBuilder("^");
        String[] parts = glob.split("\\*", -1);
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) re.append("[^/]+");
            re.append(Pattern.quote(parts[i]));
        }
        return Pattern.compile(re.append('$').toString());
    }
}
