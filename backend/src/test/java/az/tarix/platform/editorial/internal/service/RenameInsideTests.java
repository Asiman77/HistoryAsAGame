package az.tarix.platform.editorial.internal.service;

import static org.assertj.core.api.Assertions.assertThat;

import az.tarix.platform.editorial.DataDocuments;
import az.tarix.platform.shared.content.DocumentType;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

class RenameInsideTests {

    @Test
    void aPersonsIdEventsAndOwnRelationsFollowTheNewSlug() {
        ObjectNode content = DataDocuments.find(DocumentType.PERSON, "shah-ismayil").content().deepCopy();
        DocumentService.renameInside(DocumentType.PERSON, content, "/person/id", "shah-ismayil", "ismayil-i");
        assertThat(content.path("person").path("id").asString()).isEqualTo("ismayil-i");
        assertThat(content.path("events")).isNotEmpty().allMatch(e -> e.path("personId").asString().equals("ismayil-i"));
        for (JsonNode r : content.path("relations")) {
            assertThat(r.path("from").asString()).isNotEqualTo("shah-ismayil");
            assertThat(r.path("to").asString()).isNotEqualTo("ismayil-i");      // links to others are untouched
        }
    }

    @Test
    void aPolitysReignsFollowAndOtherIdsAreLeftAlone() {
        ObjectNode content = DataDocuments.find(DocumentType.POLITY, "safavid").content().deepCopy();
        DocumentService.renameInside(DocumentType.POLITY, content, "/polity/id", "safavid", "safavids");
        assertThat(content.path("polity").path("id").asString()).isEqualTo("safavids");
        assertThat(content.path("reigns")).allMatch(r -> r.path("polityId").asString().equals("safavids"));
        assertThat(content.path("reigns")).allMatch(r -> !r.path("rulerId").asString().equals("safavids"));
    }
}
