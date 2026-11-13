package az.tarix.platform.identity.internal.persistence;

import az.tarix.platform.identity.internal.domain.RefreshToken;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;

public interface RefreshTokenRepository extends ListCrudRepository<RefreshToken, UUID> {

    /** Locks the row so two concurrent refreshes with the same token cannot both succeed. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t where t.tokenHash = :hash")
    Optional<RefreshToken> findForUpdate(byte[] hash);

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now where t.familyId = :family and t.revokedAt is null")
    int revokeFamily(UUID family, Instant now);

    /** Ends every session of the user (password changed, account disabled, roles changed). */
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now where t.userId = :user and t.revokedAt is null")
    int revokeAllOf(UUID user, Instant now);
}
