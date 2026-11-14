package az.tarix.platform.media.internal.web;

import az.tarix.platform.identity.api.CurrentUserProvider;
import az.tarix.platform.media.api.AssetType;
import az.tarix.platform.media.internal.domain.MediaAsset;
import az.tarix.platform.media.internal.domain.Origin;
import az.tarix.platform.media.internal.service.MediaService;
import az.tarix.platform.media.internal.service.MediaService.Filter;
import az.tarix.platform.media.internal.service.MediaService.Registration;
import az.tarix.platform.media.internal.service.MediaService.Upload;
import az.tarix.platform.shared.domain.PermissionStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.net.URI;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The media registry for editors (BACKEND_SPEC.md §11, ADR-0017). Upload: {@code POST /uploads}
 * → {@code PUT} the file to the returned URL → {@code POST /} with the licence. Content then
 * refers to the file by its {@code ref} ({@code media:<id>}). Changes need {@code If-Match}.
 */
@RestController
@RequestMapping("/api/v1/editorial/media")
@PreAuthorize("hasAnyRole('AUTHOR', 'REVIEWER', 'ADMIN')")
class MediaController {

    private static final Pattern ETAG = Pattern.compile("^(?:W/)?\"(\\d+)\"$");

    private final MediaService media;
    private final CurrentUserProvider currentUser;

    MediaController(MediaService media, CurrentUserProvider currentUser) {
        this.media = media;
        this.currentUser = currentUser;
    }

    record UploadRequest(@NotBlank String mimeType, @Positive long sizeBytes) {}

    /**
     * A registered file.
     *
     * @param ref the reference to write into content ({@code src}, {@code url}, {@code file})
     * @param url where browsers load it; null for an upload when no public base URL is configured
     */
    record MediaView(UUID id, String ref, String storageKey, Origin origin, AssetType mediaType, String mimeType, Long sizeBytes,
                     Integer width, Integer height, Integer durationMs, String checksum, JsonNode title, JsonNode caption,
                     String license, String sourceUrl, String rightsHolder, PermissionStatus permissionStatus,
                     boolean aiGenerated, JsonNode aiDisclosureLabel, String url, UUID uploadedBy, Instant createdAt,
                     Instant updatedAt, long version) {}

    @PostMapping("/uploads")
    ResponseEntity<Upload> upload(@Valid @RequestBody UploadRequest body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(media.requestUpload(body.mimeType(), body.sizeBytes()));
    }

    @PostMapping
    ResponseEntity<MediaView> register(@RequestBody Registration body) {
        MediaAsset a = media.register(body, currentUser.require());
        return ResponseEntity.created(URI.create("/api/v1/editorial/media/" + a.id())).cacheControl(CacheControl.noStore())
                .eTag(etag(a)).body(view(a));
    }

    @GetMapping
    ResponseEntity<List<MediaView>> list(@RequestParam(required = false) AssetType type,
                                         @RequestParam(required = false) PermissionStatus status,
                                         @RequestParam(required = false) Origin origin,
                                         @RequestParam(required = false) String q,
                                         @RequestParam(defaultValue = "50") int limit,
                                         @RequestParam(defaultValue = "0") int offset) {
        if (limit < 1 || limit > 200 || offset < 0) throw new IllegalArgumentException("limit 1–200, offset ≥ 0 olmalıdır.");
        if (q != null && q.length() > 200) throw new IllegalArgumentException("q 200 simvoldan uzundur.");
        List<MediaView> out = media.list(new Filter(type, status, origin, q, limit, offset)).stream().map(this::view).toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(out);
    }

    @GetMapping("/{id}")
    ResponseEntity<MediaView> get(@PathVariable UUID id) {
        MediaAsset a = media.get(id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).eTag(etag(a)).body(view(a));
    }

    /** JSON Merge Patch of the description and {@code permissionStatus}; only an ADMIN may set {@code GRANTED}. */
    @PatchMapping("/{id}")
    ResponseEntity<MediaView> patch(@PathVariable UUID id, @RequestBody JsonNode body,
                                    @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
        MediaAsset a = media.update(id, version(ifMatch), body, currentUser.require());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).eTag(etag(a)).body(view(a));
    }

    private MediaView view(MediaAsset a) {
        MediaAsset.Description d = a.description();
        byte[] checksum = a.checksum();
        return new MediaView(a.id(), a.ref(), a.storageKey(), a.origin(), a.mediaType(), a.mimeType(), a.sizeBytes(), d.width(),
                d.height(), d.durationMs(), checksum == null ? null : HexFormat.of().formatHex(checksum), json(d.title()),
                json(d.caption()), d.license(), d.sourceUrl(), d.rightsHolder(), a.permissionStatus(), d.aiGenerated(),
                json(d.aiDisclosureLabel()), media.url(a), a.uploadedBy(), a.createdAt(), a.updatedAt(), a.version());
    }

    private static String etag(MediaAsset a) {
        return "\"" + a.version() + "\"";
    }

    private static Long version(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) return null;
        Matcher m = ETAG.matcher(ifMatch.strip());
        if (!m.matches()) throw new IllegalArgumentException("If-Match mediaın ETag-ı olmalıdır, məs. \"3\".");
        return Long.parseLong(m.group(1));
    }

    private static JsonNode json(String text) {
        return text == null ? null : JsonMapper.shared().readTree(text);
    }
}
