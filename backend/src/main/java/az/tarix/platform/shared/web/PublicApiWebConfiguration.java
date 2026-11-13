package az.tarix.platform.shared.web;

import az.tarix.platform.shared.read.ReadContext;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Wires the public API support: the interceptor and the {@link ReadContext} handler argument. */
@Configuration(proxyBeanMethods = false)
class PublicApiWebConfiguration implements WebMvcConfigurer {

    private final PublicApiInterceptor interceptor;

    PublicApiWebConfiguration(PublicApiInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor).addPathPatterns("/api/v1/**");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new ReadContextResolver());
    }

    /** Hands the context the interceptor resolved to a handler parameter of type {@link ReadContext}. */
    static final class ReadContextResolver implements HandlerMethodArgumentResolver {

        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return ReadContext.class.equals(parameter.getParameterType());
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mav, NativeWebRequest webRequest,
                                      WebDataBinderFactory binderFactory) {
            ReadContext ctx = PublicApiInterceptor.context(webRequest.getNativeRequest(HttpServletRequest.class));
            if (ctx == null) throw new IllegalStateException("ReadContext is only available in @PublicApi controllers");
            return ctx;
        }
    }
}
