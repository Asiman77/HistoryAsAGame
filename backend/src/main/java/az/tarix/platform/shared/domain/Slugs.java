package az.tarix.platform.shared.domain;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Slug rules: lower-case latin letters, digits and single hyphens, at most 120 characters
 * (same as the SQL function {@code is_slug}). A slug never changes after publishing; a
 * rename goes through {@code slug_redirect}.
 */
public final class Slugs {

    public static final int MAX_LENGTH = 120;
    private static final Pattern VALID = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");

    private Slugs() {}

    public static boolean isValid(String slug) {
        return slug != null && slug.length() <= MAX_LENGTH && VALID.matcher(slug).matches();
    }

    public static String requireValid(String slug) {
        if (!isValid(slug)) throw new IllegalArgumentException("invalid slug: " + slug);
        return slug;
    }

    /**
     * Suggests a slug for a title: "Şah İsmayıl Xətai" → "shah-ismayil-xetai".
     * Azerbaijani letters: ə→e, ı/İ→i, ş→sh, ç→ch, ğ→gh, ö→o, ü→u; other accents are dropped.
     * Only a suggestion for new documents: existing slugs are kept as they are.
     */
    public static String suggest(String title) {
        String s = title
                .replace("Ə", "e").replace("ə", "e")
                .replace("İ", "i").replace("I", "i").replace("ı", "i")
                .replace("Ş", "sh").replace("ş", "sh")
                .replace("Ç", "ch").replace("ç", "ch")
                .replace("Ğ", "gh").replace("ğ", "gh")
                .replace("Ö", "o").replace("ö", "o")
                .replace("Ü", "u").replace("ü", "u");
        s = COMBINING_MARKS.matcher(Normalizer.normalize(s, Normalizer.Form.NFD)).replaceAll("");
        s = NON_ALNUM.matcher(s.toLowerCase(Locale.ROOT)).replaceAll("-");
        s = trimHyphens(s);
        if (s.length() > MAX_LENGTH) s = trimHyphens(s.substring(0, MAX_LENGTH));
        if (s.isEmpty()) throw new IllegalArgumentException("cannot build a slug from: " + title);
        return s;
    }

    private static String trimHyphens(String s) {
        int start = 0;
        int end = s.length();
        while (start < end && s.charAt(start) == '-') start++;
        while (end > start && s.charAt(end - 1) == '-') end--;
        return s.substring(start, end);
    }
}
