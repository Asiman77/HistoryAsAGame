package az.tarix.platform.shared.web;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller of the public read API (BACKEND_SPEC.md §10). Its handlers get, without
 * code of their own: the language and content version ({@code ReadContext} argument), the
 * {@code ETag} / {@code 304} handling, the public {@code Cache-Control}, Problem Details for
 * errors and a 301 for renamed slugs.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface PublicApi {}
