package az.tarix.platform.media.api;

import az.tarix.platform.shared.domain.PermissionStatus;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

/**
 * The media registry for other modules' writes and checks (ADR-0017): the editorial
 * validation asks it about the files a document refers to, the importer registers the files
 * the existing data links to. Always reads the current state (no cache).
 */
public interface MediaRegistry {

    /**
     * The registered files among {@code refs}: content references as written, i.e.
     * {@code media:<id>} or a linked path / URL. Unknown references are missing from the map.
     */
    Map<String, RegisteredMedia> find(Collection<String> refs);

    /**
     * Registers files the content links to (a path under {@code public/} or an absolute URL).
     * A path that is already registered is left exactly as it is: its licence and permission
     * may have been changed in the CMS since. The first description of a path wins. The caller
     * makes the content version move on (a rebuild, or {@link MediaAssetChanged}) when it registered any.
     */
    LinkResult registerLinked(List<LinkedFile> files, UUID registeredBy);

    /** A registered file as far as checks need it. */
    record RegisteredMedia(UUID id, String storageKey, AssetType type, PermissionStatus status, String license,
                           boolean aiGenerated) {}

    /**
     * A file the content links to.
     *
     * @param path         as written in the content ({@code /portraits/…}, {@code https://…})
     * @param aiDisclosure LocalizedText, or null (required when {@code aiGenerated})
     */
    record LinkedFile(String path, AssetType type, String license, String sourceUrl, String rightsHolder,
                      PermissionStatus status, boolean aiGenerated, JsonNode aiDisclosure) {}

    /** How many paths were new, how many were registered already. */
    record LinkResult(int registered, int existing) {}
}
