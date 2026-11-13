package az.tarix.platform;

import java.util.concurrent.atomic.AtomicLong;
import javax.sql.DataSource;
import net.ttddyy.dsproxy.support.ProxyDataSourceBuilder;
import org.springframework.beans.factory.config.BeanPostProcessor;

/**
 * Counts the SQL statements the application runs (BACKEND_SPEC.md §14: no N+1). Wraps the
 * test DataSource; the count is global, so read it around a single request while nothing
 * else runs. Statements of the event registry are not counted: the projection retry job
 * polls it in the background.
 */
public final class QueryCounter implements BeanPostProcessor {

    private static final AtomicLong COUNT = new AtomicLong();

    public static long count() {
        return COUNT.get();
    }

    /** Statements run by {@code action}. */
    public static long during(Runnable action) {
        long before = COUNT.get();
        action.run();
        return COUNT.get() - before;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (bean instanceof DataSource ds && !(ds instanceof net.ttddyy.dsproxy.support.ProxyDataSource)) {
            return ProxyDataSourceBuilder.create(ds).name(beanName)
                    .afterQuery((execution, queries) -> COUNT.addAndGet(queries.stream()
                            .filter(q -> !q.getQuery().contains("event_publication")).count()))
                    .build();
        }
        return bean;
    }
}
