package az.tarix.platform.media.internal.persistence;

import az.tarix.platform.media.internal.domain.MediaAsset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {

    Optional<MediaAsset> findByStorageKey(String storageKey);

    boolean existsByStorageKey(String storageKey);

    List<MediaAsset> findByStorageKeyIn(Collection<String> storageKeys);
}
