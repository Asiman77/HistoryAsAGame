package az.tarix.platform.publishing.internal;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Scheduling for the retry of failed projections. */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
class PublishingConfiguration {}
