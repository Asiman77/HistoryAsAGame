package az.tarix.platform.shared.web;

import az.tarix.platform.shared.read.ContentVersion;
import az.tarix.platform.shared.read.Lang;
import az.tarix.platform.shared.read.ReadContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Runs before every {@link PublicApi} handler: resolves the language and the content version
 * once, and answers {@code 304 Not Modified} when the client already has this version
 * (BACKEND_SPEC.md §10) — without touching the content tables.
 */
@Component
public class PublicApiInterceptor implements HandlerInterceptor {

    static final String CONTEXT = PublicApiInterceptor.class.getName() + ".context";

    private final ContentVersion contentVersion;

    public PublicApiInterceptor(ContentVersion contentVersion) {
        this.contentVersion = contentVersion;
    }

    static boolean isPublic(Object handler) {
        return handler instanceof HandlerMethod m && m.getBeanType().isAnnotationPresent(PublicApi.class);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!isPublic(handler)) return true;
        Lang lang = Lang.of(request.getParameter("lang"), request.getHeader(HttpHeaders.ACCEPT_LANGUAGE));
        ReadContext ctx = new ReadContext(contentVersion.current(), lang);
        request.setAttribute(CONTEXT, ctx);
        if ("GET".equals(request.getMethod()) && matches(request.getHeader(HttpHeaders.IF_NONE_MATCH), ctx.etag())) {
            response.setStatus(HttpServletResponse.SC_NOT_MODIFIED);
            PublicApiHeaders.write(response, ctx);
            return false;
        }
        return true;
    }

    /** RFC 9110 §13.1.2: weak comparison against a list of entity tags, or {@code *}. */
    static boolean matches(String ifNoneMatch, String etag) {
        if (ifNoneMatch == null || ifNoneMatch.isBlank()) return false;
        String opaque = opaque(etag);
        for (String candidate : ifNoneMatch.split(",")) {
            String c = candidate.strip();
            if (c.equals("*") || opaque(c).equals(opaque)) return true;
        }
        return false;
    }

    private static String opaque(String tag) {
        return tag.startsWith("W/") ? tag.substring(2) : tag;
    }

    /** The context resolved for this request; null outside the public API. */
    static ReadContext context(HttpServletRequest request) {
        return (ReadContext) request.getAttribute(CONTEXT);
    }
}
