package az.tarix.platform.identity.internal.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PasswordPolicyTests {

    @Test
    void acceptsLongPassphrases() {
        assertThat(PasswordPolicy.check("correct horse battery staple", "admin@example.az")).isEmpty();
        assertThat(PasswordPolicy.check("Şuşa-Qala-1752-Pənahəli", "x@example.az")).isEmpty();
    }

    @Test
    void rejectsShortBlankOrHugePasswords() {
        assertThat(PasswordPolicy.check("short", "a@b.az")).anyMatch(p -> p.contains("at least"));
        assertThat(PasswordPolicy.check(" ".repeat(20), "a@b.az")).anyMatch(p -> p.contains("whitespace"));
        assertThat(PasswordPolicy.check("x".repeat(129), "a@b.az")).anyMatch(p -> p.contains("at most"));
        assertThat(PasswordPolicy.check(null, "a@b.az")).isNotEmpty();
    }

    @Test
    void rejectsPasswordsContainingTheEmailName() {
        assertThat(PasswordPolicy.check("asiman-is-the-admin", "asiman@example.az")).anyMatch(p -> p.contains("e-mail"));
    }
}
