package az.tarix.platform.identity.internal.service;

/**
 * Login or refresh failed. The message is deliberately the same for every cause (unknown
 * e-mail, wrong password, disabled account, reused or expired token) so the response does
 * not reveal which accounts exist; the cause is only logged.
 */
public class AuthenticationFailedException extends RuntimeException {

    public enum Reason { BAD_CREDENTIALS, ACCOUNT_DISABLED, TOKEN_INVALID, TOKEN_EXPIRED, TOKEN_REUSED }

    private final Reason reason;

    public AuthenticationFailedException(Reason reason) {
        super("authentication failed");
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
