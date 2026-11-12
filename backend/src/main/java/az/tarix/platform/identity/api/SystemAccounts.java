package az.tarix.platform.identity.api;

import java.util.UUID;

/** Accounts that act on behalf of the system, not of a person. They have no password and cannot log in. */
public interface SystemAccounts {

    /** Author of revisions written by the data importer; created on first use. */
    UUID importer();
}
