package az.tarix.platform.editorial.internal.validation;

/** One group of pre-publish checks. Rules only read the context and report issues to it. */
public interface ValidationRule {

    void check(ValidationContext ctx);
}
