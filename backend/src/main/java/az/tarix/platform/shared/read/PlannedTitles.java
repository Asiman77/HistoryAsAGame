package az.tarix.platform.shared.read;

import az.tarix.platform.shared.read.EntityLinks.Target;
import java.util.Collection;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/** Titles of entities announced before their content exists ({@code planned_entity}, catalog module). */
@FunctionalInterface
public interface PlannedTitles {

    /** The announced title ({@code LocalizedText} JSON) of each target that is planned. */
    Map<Target, JsonNode> titles(Collection<Target> targets);
}
