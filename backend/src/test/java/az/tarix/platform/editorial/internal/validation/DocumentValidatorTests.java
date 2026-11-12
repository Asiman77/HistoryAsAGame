package az.tarix.platform.editorial.internal.validation;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.editorial.DataDocuments.Doc;
import az.tarix.platform.shared.content.DocumentType;
import az.tarix.platform.editorial.internal.validation.ReferenceLookup.Target;
import az.tarix.platform.editorial.internal.validation.ValidationIssue.Level;
import az.tarix.platform.shared.schema.ContentSchemas;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * The pre-publish rules against today's data (which the frontend accepts, so it must not
 * produce errors here) and against broken copies of it (each rule fires where it should).
 */
class DocumentValidatorTests {

    static final ContentSchemas SCHEMAS = new ContentSchemas();
    static final List<Doc> DATA = DataDocuments.all();

    /** Every data document exists and is published; planned entities are planned. */
    final Map<String, Target> targets = new HashMap<>();
    final ReferenceLookup lookup = (type, slug) -> targets.getOrDefault(type + ":" + slug, Target.MISSING);
    final GeometryCheck validGeometry = g -> Optional.empty();
    final DocumentValidator validator = new DocumentValidator(SCHEMAS, lookup, validGeometry);

    DocumentValidatorTests() {
        for (Doc d : DATA) targets.put(d.type() + ":" + d.slug(), Target.PUBLISHED);
        for (Doc d : DATA) {
            if (d.type() == DocumentType.PLANNED_ENTITY) {
                DocumentType t = DocumentType.valueOf(d.content().path("entity").path("type").asString().toUpperCase());
                targets.putIfAbsent(t + ":" + d.slug(), Target.PLANNED);
            }
        }
    }

    List<ValidationIssue> validate(Doc d) {
        return validator.validate(d.type(), d.slug(), d.content());
    }

    List<ValidationIssue> errors(Doc d) {
        return validate(d).stream().filter(i -> i.level() == Level.ERROR).toList();
    }

    Doc copy(DocumentType type, String slug) {
        Doc d = DataDocuments.find(type, slug);
        return new Doc(d.type(), d.slug(), d.content().deepCopy());
    }

    static List<String> codes(List<ValidationIssue> issues) {
        return issues.stream().map(ValidationIssue::code).toList();
    }

    // --- today's data -------------------------------------------------------------------------

    @Test
    void coversEveryDocumentTypeOfTheData() {
        assertThat(DATA.stream().map(Doc::type).distinct())
                .contains(DocumentType.PERSON, DocumentType.CONFLICT, DocumentType.STATE, DocumentType.POLITY,
                        DocumentType.PLACE, DocumentType.ERA, DocumentType.THEME, DocumentType.TERRITORY_SNAPSHOT,
                        DocumentType.HERO, DocumentType.BATTLE);
    }

    @Test
    void existingDataHasNoErrorsExceptMediaAwaitingPermission() {
        List<String> failures = new ArrayList<>();
        for (Doc d : DATA) {
            for (ValidationIssue i : errors(d)) {
                // Tracks whose rights are still pending must not be published (BACKEND_SPEC.md §8.3).
                boolean expected = d.type() == DocumentType.SOUNDTRACK_TRACK && i.code().equals("media-permission");
                if (!expected) failures.add(d.type() + ":" + d.slug() + " " + i);
            }
        }
        assertThat(failures).isEmpty();
    }

    @Test
    void pendingTracksAreBlocked() {
        List<Doc> pending = DATA.stream().filter(d -> d.type() == DocumentType.SOUNDTRACK_TRACK
                && "pending".equals(d.content().path("track").path("permissionStatus").asString())).toList();
        assertThat(pending).isNotEmpty();
        for (Doc d : pending) assertThat(codes(errors(d))).contains("media-permission");
    }

    @Test
    void missingTranslationsAreCountedOncePerLanguage() {
        Doc person = DataDocuments.find(DocumentType.PERSON, "shah-ismayil");
        List<ValidationIssue> infos = validate(person).stream().filter(i -> i.code().equals("missing-translation")).toList();
        assertThat(infos).hasSizeLessThanOrEqualTo(2).allMatch(i -> i.level() == Level.INFO);
    }

    // --- layout and schema --------------------------------------------------------------------

    @Test
    void reportsMissingPartsSchemaErrorsAndUnknownParts() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        d.content().remove("events");
        ((ObjectNode) d.content().path("person")).remove("name");
        d.content().put("extra", 1);
        List<ValidationIssue> issues = validate(d);
        assertThat(issues).anyMatch(i -> i.code().equals("missing-part") && i.pointer().equals("/events"));
        assertThat(issues).anyMatch(i -> i.code().equals("schema") && i.pointer().startsWith("/person"));
        assertThat(issues).anyMatch(i -> i.code().equals("unknown-part") && i.level() == Level.WARNING);
    }

    @Test
    void schemaPointersOfListItemsPointIntoTheContent() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ((ObjectNode) d.content().path("events").get(2)).put("mood", "not-a-mood");
        assertThat(errors(d)).anyMatch(i -> i.code().equals("schema") && i.pointer().equals("/events/2/mood"));
    }

    @Test
    void wrappedItemsAreValidatedAgainstTheirFileSchema() {
        ObjectNode content = tools.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        ObjectNode entity = content.putObject("entity").put("type", "spaceship").put("id", "future");
        entity.putObject("title").put("az", "Gələcək");
        Doc d = new Doc(DocumentType.PLANNED_ENTITY, "future", content);
        assertThat(errors(d)).anyMatch(i -> i.code().equals("schema") && i.pointer().equals("/entity/type"));
    }

    // --- identity -----------------------------------------------------------------------------

    @Test
    void contentIdMustBeTheSlugAndRowsMustBelongToTheDocument() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ((ObjectNode) d.content().path("person")).put("id", "someone-else");
        ((ObjectNode) d.content().path("events").get(0)).put("personId", "someone-else");
        assertThat(codes(errors(d))).contains("slug-mismatch", "foreign-row");
    }

    @Test
    void duplicateIdsAreErrors() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ArrayNode events = (ArrayNode) d.content().path("events");
        ((ObjectNode) events.get(1)).put("id", events.get(0).path("id").asString());
        assertThat(codes(errors(d))).contains("duplicate-id");
    }

    // --- dates, text, steps -------------------------------------------------------------------

    @Test
    void impossibleDatesAndBlankAzerbaijaniTextAreErrors() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ObjectNode date = (ObjectNode) d.content().path("events").get(3).path("date");
        date.put("month", 2);
        date.put("day", 31);
        ((ObjectNode) d.content().path("events").get(4).path("title")).put("az", "   ");
        List<ValidationIssue> errors = errors(d);
        assertThat(errors).anyMatch(i -> i.code().equals("invalid-date") && i.pointer().equals("/events/3/date"));
        assertThat(errors).anyMatch(i -> i.code().equals("empty-az") && i.pointer().equals("/events/4/title/az"));
    }

    @Test
    void stepOrderMustBeUniqueAndChronological() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ArrayNode events = (ArrayNode) d.content().path("events");
        ((ObjectNode) events.get(2)).put("order", events.get(1).path("order").asInt());
        assertThat(codes(errors(d))).contains("duplicate-order");

        Doc swapped = copy(DocumentType.STATE, DATA.stream().filter(x -> x.type() == DocumentType.STATE).findFirst().orElseThrow().slug());
        ArrayNode steps = (ArrayNode) swapped.content().path("steps");
        int first = steps.get(0).path("order").asInt();
        ((ObjectNode) steps.get(0)).put("order", steps.get(steps.size() - 1).path("order").asInt() + 1);
        assertThat(first).isNotNegative();
        assertThat(codes(errors(swapped))).contains("chronology");
    }

    @Test
    void factsNeedSourcesAndLegendsAndDisputesNeedExplanations() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ObjectNode step = (ObjectNode) d.content().path("events").get(5);
        step.putArray("sources");
        ArrayNode claims = step.putArray("claims");
        claims.addObject().put("id", "test-legend").put("claimType", "legend")
                .set("text", d.content().path("person").path("name").deepCopy());
        ((ObjectNode) claims.get(0)).putArray("sources");
        claims.addObject().put("id", "test-disputed").put("claimType", "disputed")
                .set("text", d.content().path("person").path("name").deepCopy());
        ((ObjectNode) claims.get(1)).putArray("sources");
        claims.addObject().put("id", "test-fact").put("claimType", "fact")
                .set("text", d.content().path("person").path("name").deepCopy());
        ((ObjectNode) claims.get(2)).putArray("sources");
        assertThat(codes(errors(d))).contains("fact-without-source", "legend-without-origin", "disputed-without-versions",
                "claim-without-why");
    }

    @Test
    void lifeEventsStayWithinTheLifetime() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        int birthYear = d.content().path("person").path("birth").path("date").path("year").asInt();
        ObjectNode date = (ObjectNode) d.content().path("events").get(3).path("date");
        date.removeAll();
        date.put("year", birthYear - 5).put("certainty", "exact");
        assertThat(codes(errors(d))).contains("outside-lifetime");
    }

    // --- references ---------------------------------------------------------------------------

    @Test
    void unknownRequiredReferencesAreErrorsAndUnpublishedOnesWarnings() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ((ObjectNode) d.content().path("events").get(1).path("location")).put("placeId", "atlantis");
        assertThat(errors(d)).anyMatch(i -> i.code().equals("unknown-reference") && i.pointer().equals("/events/1/location/placeId"));

        String theme = d.content().path("person").path("themeId").asString(null);
        if (theme != null) {
            targets.put("THEME:" + theme, Target.UNPUBLISHED);
            assertThat(validate(d)).anyMatch(i -> i.code().equals("unpublished-reference") && i.level() == Level.WARNING);
        }
    }

    @Test
    void crossLinksToMissingContentAreOnlyInformation() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ArrayNode related = ((ObjectNode) d.content().path("events").get(1)).putArray("related");
        related.addObject().put("type", "person").put("id", "not-written-yet");
        List<ValidationIssue> issues = validate(d);
        assertThat(issues).anyMatch(i -> i.code().equals("missing-target") && i.level() == Level.INFO);
        assertThat(codes(errors(d))).doesNotContain("missing-target");
    }

    // --- media and geometry -------------------------------------------------------------------

    @Test
    void aiPortraitsOfModernPeopleAreErrors() {
        Doc d = copy(DocumentType.PERSON, "shah-ismayil");
        ((ObjectNode) d.content().path("person").path("birth").path("date")).put("year", 1950);
        ArrayNode portraits = ((ObjectNode) d.content().path("person")).putArray("portraits");
        ObjectNode p = portraits.addObject().put("ageFrom", 20).put("ageTo", 30).put("kind", "ai_illustration").put("promptId", "x");
        p.set("alt", d.content().path("person").path("name").deepCopy());
        assertThat(codes(errors(d))).contains("ai-portrait-of-modern-person");
    }

    @Test
    void invalidPolygonsAreErrors() {
        Doc d = DATA.stream().filter(x -> x.type() == DocumentType.TERRITORY_SNAPSHOT && x.content().has("built"))
                .findFirst().orElseThrow();
        DocumentValidator strict = new DocumentValidator(SCHEMAS, lookup, g -> Optional.of("Self-intersection"));
        assertThat(strict.validate(d.type(), d.slug(), d.content()))
                .anyMatch(i -> i.code().equals("invalid-geometry") && i.pointer().startsWith("/built/polities/"));
    }

    @Test
    void reportsAreAboutTheContentNotTheDocumentShape() {
        JsonNode empty = new ObjectNode(tools.jackson.databind.node.JsonNodeFactory.instance);
        List<ValidationIssue> issues = validator.validate(DocumentType.ERA, "x", empty);
        assertThat(issues).extracting(ValidationIssue::code).containsExactly("missing-part");
    }
}
