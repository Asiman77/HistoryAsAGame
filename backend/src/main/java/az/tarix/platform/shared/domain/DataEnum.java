package az.tarix.platform.shared.domain;

import java.util.Locale;

/**
 * Enums are upper-case in the database and the public API ({@code AI_ILLUSTRATION}) and
 * lower-case in content documents and the static export ({@code ai_illustration}).
 * Only projectors and the exporter convert between the two.
 */
public interface DataEnum {

    String name();

    /** Spelling used in content documents (data/ files). */
    default String dataValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    static <E extends Enum<E> & DataEnum> E fromData(Class<E> type, String value) {
        if (value == null) throw new IllegalArgumentException(type.getSimpleName() + " is missing");
        for (E e : type.getEnumConstants()) {
            if (e.dataValue().equals(value)) return e;
        }
        throw new IllegalArgumentException("unknown " + type.getSimpleName() + ": " + value);
    }
}
