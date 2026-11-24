package az.tarix.platform.shared.domain;

/**
 * How the simulation shows a step on the map (FRONTEND_SPEC §5.2). Optional on a step: the
 * frontend derives one from the step when it is absent (a route → journey, an outcome → battle…).
 */
public enum StepTemplate implements DataEnum {
    LOCATION, JOURNEY, BATTLE, TERRITORY, LIBERATION, INFOGRAPHIC, MONUMENT, ARTIFACT, MIGRATION, TREATY;
}
