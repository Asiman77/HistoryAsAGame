package az.tarix.platform.catalog.internal.read;

import az.tarix.platform.shared.read.ResultPage;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Paged list queries: the SQL selects {@code count(*) OVER () AS total} and takes {@code :limit} / {@code :offset}. */
final class Lists {

    private Lists() {}

    @FunctionalInterface
    interface Mapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    /**
     * One page; the total comes with the rows. Only a page past the end needs a second query.
     *
     * @param countSql counts all rows, for a page past the end
     */
    static <T> ResultPage<T> page(JdbcClient jdbc, String sql, ResultPage.Request page, Mapper<T> mapper, String countSql) {
        long[] total = {0};
        List<T> items = jdbc.sql(sql).param("limit", page.size()).param("offset", page.offset()).query((rs, n) -> {
            total[0] = rs.getLong("total");
            return mapper.map(rs);
        }).list();
        if (items.isEmpty() && page.page() > 0) {
            total[0] = jdbc.sql(countSql).query(Long.class).single();
        }
        return ResultPage.of(items, page, total[0]);
    }
}
