package az.tarix.platform.shared.domain;

/** Kinds of entities that can be linked to each other. */
public enum EntityType implements DataEnum {
    PERSON, CONFLICT, BATTLE, STATE, PLACE, POLITY, RULER, ERA, HERO;
}
