package az.tarix.platform.analytics.internal.web;

import az.tarix.platform.analytics.internal.service.AnalyticsProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AnalyticsProperties.class)
class AnalyticsWebConfiguration {

    /** Before security and the body parsing: an oversized batch costs (almost) nothing. */
    @Bean
    FilterRegistrationBean<EventBodyLimitFilter> eventBodyLimit(AnalyticsProperties props) {
        FilterRegistrationBean<EventBodyLimitFilter> reg = new FilterRegistrationBean<>(new EventBodyLimitFilter(props.maxBody().toBytes()));
        reg.addUrlPatterns("/api/v1/events");
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        return reg;
    }
}
