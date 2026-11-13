package az.tarix.platform.shared.web;

import az.tarix.platform.shared.read.ReadContext;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.core.MethodParameter;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * Caching headers of successful public responses (BACKEND_SPEC.md §10):
 * {@code ETag}, {@code Cache-Control: public, max-age=300, stale-while-revalidate=86400},
 * {@code Vary: Accept-Language} and {@code Content-Language}. Errors get {@code no-store}
 * from {@link PublicApiProblems} instead.
 */
@ControllerAdvice(annotations = PublicApi.class)
class PublicApiHeaders implements ResponseBodyAdvice<Object> {

    static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic()
            .staleWhileRevalidate(Duration.ofDays(1));

    static void write(HttpServletResponse response, ReadContext ctx) {
        response.setHeader(HttpHeaders.ETAG, ctx.etag());
        response.setHeader(HttpHeaders.CACHE_CONTROL, CACHE.getHeaderValue());
        response.setHeader(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE);
        if (!ctx.lang().all()) response.setHeader(HttpHeaders.CONTENT_LANGUAGE, ctx.lang().code());
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType contentType,
                                  Class<? extends HttpMessageConverter<?>> converterType, ServerHttpRequest request,
                                  ServerHttpResponse response) {
        if (request instanceof ServletServerHttpRequest req && response instanceof ServletServerHttpResponse res) {
            ReadContext ctx = PublicApiInterceptor.context(req.getServletRequest());
            int status = res.getServletResponse().getStatus();
            if (ctx != null && status >= 200 && status < 300) write(res.getServletResponse(), ctx);
        }
        return body;
    }
}
