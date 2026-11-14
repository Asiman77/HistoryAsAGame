package az.tarix.platform.media.internal.domain;

import az.tarix.platform.shared.domain.PermissionStatus;

/**
 * Who may set which permission status, and what a licence change does to it (ADR-0017).
 * Permission is never assumed: a status is only public when someone with the right to say so
 * said so, or when the licence itself makes it free (ADR-0010).
 *
 * <ul>
 *   <li>{@code GRANTED}: only an ADMIN (BACKEND_SPEC.md §11).</li>
 *   <li>{@code DENIED}: a REVIEWER or an ADMIN.</li>
 *   <li>{@code NOT_REQUIRED}: anyone, but only when the licence is free by ADR-0010.</li>
 *   <li>{@code PENDING}: anyone; it is always the safe direction.</li>
 * </ul>
 *
 * A changed licence, rights holder or source re-derives the status from the licence, because a
 * grant or a "free" verdict was about the old terms. Two exceptions: a denial stands until a
 * reviewer lifts it, and an ADMIN editing a GRANTED asset keeps the grant.
 */
public final class PermissionPolicy {

    /** Who is changing the asset. */
    public record Actor(boolean admin, boolean reviewer) {}

    private PermissionPolicy() {}

    /** The status of a newly registered file: free by its licence, else PENDING. */
    public static PermissionStatus initial(String license) {
        return fromLicense(license);
    }

    /**
     * The status after a change.
     *
     * @param current       the status now
     * @param requested     the status asked for, or null
     * @param license       the licence after the change
     * @param termsChanged  whether licence, rights holder or source changed
     * @throws PolicyViolation when the actor may not set {@code requested}
     */
    public static PermissionStatus next(PermissionStatus current, PermissionStatus requested, String license,
                                        boolean termsChanged, Actor actor) {
        if (requested != null) {
            switch (requested) {
                case GRANTED -> {
                    if (!actor.admin()) throw new PolicyViolation(true, "grant-requires-admin", "GRANTED statusunu yalnız ADMIN verə bilər.");
                }
                case DENIED -> {
                    if (!actor.admin() && !actor.reviewer()) {
                        throw new PolicyViolation(true, "deny-requires-reviewer", "DENIED statusunu yalnız REVIEWER və ya ADMIN verə bilər.");
                    }
                }
                case NOT_REQUIRED -> {
                    if (fromLicense(license) != PermissionStatus.NOT_REQUIRED) {
                        throw new PolicyViolation(false, "permission-not-applicable",
                                "Bu lisenziya ilə icazə tələb olunur; NOT_REQUIRED yalnız açıq lisenziyalar üçündür (ADR-0010).");
                    }
                }
                case PENDING -> { }
            }
            return requested;
        }
        if (!termsChanged) return current;
        if (current == PermissionStatus.DENIED) return current;
        if (current == PermissionStatus.GRANTED && actor.admin()) return current;
        return fromLicense(license);
    }

    private static PermissionStatus fromLicense(String license) {
        return PermissionStatus.fromLicense(null, license, null);
    }

    /** A change the policy does not allow. {@code forbidden}: the actor lacks the role (403), else the change itself is invalid (409). */
    public static final class PolicyViolation extends RuntimeException {

        private final boolean forbidden;
        private final String code;

        PolicyViolation(boolean forbidden, String code, String message) {
            super(message);
            this.forbidden = forbidden;
            this.code = code;
        }

        public boolean forbidden() {
            return forbidden;
        }

        public String code() {
            return code;
        }
    }
}
