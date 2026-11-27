package az.tarix.platform.catalog.internal.web;

import az.tarix.platform.catalog.internal.read.CurriculumReader;
import az.tarix.platform.catalog.internal.read.CurriculumReader.GradeSummary;
import az.tarix.platform.catalog.internal.read.CurriculumReader.GradeView;
import az.tarix.platform.catalog.internal.read.CurriculumReader.TopicView;
import az.tarix.platform.shared.read.InvalidParameterException;
import az.tarix.platform.shared.read.PublicParams;
import az.tarix.platform.shared.read.ReadContext;
import az.tarix.platform.shared.web.PublicApi;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The school curriculum (B2): subject → grade → section → topic → steps (FRONTEND_SPEC §6.3, §9). */
@RestController
@PublicApi
@RequestMapping("/api/v1/curriculum")
@Tag(name = "Kurikulum")
class CurriculumController {

    private final CurriculumReader curriculum;

    CurriculumController(CurriculumReader curriculum) {
        this.curriculum = curriculum;
    }

    @GetMapping("/{subject}/grades")
    @Operation(summary = "Fənnin sinifləri",
            description = "Sinif sırası ilə: bölmə və mövzu sayı, açıla bilən (`ready`) mövzu sayı, mövzuların əhatə etdiyi illər. "
                    + "Kurikulum datası yoxdursa boş siyahı.")
    List<GradeSummary> grades(ReadContext ctx, @Parameter(description = "Fənn, məs. `azerbaijan-history`") @PathVariable String subject) {
        return curriculum.grades(ctx, PublicParams.slug("subject", subject));
    }

    @GetMapping("/{subject}/grades/{grade}")
    @Operation(summary = "Sinif",
            description = "Dərslik istinadı, bölmələr və mövzular. Addımı olmayan və ya addımları hələ dərc olunmamış mövzu "
                    + "`ready: false`-dur (\"hazırlanır\").")
    GradeView grade(ReadContext ctx, @PathVariable String subject,
                    @Parameter(description = "Sinif, 1–11") @PathVariable int grade) {
        if (grade < 1 || grade > 11) throw new InvalidParameterException("grade", "1…11 aralığında olmalıdır");
        return curriculum.grade(ctx, PublicParams.slug("subject", subject), grade);
    }

    @GetMapping("/topics/{slug}/steps")
    @Operation(summary = "Mövzu simulyasiyası",
            description = "Mövzu (sinif, bölmə, dərslik paraqrafı) və onun danışdığı addımlar öz sırası ilə, hər biri öz "
                    + "simulyasiyasından (şəxsiyyət, müharibə, dövlət). Dərc olunmamış addım siyahıya düşmür.")
    TopicView topic(ReadContext ctx, @PathVariable String slug) {
        return curriculum.topic(ctx, slug);
    }
}
