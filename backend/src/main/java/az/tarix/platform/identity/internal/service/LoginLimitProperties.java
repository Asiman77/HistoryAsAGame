package az.tarix.platform.identity.internal.service;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code platform.identity.login-limit.*}: how many login attempts are allowed (BACKEND_SPEC.md
 * §13). Two limits apply to every attempt, successful or not:
 *
 * <ul>
 *   <li>per client address: stops one machine from trying many accounts (password spraying);</li>
 *   <li>per account (e-mail): stops many machines from guessing one password.</li>
 * </ul>
 *
 * Attempts are throttled, never locked out: when a bucket is empty the client waits until it
 * refills, so an attacker cannot lock a real user out for good.
 *
 * @param maxTrackedKeys how many addresses and accounts are remembered (memory bound); the
 *                       least recently used are forgotten first
 */
@ConfigurationProperties("platform.identity.login-limit")
public record LoginLimitProperties(
        @DefaultValue Limit perAddress,
        @DefaultValue Limit perAccount,
        @DefaultValue("100000") long maxTrackedKeys) {

    public static final Limit DEFAULT_PER_ADDRESS = new Limit(20, Duration.ofMinutes(1));
    public static final Limit DEFAULT_PER_ACCOUNT = new Limit(10, Duration.ofMinutes(15));

    public LoginLimitProperties {
        if (perAddress.capacity() == 0) perAddress = DEFAULT_PER_ADDRESS;
        if (perAccount.capacity() == 0) perAccount = DEFAULT_PER_ACCOUNT;
        if (maxTrackedKeys < 1) throw new IllegalStateException("login-limit.max-tracked-keys must be positive");
    }

    /**
     * {@code capacity} attempts, refilled evenly over {@code period}.
     * Zero values mean "use the default".
     */
    public record Limit(long capacity, Duration period) {

        public Limit {
            if (capacity < 0) throw new IllegalStateException("login-limit capacity must not be negative");
            if (capacity > 0 && (period == null || period.isNegative() || period.isZero())) {
                throw new IllegalStateException("login-limit period must be positive");
            }
        }
    }
}
