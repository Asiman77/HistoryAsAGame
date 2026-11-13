package az.tarix.platform.identity.api;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Teacher classes as other modules see them (analytics, phase 12: events carry the class code,
 * and a teacher may only read the statistics of their own classes, BACKEND_SPEC.md §12).
 */
public interface ClassGroups {

    /** Characters of a class code: no look-alikes (0/O, 1/I/L). */
    String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    int CODE_LENGTH = 6;

    record ClassGroupRef(UUID id, String code, String name, UUID teacherId) {}

    /** The class with this code (any case, surrounding spaces ignored), if it exists. */
    Optional<ClassGroupRef> byCode(String code);

    /** Whether the class exists and belongs to this teacher. */
    default boolean ownedBy(String code, UUID teacherId) {
        return byCode(code).map(c -> c.teacherId().equals(teacherId)).orElse(false);
    }

    /** Upper case and stripped; null when it cannot be a code at all. */
    static String normalize(String code) {
        if (code == null) return null;
        String c = code.strip().toUpperCase(Locale.ROOT);
        if (c.length() != CODE_LENGTH) return null;
        for (char ch : c.toCharArray()) if (ALPHABET.indexOf(ch) < 0) return null;
        return c;
    }
}
