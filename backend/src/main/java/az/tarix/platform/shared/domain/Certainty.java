package az.tarix.platform.shared.domain;

/** How sure the sources are about a date or a border. */
public enum Certainty implements DataEnum {
    EXACT, APPROXIMATE, DISPUTED;
}
