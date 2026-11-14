package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.catalog.internal.read.HistoryIndex.IndexEvent;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.ApiLink;
import az.tarix.platform.shared.read.EntityLinks;
import az.tarix.platform.shared.read.EntityLinks.Target;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.ResourceNotFoundException;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/**
 * Two simulations side by side on one time axis (BACKEND_SPEC.md §10.1 {@code /compare},
 * §10.3): each lane's steps and where the two meet. Persons today; states and wars work the
 * same way, so a new rival (e.g. Sultan Səlim) needs no code.
 */
@Service
public class CompareReader {

    /** Two steps meet at the same place or closer than this in the same year (BACKEND_SPEC.md §10.3). */
    static final double MEET_KM = 25;

    /** Frontend {@code distanceKm}. */
    static final double EARTH_RADIUS_KM = 6371;

    static final Set<EntityType> OWNERS = Set.of(EntityType.PERSON, EntityType.STATE, EntityType.CONFLICT);

    /** A step of a lane, with the battles it refers to (by link, or because the step is the battle itself). */
    public record LaneEvent(@JsonUnwrapped IndexEvent event, List<String> battles) {}

    /** One side: the owner, the years its steps span, its steps. */
    public record Lane(EntityType type, String slug, JsonNode name, Integer fromYear, Integer toYear, List<LaneEvent> events) {}

    public enum Reason { PLACE, BATTLE }

    /**
     * Where the two lanes meet.
     *
     * @param a          step key in lane {@code a}
     * @param b          step key in lane {@code b}
     * @param year       of the step in lane {@code a}
     * @param place      the shared catalogue place, or null when the steps only lie close together
     * @param distanceKm between the two locations, one decimal
     * @param battle     the shared battle, or null
     */
    public record Intersection(List<Reason> reasons, String a, String b, int year, String place, JsonNode placeName,
                               double distanceKm, ApiLink battle) {}

    /** The years both lanes cover, or null when they do not overlap. */
    public record Overlap(int fromYear, int toYear) {}

    public record Comparison(Lane a, Lane b, Overlap overlap, List<Intersection> intersections) {}

    static final String BATTLES = """
            SELECT r.source_type AS owner_type, r.source_slug AS owner_slug, r.source_step_key AS step_key, r.target_slug AS battle
            FROM entity_relation r
            WHERE r.target_type = 'BATTLE' AND r.source_step_key IS NOT NULL
              AND ((r.source_type = :typeA AND r.source_slug = :slugA) OR (r.source_type = :typeB AND r.source_slug = :slugB))
            UNION
            SELECT 'CONFLICT', b.conflict_slug, b.step_key, b.slug
            FROM battle b
            WHERE b.step_key IS NOT NULL
              AND (('CONFLICT' = :typeA AND b.conflict_slug = :slugA) OR ('CONFLICT' = :typeB AND b.conflict_slug = :slugB))
            ORDER BY 4""";

    static final String LANE = "s.owner_type = :type AND s.owner_slug = :slug";

    private final JdbcClient jdbc;
    private final PublicCache cache;
    private final HistoryIndex index;
    private final EntityLinks links;

    CompareReader(JdbcClient jdbc, PublicCache cache, HistoryIndex index, EntityLinks links) {
        this.jdbc = jdbc;
        this.cache = cache;
        this.index = index;
        this.links = links;
    }

    /** {@code person:shah-ismayil}: a simulation owner. */
    static Target parse(String param, String value) {
        if (value == null || value.isBlank()) throw new InvalidParameterException(param, "məcburidir (məs. person:shah-ismayil)");
        String[] parts = value.strip().split(":");
        if (parts.length != 2 || parts[1].isBlank()) throw new InvalidParameterException(param, "type:slug gözlənilir");
        EntityType type;
        try {
            type = EntityType.valueOf(parts[0].toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new InvalidParameterException(param, "naməlum tip: " + parts[0]);
        }
        if (!OWNERS.contains(type)) throw new InvalidParameterException(param, "yalnız person, state və ya conflict müqayisə olunur");
        return new Target(type, parts[1]);
    }

    private record Key(Target a, Target b) {}

    public Comparison compare(ReadContext ctx, String aParam, String bParam) {
        Target a = parse("a", aParam);
        Target b = parse("b", bParam);
        if (a.equals(b)) throw new InvalidParameterException("b", "a ilə eyni ola bilməz");
        return cache.get(ctx, "compare", new Key(a, b), () -> {
            Lang lang = ctx.lang();
            EntityLinks.Resolved owners = links.resolve(List.of(a, b));
            for (Target t : List.of(a, b)) {
                if (!owners.available(t)) throw new ResourceNotFoundException(DocumentType.valueOf(t.type().name()), t.slug());
            }
            Map<String, Object> params = new HashMap<>();
            params.put("typeA", a.type().name());
            params.put("slugA", a.slug());
            params.put("typeB", b.type().name());
            params.put("slugB", b.slug());
            Map<Target, Map<String, Set<String>>> battles = new HashMap<>();
            jdbc.sql(BATTLES).params(params).query((rs, n) -> battles
                    .computeIfAbsent(new Target(EntityType.valueOf(rs.getString("owner_type")), rs.getString("owner_slug")),
                            k -> new HashMap<>())
                    .computeIfAbsent(rs.getString("step_key"), k -> new TreeSet<>()).add(rs.getString("battle"))).list();
            Lane laneA = lane(a, owners, battles.getOrDefault(a, Map.of()), ctx);
            Lane laneB = lane(b, owners, battles.getOrDefault(b, Map.of()), ctx);
            Set<String> battleSlugs = new TreeSet<>();
            battles.values().forEach(m -> m.values().forEach(battleSlugs::addAll));
            EntityLinks.Resolved battleNames = links.resolve(battleSlugs.stream().map(s -> new Target(EntityType.BATTLE, s)).toList());
            return new Comparison(laneA, laneB, overlap(laneA, laneB), intersections(laneA, laneB, battleNames, lang));
        });
    }

    private Lane lane(Target owner, EntityLinks.Resolved owners, Map<String, Set<String>> battles, ReadContext ctx) {
        Lang lang = ctx.lang();
        List<IndexEvent> events = index.where(LANE, Map.of("type", owner.type().name(), "slug", owner.slug()), ctx);
        List<LaneEvent> out = events.stream()
                .map(e -> new LaneEvent(e, List.copyOf(battles.getOrDefault(e.stepKey(), Set.of())))).toList();
        Integer from = events.isEmpty() ? null : events.getFirst().date().year();
        Integer to = events.isEmpty() ? null : events.getLast().date().year();
        return new Lane(owner.type(), owner.slug(), lang.text(owners.name(owner)), from, to, out);
    }

    static Overlap overlap(Lane a, Lane b) {
        if (a.fromYear() == null || b.fromYear() == null) return null;
        int from = Math.max(a.fromYear(), b.fromYear());
        int to = Math.min(a.toYear(), b.toYear());
        return from <= to ? new Overlap(from, to) : null;
    }

    /** Every pair of steps that meets; a pair meeting for both reasons is listed once. */
    static List<Intersection> intersections(Lane a, Lane b, EntityLinks.Resolved battleNames, Lang lang) {
        List<Intersection> out = new ArrayList<>();
        for (LaneEvent x : a.events()) {
            for (LaneEvent y : b.events()) {
                IndexEvent ex = x.event();
                IndexEvent ey = y.event();
                Set<Reason> reasons = new LinkedHashSet<>();
                String sharedPlace = ex.location().placeSlug() != null && ex.location().placeSlug().equals(ey.location().placeSlug())
                        ? ex.location().placeSlug() : null;
                double km = distanceKm(ex.location().lat(), ex.location().lng(), ey.location().lat(), ey.location().lng());
                if (ex.date().year() == ey.date().year() && (sharedPlace != null || km <= MEET_KM)) reasons.add(Reason.PLACE);
                String battle = x.battles().stream().filter(y.battles()::contains).findFirst().orElse(null);
                if (battle != null) reasons.add(Reason.BATTLE);
                if (reasons.isEmpty()) continue;
                ApiLink battleLink = null;
                if (battle != null) {
                    Target t = new Target(EntityType.BATTLE, battle);
                    boolean available = battleNames.available(t);
                    battleLink = new ApiLink(EntityType.BATTLE, battle, null, "BATTLE", ApiLink.Direction.OUTGOING, available,
                            lang.text(battleNames.name(t)), null, null, null, List.of());
                }
                out.add(new Intersection(List.copyOf(reasons), ex.stepKey(), ey.stepKey(), ex.date().year(), sharedPlace,
                        sharedPlace == null ? null : ex.location().name(), Math.round(km * 10) / 10.0, battleLink));
            }
        }
        return out;
    }

    /** Great-circle distance, the frontend's {@code distanceKm} (R = 6371 km). */
    static double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        double rad = Math.PI / 180;
        double dLat = (lat2 - lat1) * rad;
        double dLng = (lng2 - lng1) * rad;
        double h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.pow(Math.sin(dLng / 2), 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
    }
}
