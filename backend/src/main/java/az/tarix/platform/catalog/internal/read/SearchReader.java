package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.PublicCache;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.read.SearchSource;
import az.tarix.platform.shared.read.SearchSource.Hit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** {@code /search} (BACKEND_SPEC.md §10.1): asks every module's {@link SearchSource}, one query each. */
@Service
public class SearchReader {

    public static final int MIN_QUERY = 2;
    public static final int MAX_QUERY = 100;
    public static final int DEFAULT_LIMIT = 20;
    public static final int MAX_LIMIT = 50;

    /** @param score 0…1, three decimals */
    public record SearchItem(EntityType type, String slug, JsonNode name, Integer fromYear, Integer toYear, double score) {}

    public record SearchResult(String query, List<EntityType> types, List<SearchItem> items) {}

    private final List<SearchSource> sources;
    private final PublicCache cache;
    private final Set<EntityType> searchable = EnumSet.noneOf(EntityType.class);

    SearchReader(List<SearchSource> sources, PublicCache cache) {
        this.sources = sources;
        this.cache = cache;
        sources.forEach(s -> searchable.addAll(s.types()));
    }

    private record Key(String query, Set<EntityType> types, int limit) {}

    public SearchResult search(ReadContext ctx, String q, String typesParam, Integer limitParam) {
        String query = q == null ? "" : q.strip();
        if (query.length() < MIN_QUERY || query.length() > MAX_QUERY) {
            throw new InvalidParameterException("q", MIN_QUERY + "–" + MAX_QUERY + " simvol olmalıdır");
        }
        Set<EntityType> types = types(typesParam);
        int limit = limitParam == null ? DEFAULT_LIMIT : limitParam;
        if (limit < 1 || limit > MAX_LIMIT) throw new InvalidParameterException("limit", "1–" + MAX_LIMIT + " aralığında olmalıdır");
        return cache.get(ctx, "search", new Key(query, types, limit), () -> {
            Lang lang = ctx.lang();
            List<Hit> hits = new ArrayList<>();
            for (SearchSource s : sources) {
                Set<EntityType> asked = EnumSet.noneOf(EntityType.class);
                asked.addAll(s.types());
                asked.retainAll(types);
                if (!asked.isEmpty()) hits.addAll(s.search(query, asked, limit));
            }
            List<SearchItem> items = hits.stream()
                    .sorted(Hit.ORDER)
                    .limit(limit)
                    .map(h -> new SearchItem(h.type(), h.slug(), lang.text(h.name()), h.fromYear(), h.toYear(),
                            Math.round(h.score() * 1000) / 1000.0))
                    .toList();
            return new SearchResult(query, List.copyOf(types), items);
        });
    }

    /** Comma-separated entity types, any case; all searchable types when absent. */
    Set<EntityType> types(String param) {
        if (param == null || param.isBlank()) return EnumSet.copyOf(searchable);
        Set<EntityType> out = EnumSet.noneOf(EntityType.class);
        for (String part : param.split(",")) {
            String name = part.strip().toUpperCase(Locale.ROOT);
            if (name.isEmpty()) continue;
            EntityType type;
            try {
                type = EntityType.valueOf(name);
            } catch (IllegalArgumentException e) {
                throw new InvalidParameterException("types", "naməlum tip: " + part.strip());
            }
            if (!searchable.contains(type)) throw new InvalidParameterException("types", "axtarılmır: " + part.strip());
            out.add(type);
        }
        if (out.isEmpty()) return EnumSet.copyOf(searchable);
        return out;
    }
}
