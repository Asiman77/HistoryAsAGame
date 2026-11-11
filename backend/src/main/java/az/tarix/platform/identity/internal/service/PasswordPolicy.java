package az.tarix.platform.identity.internal.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Password rules (NIST SP 800-63B): long passphrases rather than composition rules.
 * The upper bound keeps Argon2 hashing cheap enough to resist denial of service.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 12;
    public static final int MAX_LENGTH = 128;

    private PasswordPolicy() {}

    /** Problems with {@code password}; empty when it is acceptable. */
    public static List<String> check(String password, String email) {
        List<String> problems = new ArrayList<>();
        if (password == null || password.codePointCount(0, password.length()) < MIN_LENGTH) {
            problems.add("at least " + MIN_LENGTH + " characters");
        }
        if (password != null && password.length() > MAX_LENGTH) {
            problems.add("at most " + MAX_LENGTH + " characters");
        }
        if (password != null && password.isBlank()) {
            problems.add("not only whitespace");
        }
        if (password != null && email != null) {
            String local = email.toLowerCase(Locale.ROOT).split("@")[0];
            if (password.toLowerCase(Locale.ROOT).contains(local) && local.length() >= 4) {
                problems.add("must not contain the e-mail name");
            }
        }
        return problems;
    }
}
