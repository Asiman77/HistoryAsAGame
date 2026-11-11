package az.tarix.platform.identity.api;

/** Account roles. Students have no accounts; TEACHER only sees aggregated class results. */
public enum Role {
    AUTHOR, REVIEWER, ADMIN, TEACHER;

    /** Spring Security authority name, e.g. {@code ROLE_ADMIN}. */
    public String authority() {
        return "ROLE_" + name();
    }
}
