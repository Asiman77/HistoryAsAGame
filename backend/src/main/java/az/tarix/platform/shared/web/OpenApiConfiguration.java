package az.tarix.platform.shared.web;

import az.tarix.platform.shared.read.ReadContext;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.parameters.QueryParameter;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.List;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springdoc.core.models.GroupedOpenApi;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI description (BACKEND_SPEC.md §17), served at {@code /v3/api-docs}, with Swagger UI
 * at {@code /swagger-ui.html}. Two groups: {@code public} (the read API the frontend and other
 * clients use) and {@code internal} (editorial, admin, auth). Every public operation documents
 * the language parameters, which handlers receive as a {@link ReadContext}.
 */
@Configuration(proxyBeanMethods = false)
class OpenApiConfiguration {

    static {
        // Resolved by PublicApiWebConfiguration, not bound from the request.
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(ReadContext.class);
    }

    @Bean
    OpenAPI platformOpenApi() {
        return new OpenAPI()
                .info(new Info().title("Tarixin İçində API").version("v1")
                        .description("""
                                İctimai oxuma API-si (`GET`, autentifikasiyasız, `ETag` + `Cache-Control`) və \
                                redaksiya API-si (JWT). Lokallaşdırılmış sahələr seçilmiş dildə sətir olur; \
                                `?lang=all` bütün dilləri obyekt kimi qaytarır."""))
                .components(new Components().addSecuritySchemes("bearer",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }

    @Bean
    GroupedOpenApi publicApi(OperationCustomizer languageParameters) {
        return GroupedOpenApi.builder().group("public").pathsToMatch("/api/v1/**")
                .pathsToExclude("/api/v1/auth/**", "/api/v1/editorial/**", "/api/v1/admin/**", "/api/v1/analytics/**")
                .addOperationCustomizer(languageParameters).build();
    }

    @Bean
    GroupedOpenApi internalApi() {
        return GroupedOpenApi.builder().group("internal")
                .pathsToMatch("/api/v1/auth/**", "/api/v1/editorial/**", "/api/v1/admin/**", "/api/v1/analytics/**").build();
    }

    @Bean
    OperationCustomizer languageParameters() {
        return (operation, handler) -> {
            if (!handler.getBeanType().isAnnotationPresent(PublicApi.class)) return operation;
            operation.addParametersItem(new QueryParameter().name("lang").required(false)
                    .description("Cavabın dili. `all`: lokallaşdırılmış sahələr `{az, en, ru}` obyekti olur. "
                            + "Verilməyibsə `Accept-Language`, o da yoxdursa `az`.")
                    .schema(new StringSchema()._enum(List.of("az", "en", "ru", "all"))));
            operation.addParametersItem(new HeaderParameter().name("Accept-Language").required(false)
                    .schema(new StringSchema()));
            operation.addParametersItem(new HeaderParameter().name("If-None-Match").required(false)
                    .description("Əvvəlki cavabın `ETag`-i; məzmun dəyişməyibsə `304`.").schema(new StringSchema()));
            return operation;
        };
    }
}
