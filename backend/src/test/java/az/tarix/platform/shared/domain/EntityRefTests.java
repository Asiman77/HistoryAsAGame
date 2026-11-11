package az.tarix.platform.shared.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class EntityRefTests {

    @Test
    void parsesTypeSlugAndOptionalStep() {
        assertThat(EntityRef.parse("person:shah-ismayil")).isEqualTo(EntityRef.of(EntityType.PERSON, "shah-ismayil"));
        assertThat(EntityRef.parse("conflict:karabakh-war-2020:day-44"))
                .isEqualTo(new EntityRef(EntityType.CONFLICT, "karabakh-war-2020", "day-44"));
        assertThat(EntityRef.parse("person:uzun-hasan")).hasToString("person:uzun-hasan");
    }

    @Test
    void rejectsInvalidReferences() {
        assertThatThrownBy(() -> EntityRef.parse("person")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> EntityRef.parse("planet:mars")).hasMessageContaining("EntityType");
        assertThatThrownBy(() -> EntityRef.parse("person:Şah")).hasMessageContaining("slug");
    }
}
