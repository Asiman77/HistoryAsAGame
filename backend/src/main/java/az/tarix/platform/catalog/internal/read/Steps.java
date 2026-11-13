package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.StepReader.StepView;
import az.tarix.platform.shared.domain.EntityType;
import java.util.List;

/**
 * The steps of a simulation (BACKEND_SPEC.md §10.2): {@code {owner, contentVersion, steps}}.
 *
 * @param contentVersion the content version the steps were read at (also in the ETag)
 */
public record Steps(Owner owner, long contentVersion, List<StepView> steps) {

    public record Owner(EntityType type, String slug) {}
}
