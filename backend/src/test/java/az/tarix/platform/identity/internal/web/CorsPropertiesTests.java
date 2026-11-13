package az.tarix.platform.identity.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class CorsPropertiesTests {

    @Test
    void plainOriginsAreAcceptedAndBlanksDropped() {
        CorsProperties p = new CorsProperties(List.of(" https://tarixin-icinde.az", "http://localhost:3000", ""));
        assertThat(p.allowedOrigins()).containsExactly("https://tarixin-icinde.az", "http://localhost:3000");
        assertThat(new CorsProperties(List.of()).allowedOrigins()).isEmpty();
    }

    @Test
    void anythingButAPlainOriginFailsStartup() {
        for (String bad : new String[] {"*", "https://*.tarixin-icinde.az", "https://tarixin-icinde.az/", "tarixin-icinde.az",
                "ftp://tarixin-icinde.az", "https://user@tarixin-icinde.az", "https://tarixin-icinde.az?x=1"}) {
            assertThatThrownBy(() -> CorsProperties.check(bad)).as(bad).isInstanceOf(IllegalStateException.class);
        }
    }
}
