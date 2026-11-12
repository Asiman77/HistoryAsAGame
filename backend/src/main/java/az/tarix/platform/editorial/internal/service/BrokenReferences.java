package az.tarix.platform.editorial.internal.service;

import az.tarix.platform.editorial.api.PublishedContents;
import az.tarix.platform.editorial.internal.validation.DocumentValidator;
import az.tarix.platform.editorial.internal.validation.ValidationIssue;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.shared.content.PublishedContent;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every reference of a public revision whose target is missing, archived or not published
 * (BACKEND_SPEC.md §11 {@code GET /admin/broken-references}). Uses the same reference rules
 * as the pre-publish report, so the two never disagree.
 */
@Service
public class BrokenReferences {

    static final Set<String> CODES = Set.of("unknown-reference", "unpublished-reference", "missing-target", "unpublished-target");

    /** One reference of one published document. */
    public record Broken(UUID documentId, DocumentType type, String slug, int revisionNo, ValidationIssue issue) {}

    private final PublishedContents contents;
    private final DocumentValidator validator;

    public BrokenReferences(PublishedContents contents, DocumentValidator validator) {
        this.contents = contents;
        this.validator = validator;
    }

    @Transactional(readOnly = true)
    public List<Broken> find() {
        List<Broken> out = new ArrayList<>();
        for (UUID id : contents.publishedDocumentIds()) {
            PublishedContent c = contents.of(id).orElse(null);
            if (c == null) continue;
            for (ValidationIssue i : validator.validate(c.type(), c.slug(), c.content())) {
                if (CODES.contains(i.code())) out.add(new Broken(c.documentId(), c.type(), c.slug(), c.revisionNo(), i));
            }
        }
        return out;
    }
}
