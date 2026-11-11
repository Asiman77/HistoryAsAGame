package az.tarix.platform.shared.domain;

/** What kind of statement a step or claim is: confirmed, disputed, folk tradition or literary text. */
public enum ClaimType implements DataEnum {
    FACT, DISPUTED, LEGEND, LITERARY;
}
