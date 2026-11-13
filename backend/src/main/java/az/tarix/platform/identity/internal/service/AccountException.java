package az.tarix.platform.identity.internal.service;

import java.util.List;

/**
 * An account operation that cannot be done. The web layer turns it into Problem Details:
 * {@link Kind#NOT_FOUND} 404, {@link Kind#CONFLICT} 409 (with {@code code}),
 * {@link Kind#INVALID} 422 (with {@code problems}).
 */
public class AccountException extends RuntimeException {

    public enum Kind { NOT_FOUND, CONFLICT, INVALID }

    private final Kind kind;
    private final String code;
    private final List<String> problems;

    private AccountException(Kind kind, String code, String message, List<String> problems) {
        super(message);
        this.kind = kind;
        this.code = code;
        this.problems = List.copyOf(problems);
    }

    public static AccountException notFound(String message) {
        return new AccountException(Kind.NOT_FOUND, "not-found", message, List.of());
    }

    /**
     * @param code {@code duplicate-email}, {@code self-lockout}, {@code last-admin},
     *             {@code system-account}, {@code duplicate-code}, {@code too-many-classes}
     */
    public static AccountException conflict(String code, String message) {
        return new AccountException(Kind.CONFLICT, code, message, List.of());
    }

    /** @param code {@code invalid-password}, {@code invalid-roles}, {@code wrong-password} */
    public static AccountException invalid(String code, String message, List<String> problems) {
        return new AccountException(Kind.INVALID, code, message, problems);
    }

    public Kind kind() {
        return kind;
    }

    public String code() {
        return code;
    }

    public List<String> problems() {
        return problems;
    }
}
