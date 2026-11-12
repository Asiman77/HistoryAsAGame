package az.tarix.platform.editorial;

import az.tarix.platform.editorial.api.ContentArchived;
import az.tarix.platform.editorial.api.ContentPublished;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Test-only listener: collects the editorial events published while requests run on server threads. */
@Component
public class RecordedEditorialEvents {

    private final List<Object> events = new CopyOnWriteArrayList<>();

    @EventListener
    void on(ContentPublished e) {
        events.add(e);
    }

    @EventListener
    void on(ContentArchived e) {
        events.add(e);
    }

    public List<Object> all() {
        return List.copyOf(events);
    }

    public void clear() {
        events.clear();
    }
}
