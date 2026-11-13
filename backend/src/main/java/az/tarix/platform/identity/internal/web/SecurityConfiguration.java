package az.tarix.platform.identity.internal.web;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Access rules (BACKEND_SPEC.md §13): the public read API is open, everything else needs a
 * Bearer access token. Stateless: no session, no cookies, hence no CSRF token.
 * Fine-grained rules (roles per action) are checked in the modules with @PreAuthorize.
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
@EnableConfigurationProperties(CorsProperties.class)
class SecurityConfiguration {

    /**
     * For JSON: nothing may be loaded, framed or submitted. A browser never renders API
     * responses as a page, so this only limits damage if one ever is.
     */
    static final String API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    /** Swagger UI: its own scripts, inline styles (React) and data: icons; calls only this origin. */
    static final String SWAGGER_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            + "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

    static final RequestMatcher SWAGGER_UI = PathPatternRequestMatcher.withDefaults().matcher("/swagger-ui/**");

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, ProblemResponses problems, CorsProperties cors) throws Exception {
        http
                .cors(c -> c.configurationSource(corsSource(cors)))
                .headers(h -> h
                        .contentTypeOptions(Customizer.withDefaults())
                        .frameOptions(f -> f.deny())
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(SWAGGER_UI,
                                new StaticHeadersWriter("Content-Security-Policy", SWAGGER_CSP)))
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(new NegatedRequestMatcher(SWAGGER_UI),
                                new StaticHeadersWriter("Content-Security-Policy", API_CSP))))
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/**").hasRole("ADMIN")
                        // OpenAPI description and Swagger UI of the API (read-only).
                        .requestMatchers(HttpMethod.GET, "/v3/api-docs", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**")
                        .permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout")
                        .permitAll()
                        // Non-public areas, whatever the HTTP method.
                        .requestMatchers("/api/v1/auth/**", "/api/v1/editorial/**", "/api/v1/admin/**", "/api/v1/analytics/**")
                        .authenticated()
                        // The public read API.
                        .requestMatchers(HttpMethod.GET, "/api/v1/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.jwtAuthenticationConverter(rolesFromToken()))
                        .authenticationEntryPoint(problems)
                        .accessDeniedHandler(problems))
                .exceptionHandling(e -> e.authenticationEntryPoint(problems).accessDeniedHandler(problems));
        return http.build();
    }

    /**
     * Cross-origin calls only from the configured origins, for the API (not actuator or
     * Swagger). Tokens travel in the Authorization header, never in cookies, so no credentials
     * mode. Exposed: what clients read from responses (caching, created resources, retry).
     */
    static CorsConfigurationSource corsSource(CorsProperties props) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        if (props.allowedOrigins().isEmpty()) return source;
        CorsConfiguration api = new CorsConfiguration();
        api.setAllowedOrigins(props.allowedOrigins());
        api.setAllowedMethods(List.of("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        api.setAllowedHeaders(List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE, HttpHeaders.ACCEPT,
                HttpHeaders.ACCEPT_LANGUAGE, HttpHeaders.IF_MATCH, HttpHeaders.IF_NONE_MATCH, "X-Request-Id"));
        api.setExposedHeaders(List.of(HttpHeaders.ETAG, HttpHeaders.LOCATION, HttpHeaders.RETRY_AFTER,
                HttpHeaders.CONTENT_LANGUAGE, "X-Request-Id"));
        api.setAllowCredentials(false);
        api.setMaxAge(Duration.ofHours(1));
        source.registerCorsConfiguration("/api/**", api);
        return source;
    }

    /** The {@code roles} claim (["ADMIN", …]) becomes ROLE_ADMIN, … authorities. */
    private static JwtAuthenticationConverter rolesFromToken() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("roles");
        authorities.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }
}
