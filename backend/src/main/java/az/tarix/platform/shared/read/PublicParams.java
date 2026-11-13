package az.tarix.platform.shared.read;

/** Checks of query parameters shared by several public endpoints; a bad value is a 400 naming the parameter. */
public final class PublicParams {

    /**
     * Years the API accepts. Astronomical numbering (0 = 1 BC), as {@code HistoricalDate}; the
     * bounds only keep out nonsense, the content itself starts in the 14th century.
     */
    public static final int MIN_YEAR = -5000;
    public static final int MAX_YEAR = 2100;

    private PublicParams() {}

    public static int year(String name, Integer value) {
        if (value == null) throw new InvalidParameterException(name, "məcburidir");
        if (value < MIN_YEAR || value > MAX_YEAR) {
            throw new InvalidParameterException(name, MIN_YEAR + "…" + MAX_YEAR + " aralığında olmalıdır");
        }
        return value;
    }

    public static double latitude(String name, Double value) {
        return coordinate(name, value, 90);
    }

    public static double longitude(String name, Double value) {
        return coordinate(name, value, 180);
    }

    private static double coordinate(String name, Double value, double limit) {
        if (value == null) throw new InvalidParameterException(name, "məcburidir");
        if (!Double.isFinite(value) || value < -limit || value > limit) {
            throw new InvalidParameterException(name, "-" + (int) limit + "…" + (int) limit + " aralığında olmalıdır");
        }
        return value;
    }
}
