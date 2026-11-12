package az.tarix.platform.editorial.internal.persistence;

import java.time.Instant;
import java.util.UUID;

/** A revision without its content, for the history list. */
public record RevisionSummary(UUID id, int revisionNo, int schemaVersion, UUID authorId, String changeNote, Instant createdAt) {}
