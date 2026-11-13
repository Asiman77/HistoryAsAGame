package az.tarix.platform.shared.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.tarix.platform.shared.content.SourceKeys;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Images (permission filter), sources, links and pages of the public API. */
class PublicValuesTests {

    static JsonNode json(String text) {
        return JsonMapper.shared().readTree(text.replace('\'', '"'));
    }

    @Test
    void imagesAreOnlyGivenOutWhenTheirLicenceIsPublic() {
        ApiImage free = ApiImage.of(json("{'src': '/p/a.jpg', 'alt': {'az': 'A'}, 'license': 'Public domain', 'author': 'X'}"), Lang.AZ);
        assertThat(free).isNotNull();
        assertThat(free.url()).isEqualTo("/p/a.jpg");
        assertThat(free.alt().stringValue()).isEqualTo("A");
        assertThat(free.author()).isEqualTo("X");

        assertThat(ApiImage.of(json("{'src': '/p/b.jpg', 'alt': {'az': 'B'}, 'license': 'Bütün hüquqlar qorunur'}"), Lang.AZ)).isNull();
        assertThat(ApiImage.of(json("{'src': '/p/c.jpg', 'license': 'CC0', 'permissionStatus': 'pending'}"), Lang.AZ)).isNull();
        assertThat(ApiImage.of(json("{'alt': {'az': 'yer tutucu'}, 'license': 'CC0'}"), Lang.AZ)).isNull();
        assertThat(ApiImage.of(null, Lang.AZ)).isNull();
    }

    @Test
    void aiIllustrationsAlwaysCarryTheDisclosure() {
        ApiImage ai = ApiImage.of(json("{'src': '/p/ai.webp', 'kind': 'ai_illustration', 'alt': {'az': 'A'}, 'license': 'Layihə lisenziyası'}"),
                Lang.AZ);
        assertThat(ai.kind()).isEqualTo("AI_ILLUSTRATION");
        assertThat(ai.disclosure().stringValue()).isEqualTo("Rəssam təsəvvürü (AI illüstrasiya)");
        ApiImage captioned = ApiImage.of(json("""
                {'src': '/p/ai.webp', 'kind': 'ai_illustration', 'alt': {'az': 'A'}, 'caption': {'az': 'Rəssam təsəvvürü, 1501'},
                 'license': 'Layihə lisenziyası'}"""), Lang.AZ);
        assertThat(captioned.disclosure().stringValue()).isEqualTo("Rəssam təsəvvürü, 1501");
        assertThat(ApiImage.of(json("{'src': '/p/h.jpg', 'kind': 'historical', 'license': 'Public domain'}"), Lang.AZ).disclosure()).isNull();
    }

    @Test
    void heroPhotosNeedAPublicLicenceToo() {
        assertThat(ApiImage.ofPhoto(json("{'url': '/h.jpg', 'source': 'mod.gov.az', 'license': 'CC BY 4.0', 'permissionNote': 'x'}")))
                .extracting(ApiImage::url, ApiImage::kind).containsExactly("/h.jpg", "PHOTO");
        assertThat(ApiImage.ofPhoto(json("{'url': '/h.jpg', 'source': 'x', 'license': 'İcazə ilə', 'permissionNote': 'x'}"))).isNull();
    }

    @Test
    void inlineSourcesGetTheSlugOfTheDeduplicatedRow() {
        JsonNode s = json("{'title': 'Tarix', 'author': 'X', 'type': 'book', 'note': 's. 5', 'url': 'https://example.org'}");
        ApiSource source = ApiSource.of(s);
        assertThat(source.slug()).isEqualTo(SourceKeys.slug(s)).startsWith("src-");
        assertThat(source.type()).isEqualTo("BOOK");
        assertThat(source.locator()).isEqualTo("s. 5");
        assertThat(source.authors()).isEqualTo("X");
        assertThat(ApiSource.all(null)).isEmpty();
    }

    @Test
    void contentRefsBecomeOutgoingLinks() {
        JsonNode ref = json("{'type': 'person', 'id': 'uzun-hasan', 'stepId': 'x-1', 'label': {'az': 'Ana babası'}}");
        EntityLinks.Target target = EntityLinks.Target.of(ref);
        EntityLinks.Resolved published = new EntityLinks.Resolved(java.util.Map.of(target, json("{'az': 'Uzun Həsən'}")), java.util.Map.of());
        ApiLink link = EntityLinks.link(ref, "FAMILY", null, published, Lang.AZ);
        assertThat(link.available()).isTrue();
        assertThat(link.name().stringValue()).isEqualTo("Uzun Həsən");
        assertThat(link.label().stringValue()).isEqualTo("Ana babası");
        assertThat(link.stepKey()).isEqualTo("x-1");
        assertThat(link.direction()).isEqualTo(ApiLink.Direction.OUTGOING);

        EntityLinks.Resolved nothing = new EntityLinks.Resolved(java.util.Map.of(), java.util.Map.of());
        ApiLink passive = EntityLinks.link(ref, "FAMILY", null, nothing, Lang.AZ);
        assertThat(passive.available()).isFalse();
        assertThat(passive.name().stringValue()).isEqualTo("Ana babası");      // falls back to the label
        assertThat(EntityLinks.link(json("{'type': 'dragon', 'id': 'x'}"), "RELATED", null, nothing, Lang.AZ)).isNull();
    }

    @Test
    void pageRequestsAreBounded() {
        assertThat(ResultPage.Request.of(null, null)).isEqualTo(new ResultPage.Request(0, 20));
        assertThat(ResultPage.Request.of(3, 100).offset()).isEqualTo(300);
        assertThatThrownBy(() -> ResultPage.Request.of(-1, 10)).isInstanceOf(InvalidParameterException.class);
        assertThatThrownBy(() -> ResultPage.Request.of(0, 101)).isInstanceOf(InvalidParameterException.class);
        assertThatThrownBy(() -> ResultPage.Request.of(0, 0)).isInstanceOf(InvalidParameterException.class);
    }

    @Test
    void theEtagDependsOnVersionAndLanguage() {
        assertThat(new ReadContext(42, Lang.AZ).etag()).isEqualTo("W/\"cv-42-az\"");
        assertThat(new ReadContext(42, Lang.ALL).etag()).isEqualTo("W/\"cv-42-all\"");
    }
}
