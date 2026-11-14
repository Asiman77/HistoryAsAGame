package az.tarix.platform.media.internal.web;

import az.tarix.platform.media.internal.read.SoundtrackReader;
import az.tarix.platform.media.internal.read.SoundtrackReader.ApiTrack;
import az.tarix.platform.shared.domain.Mood;
import az.tarix.platform.shared.domain.Slugs;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Locale;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PublicApi
@RequestMapping("/api/v1/soundtracks")
@Tag(name = "Musiqi")
class SoundtrackController {

    private final SoundtrackReader tracks;

    SoundtrackController(SoundtrackReader tracks) {
        this.tracks = tracks;
    }

    @GetMapping
    @Operation(summary = "İcazəli treklər",
            description = "Yalnız səs yazısı ictimai səsləndirilə bilən treklər (GRANTED və ya NOT_REQUIRED). `mood` və `conflict` ilə süzülür.")
    List<ApiTrack> list(ReadContext ctx, @RequestParam(required = false) String mood, @RequestParam(required = false) String conflict) {
        return tracks.tracks(ctx, mood(mood), conflict(conflict));
    }

    private static Mood mood(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Mood.valueOf(value.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new InvalidParameterException("mood", "naməlum əhval: " + value);
        }
    }

    private static String conflict(String value) {
        if (value == null || value.isBlank()) return null;
        if (!Slugs.isValid(value)) throw new InvalidParameterException("conflict", "slug olmalıdır");
        return value;
    }
}
