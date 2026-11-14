package az.tarix.platform.media.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.media.api.AssetType;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/** The upload allowlist: declared type and first bytes must agree (BACKEND_SPEC.md §13). */
class FileTypeTests {

    static byte[] bytes(int... b) {
        byte[] out = new byte[b.length];
        for (int i = 0; i < b.length; i++) out[i] = (byte) b[i];
        return out;
    }

    static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.ISO_8859_1);
    }

    @Test
    void onlyListedMimeTypesAreAccepted() {
        assertThat(FileType.ofMime("image/jpeg")).contains(FileType.JPEG);
        assertThat(FileType.ofMime("IMAGE/PNG; charset=binary")).contains(FileType.PNG);
        assertThat(FileType.ofMime("application/geo+json")).contains(FileType.GEOJSON);
        assertThat(FileType.ofMime("image/svg+xml")).isEmpty();          // can carry script
        assertThat(FileType.ofMime("text/html")).isEmpty();
        assertThat(FileType.ofMime("application/octet-stream")).isEmpty();
        assertThat(FileType.ofMime(null)).isEmpty();
        assertThat(FileType.MP3.assetType()).isEqualTo(AssetType.AUDIO);
    }

    @Test
    void signaturesMatchTheirType() {
        assertThat(FileType.JPEG.matches(bytes(0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10))).isTrue();
        assertThat(FileType.PNG.matches(bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0))).isTrue();
        assertThat(FileType.WEBP.matches(ascii("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).isTrue();
        assertThat(FileType.AVIF.matches(ascii("\u0000\u0000\u0000 ftypavif\u0000\u0000"))).isTrue();
        assertThat(FileType.MP3.matches(ascii("ID3\u0004\u0000"))).isTrue();
        assertThat(FileType.MP3.matches(bytes(0xFF, 0xFB, 0x90, 0x64))).isTrue();
        assertThat(FileType.WEBM_AUDIO.matches(bytes(0x1A, 0x45, 0xDF, 0xA3, 0x9F))).isTrue();
        assertThat(FileType.OGG.matches(ascii("OggS\u0000\u0002"))).isTrue();
        assertThat(FileType.GEOJSON.matches(ascii("﻿"))).isFalse();
        assertThat(FileType.GEOJSON.matches(bytes(0xEF, 0xBB, 0xBF, ' ', '\n', '{', '"'))).isTrue();
    }

    @Test
    void aRenamedFileDoesNotPass() {
        byte[] html = ascii("<!doctype html><script>alert(1)</script>");
        for (FileType t : FileType.values()) assertThat(t.matches(html)).as(t.name()).isFalse();
        assertThat(FileType.PNG.matches(bytes(0xFF, 0xD8, 0xFF))).isFalse();
        assertThat(FileType.JPEG.matches(new byte[0])).isFalse();
        assertThat(FileType.WEBP.matches(ascii("RIFF\u0000\u0000\u0000\u0000WAVE"))).isFalse();
    }
}
