package az.tarix.platform;

import org.springframework.jdbc.core.simple.JdbcClient;

/** Cleanup shared by integration tests (they share one database, see {@link IntegrationTest}). */
public final class TestDatabase {

    private TestDatabase() {}

    /**
     * Empties the editorial documents, the event registry and every projection table in one
     * statement. TRUNCATE waits for projections still running asynchronously (they hold locks
     * on the documents they read), so none of them can write rows after the cleanup.
     */
    public static void clearContent(JdbcClient jdbc) {
        jdbc.sql("""
                TRUNCATE review_comment, status_transition_log, editorial_revision, editorial_document, slug_redirect,
                         event_publication, event_publication_archive,
                         era, polity, polity_period, polity_fact, ruler, reign,
                         place, place_period, place_upcoming, territory_snapshot, polity_territory,
                         person, conflict, settlement, commander, battle, state_profile, hero, simulation_step, step_claim,
                         source, step_source, claim_source, entity_relation, glossary_entry, commemoration, world_event,
                         planned_entity, theme, portrait, soundtrack_track
                CASCADE""").update();
    }
}
