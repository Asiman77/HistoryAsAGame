package az.tarix.platform.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class PublicApiWebTests {

    @Test
    void ifNoneMatchUsesWeakComparison() {
        String etag = "W/\"cv-7-az\"";
        assertThat(PublicApiInterceptor.matches("W/\"cv-7-az\"", etag)).isTrue();
        assertThat(PublicApiInterceptor.matches("\"cv-7-az\"", etag)).isTrue();
        assertThat(PublicApiInterceptor.matches("\"x\", W/\"cv-7-az\"", etag)).isTrue();
        assertThat(PublicApiInterceptor.matches("*", etag)).isTrue();
        assertThat(PublicApiInterceptor.matches("W/\"cv-7-en\"", etag)).isFalse();
        assertThat(PublicApiInterceptor.matches("W/\"cv-6-az\"", etag)).isFalse();
        assertThat(PublicApiInterceptor.matches("", etag)).isFalse();
        assertThat(PublicApiInterceptor.matches(null, etag)).isFalse();
    }

    @Test
    void aRenamedSlugKeepsTheRestOfTheUrl() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/persons/shah-ismail/steps/1501-tabriz");
        request.setQueryString("lang=en");
        assertThat(PublicApiProblems.renamed(request, "shah-ismail", "shah-ismayil"))
                .hasToString("/api/v1/persons/shah-ismayil/steps/1501-tabriz?lang=en");

        MockHttpServletRequest plain = new MockHttpServletRequest("GET", "/api/v1/places/tebriz");
        assertThat(PublicApiProblems.renamed(plain, "tebriz", "tabriz")).hasToString("/api/v1/places/tabriz");
    }
}
