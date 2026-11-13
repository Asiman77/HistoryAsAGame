package az.tarix.platform.media.api;

import az.tarix.platform.shared.read.Lang;
import java.util.List;

/** Portraits by age of an entity (today: persons), in their authored order. One query per call. */
public interface Portraits {

    /** @param ownerType {@code PERSON}, {@code RULER}, {@code HERO}, {@code STATE} or {@code POLITY} */
    List<ApiPortrait> of(String ownerType, String ownerSlug, Lang lang);
}
