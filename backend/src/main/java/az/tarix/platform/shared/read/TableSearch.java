package az.tarix.platform.shared.read;

import az.tarix.platform.shared.domain.EntityType;
import az.tarix.platform.shared.jdbc.JsonColumns;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * A {@link SearchSource} over a few tables of one module: one {@code UNION ALL} query for all
 * the asked types.
 */
public class TableSearch implements SearchSource {

    private final JdbcClient jdbc;
    private final Map<EntityType, String> sql = new LinkedHashMap<>();

    public TableSearch(JdbcClient jdbc, List<Table> tables) {
        this.jdbc = jdbc;
        for (Table t : tables) sql.put(t.type(), t.sql());
    }

    @Override
    public Set<EntityType> types() {
        return sql.keySet();
    }

    @Override
    public List<Hit> search(String query, Set<EntityType> types, int limit) {
        List<String> parts = new ArrayList<>();
        sql.forEach((type, s) -> {
            if (types.contains(type)) parts.add("(" + s + ")");
        });
        if (parts.isEmpty()) return List.of();
        return jdbc.sql(String.join("\nUNION ALL\n", parts)).param("q", query).param("limit", limit)
                .query((rs, n) -> new Hit(EntityType.valueOf(rs.getString("type")), rs.getString("slug"), JsonColumns.json(rs, "name"),
                        JsonColumns.integer(rs, "from_year"), JsonColumns.integer(rs, "to_year"), rs.getDouble("score"),
                        rs.getDouble("closeness")))
                .list().stream().sorted(Hit.ORDER).limit(limit).toList();
    }
}
