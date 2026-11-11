package az.tarix.platform.shared.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class DataEnumTests {

    @Test
    void roundTripsEveryConstant() {
        List<Class<? extends Enum<?>>> types = List.of(Certainty.class, DatePrecision.class, Mood.class, ClaimType.class,
                PlaceType.class, StepKind.class, PermissionStatus.class, EntityType.class);
        for (Class<? extends Enum<?>> type : types) {
            for (Enum<?> e : type.getEnumConstants()) {
                assertThat(roundTrip(e)).isEqualTo(e);
            }
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Enum<?> roundTrip(Enum<?> e) {
        return (Enum<?>) DataEnum.fromData((Class) e.getDeclaringClass(), ((DataEnum) e).dataValue());
    }

    @Test
    void usesLowerCaseInDocuments() {
        assertThat(ClaimType.LITERARY.dataValue()).isEqualTo("literary");
        assertThat(DataEnum.fromData(Mood.class, "coronation")).isEqualTo(Mood.CORONATION);
        assertThatThrownBy(() -> DataEnum.fromData(Mood.class, "CORONATION")).hasMessageContaining("unknown Mood");
    }

    @Test
    void onlyClearedMediaIsPublic() {
        assertThat(PermissionStatus.GRANTED.isPublic()).isTrue();
        assertThat(PermissionStatus.NOT_REQUIRED.isPublic()).isTrue();
        assertThat(PermissionStatus.PENDING.isPublic()).isFalse();
        assertThat(PermissionStatus.DENIED.isPublic()).isFalse();
    }
}
