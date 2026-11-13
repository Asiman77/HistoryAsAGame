package az.tarix.platform.shared.read;

/** A query parameter of a public API request is malformed or out of range (400). */
public class InvalidParameterException extends RuntimeException {

    private final String parameter;

    public InvalidParameterException(String parameter, String message) {
        super(parameter + ": " + message);
        this.parameter = parameter;
    }

    public String parameter() {
        return parameter;
    }
}
