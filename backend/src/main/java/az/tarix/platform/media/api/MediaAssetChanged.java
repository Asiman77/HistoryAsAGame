package az.tarix.platform.media.api;

import java.util.UUID;

/**
 * A registered file's licence, permission or description changed, or files were registered
 * for paths the content already uses ({@code assetId} null), so the public output may have
 * changed without any document being published. {@code publishing} bumps the content version
 * on it (caches and ETags follow; the static export runs again).
 */
public record MediaAssetChanged(UUID assetId) {}
