package az.tarix.platform.shared.domain;

import java.time.Year;
import java.time.YearMonth;
import java.util.Objects;

/**
 * A date as historians give it: possibly BC, possibly only a year or a month, and with a
 * stated certainty. {@link java.time.LocalDate} cannot express partial precision.
 *
 * <p>Years use astronomical numbering: 0 = 1 BC, -1 = 2 BC. Calendar checks are proleptic
 * Gregorian, the same rule as the SQL function {@code is_historical_date} (V003).
 *
 * @param year      any year; negative = BC
 * @param month     1–12, or null
 * @param day       1–31 and a real day of that month, or null
 * @param precision which parts are known; must match the parts given
 * @param certainty how sure the sources are
 */
public record HistoricalDate(int year, Integer month, Integer day, DatePrecision precision, Certainty certainty) {

    public HistoricalDate {
        Objects.requireNonNull(precision, "precision");
        Objects.requireNonNull(certainty, "certainty");
        if (day != null && month == null) {
            throw new IllegalArgumentException("a day needs a month");
        }
        if (month != null && (month < 1 || month > 12)) {
            throw new IllegalArgumentException("month out of range: " + month);
        }
        if (day != null && (day < 1 || day > YearMonth.of(year, month).lengthOfMonth())) {
            throw new IllegalArgumentException("no such day: %d-%02d-%02d".formatted(year, month, day));
        }
        DatePrecision implied = precisionOf(month, day);
        if (precision != implied) {
            throw new IllegalArgumentException("precision " + precision + " does not match the given parts (" + implied + ")");
        }
    }

    /** Builds a date with the precision implied by the parts given. */
    public static HistoricalDate of(int year, Integer month, Integer day, Certainty certainty) {
        return new HistoricalDate(year, month, day, precisionOf(month, day), certainty);
    }

    public static HistoricalDate ofYear(int year, Certainty certainty) {
        return of(year, null, null, certainty);
    }

    private static DatePrecision precisionOf(Integer month, Integer day) {
        if (day != null) return DatePrecision.DAY;
        if (month != null) return DatePrecision.MONTH;
        return DatePrecision.YEAR;
    }

    /**
     * {@code year * 10000 + month * 100 + day}, missing parts counting as 0. Sorts BC years
     * correctly because month and day add less than one year step. Stored as {@code *_sort_key}.
     */
    public long sortKey() {
        return year * 10_000L + (month == null ? 0 : month) * 100L + (day == null ? 0 : day);
    }

    /**
     * Compares only at the precision both dates have, so "1488" is neither before nor after
     * "9 July 1488" (same rule as {@code compareDates} in the frontend).
     */
    public int compareAtCommonPrecision(HistoricalDate other) {
        if (year != other.year) return Integer.compare(year, other.year);
        if (month == null || other.month == null) return 0;
        if (!month.equals(other.month)) return Integer.compare(month, other.month);
        if (day == null || other.day == null) return 0;
        return Integer.compare(day, other.day);
    }

    public boolean isLeapYear() {
        return Year.isLeap(year);
    }

    /**
     * Age at {@code date} of someone born on {@code birth}, mirroring {@code ageAt} in the
     * frontend: whole years, minus one if the birthday had not come yet; approximate when a
     * month or day is missing or either date is not exact.
     */
    public static Age ageAt(HistoricalDate birth, HistoricalDate date) {
        int years = date.year - birth.year;
        boolean precise = birth.certainty == Certainty.EXACT && date.certainty == Certainty.EXACT;
        if (birth.month != null && date.month != null) {
            boolean before = date.month < birth.month
                    || (date.month.equals(birth.month) && birth.day != null && date.day != null && date.day < birth.day);
            if (before) years -= 1;
            if (date.month.equals(birth.month) && (birth.day == null || date.day == null)) precise = false;
        } else {
            precise = false;
        }
        return new Age(Math.max(0, years), !precise);
    }

    /** Age in whole years and whether it is only approximate. */
    public record Age(int years, boolean approximate) {}
}
