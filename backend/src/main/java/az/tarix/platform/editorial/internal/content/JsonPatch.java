package az.tarix.platform.editorial.internal.content;

import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * JSON Patch (RFC 6902): {@link #diff} computes what changed between two revisions, in a form
 * a reviewer can read ({@code replace /events/3/title/az}); {@link #apply} replays a patch.
 *
 * <p>Arrays are aligned by their longest common subsequence, so inserting a step in the middle
 * gives one {@code add}, not a {@code replace} of every following step. A removed item
 * directly followed by an added one is diffed in place, so editing one field of a step gives
 * one {@code replace} of that field. Only add, remove and replace are produced.
 */
public final class JsonPatch {

    /** Above this many item pairs, arrays are compared position by position (no LCS). */
    static final long LCS_LIMIT = 1_000_000;

    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private JsonPatch() {}

    public static ArrayNode diff(JsonNode source, JsonNode target) {
        ArrayNode ops = NODES.arrayNode();
        diff(source, target, "", ops);
        return ops;
    }

    private static void diff(JsonNode source, JsonNode target, String path, ArrayNode ops) {
        if (source.equals(target)) return;
        if (source.isObject() && target.isObject()) {
            for (String name : source.propertyNames()) {
                if (!target.has(name)) ops.add(op("remove", path + "/" + ContentJson.escape(name), null));
            }
            for (String name : target.propertyNames()) {
                String child = path + "/" + ContentJson.escape(name);
                if (source.has(name)) diff(source.get(name), target.get(name), child, ops);
                else ops.add(op("add", child, target.get(name)));
            }
        } else if (source.isArray() && target.isArray()) {
            diffArrays(source, target, path, ops);
        } else {
            ops.add(op("replace", path, target));
        }
    }

    private enum Step { KEEP, DELETE, INSERT }

    private static void diffArrays(JsonNode a, JsonNode b, String path, ArrayNode ops) {
        int n = a.size();
        int m = b.size();
        int prefix = 0;
        while (prefix < n && prefix < m && a.get(prefix).equals(b.get(prefix))) prefix++;
        int suffix = 0;
        while (suffix < n - prefix && suffix < m - prefix && a.get(n - 1 - suffix).equals(b.get(m - 1 - suffix))) suffix++;

        List<Step> steps = align(a, prefix, n - suffix, b, prefix, m - suffix);
        int index = prefix;   // position in the array as the patch is applied
        int i = prefix;       // next item of a
        int j = prefix;       // next item of b
        for (int k = 0; k < steps.size(); ) {
            if (steps.get(k) == Step.KEEP) {
                index++;
                i++;
                j++;
                k++;
                continue;
            }
            int deletes = 0;
            int inserts = 0;
            while (k < steps.size() && steps.get(k) != Step.KEEP) {
                if (steps.get(k) == Step.DELETE) deletes++;
                else inserts++;
                k++;
            }
            int modified = Math.min(deletes, inserts);
            for (int x = 0; x < modified; x++) {
                diff(a.get(i++), b.get(j++), path + "/" + index, ops);
                index++;
            }
            for (int x = modified; x < deletes; x++) {
                ops.add(op("remove", path + "/" + index, null));
                i++;
            }
            for (int x = modified; x < inserts; x++) {
                ops.add(op("add", path + "/" + index, b.get(j++)));
                index++;
            }
        }
    }

    /** Edit script for a[aFrom, aTo) → b[bFrom, bTo) via the longest common subsequence. */
    private static List<Step> align(JsonNode a, int aFrom, int aTo, JsonNode b, int bFrom, int bTo) {
        int n = aTo - aFrom;
        int m = bTo - bFrom;
        List<Step> steps = new ArrayList<>(n + m);
        if ((long) n * m > LCS_LIMIT) {
            for (int x = 0; x < n; x++) steps.add(Step.DELETE);
            for (int x = 0; x < m; x++) steps.add(Step.INSERT);
            return steps;
        }
        int[][] lcs = new int[n + 1][m + 1];
        for (int x = n - 1; x >= 0; x--) {
            for (int y = m - 1; y >= 0; y--) {
                lcs[x][y] = a.get(aFrom + x).equals(b.get(bFrom + y))
                        ? lcs[x + 1][y + 1] + 1
                        : Math.max(lcs[x + 1][y], lcs[x][y + 1]);
            }
        }
        int x = 0;
        int y = 0;
        while (x < n && y < m) {
            if (a.get(aFrom + x).equals(b.get(bFrom + y))) {
                steps.add(Step.KEEP);
                x++;
                y++;
            } else if (lcs[x + 1][y] >= lcs[x][y + 1]) {
                steps.add(Step.DELETE);
                x++;
            } else {
                steps.add(Step.INSERT);
                y++;
            }
        }
        while (x++ < n) steps.add(Step.DELETE);
        while (y++ < m) steps.add(Step.INSERT);
        return steps;
    }

    private static ObjectNode op(String name, String path, JsonNode value) {
        ObjectNode op = NODES.objectNode();
        op.put("op", name);
        op.put("path", path);
        if (value != null) op.set("value", value.deepCopy());
        return op;
    }

    // --- apply --------------------------------------------------------------------------------

    /** Applies add, remove, replace, move, copy and test operations to a copy of {@code document}. */
    public static JsonNode apply(JsonNode document, JsonNode patch) {
        JsonNode doc = document.deepCopy();
        for (JsonNode op : patch) {
            String path = op.path("path").asString();
            switch (op.path("op").asString()) {
                case "add" -> doc = add(doc, path, op.get("value").deepCopy());
                case "remove" -> doc = remove(doc, path);
                case "replace" -> doc = add(remove(doc, path), path, op.get("value").deepCopy());
                case "move" -> {
                    String from = op.path("from").asString();
                    JsonNode value = doc.at(from);
                    doc = add(remove(doc, from), path, value);
                }
                case "copy" -> doc = add(doc, path, doc.at(op.path("from").asString()).deepCopy());
                case "test" -> {
                    if (!doc.at(path).equals(op.get("value"))) throw new IllegalArgumentException("test failed at " + path);
                }
                default -> throw new IllegalArgumentException("unknown op: " + op.path("op").asString());
            }
        }
        return doc;
    }

    private static JsonNode add(JsonNode doc, String path, JsonNode value) {
        if (path.isEmpty()) return value;
        JsonNode parent = doc.at(parentOf(path));
        String token = lastToken(path);
        if (parent instanceof ObjectNode o) {
            o.set(token, value);
        } else if (parent instanceof ArrayNode arr) {
            if (token.equals("-")) arr.add(value);
            else arr.insert(index(token, arr.size() + 1), value);
        } else {
            throw new IllegalArgumentException("no container at " + path);
        }
        return doc;
    }

    private static JsonNode remove(JsonNode doc, String path) {
        if (path.isEmpty()) return NODES.nullNode();
        JsonNode parent = doc.at(parentOf(path));
        String token = lastToken(path);
        if (parent instanceof ObjectNode o && o.has(token)) o.remove(token);
        else if (parent instanceof ArrayNode arr) arr.remove(index(token, arr.size()));
        else throw new IllegalArgumentException("nothing to remove at " + path);
        return doc;
    }

    private static int index(String token, int limit) {
        int i = Integer.parseInt(token);
        if (i < 0 || i >= limit) throw new IllegalArgumentException("index out of range: " + token);
        return i;
    }

    private static String parentOf(String path) {
        return path.substring(0, path.lastIndexOf('/'));
    }

    private static String lastToken(String path) {
        return path.substring(path.lastIndexOf('/') + 1).replace("~1", "/").replace("~0", "~");
    }
}
