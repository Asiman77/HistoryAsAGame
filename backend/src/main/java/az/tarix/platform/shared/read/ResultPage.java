package az.tarix.platform.shared.read;

import java.util.List;

/** One page of a public list (BACKEND_SPEC.md §10: {@code ?page=0&size=20}, at most 100). */
public record ResultPage<T>(List<T> items, int page, int size, long totalElements) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    /** A validated page request. */
    public record Request(int page, int size) {

        public Request {
            if (page < 0) throw new InvalidParameterException("page", "0 və ya daha böyük olmalıdır");
            if (size < 1 || size > MAX_SIZE) throw new InvalidParameterException("size", "1–" + MAX_SIZE + " aralığında olmalıdır");
        }

        public static Request of(Integer page, Integer size) {
            return new Request(page == null ? 0 : page, size == null ? DEFAULT_SIZE : size);
        }

        public long offset() {
            return (long) page * size;
        }
    }

    public static <T> ResultPage<T> of(List<T> items, Request request, long total) {
        return new ResultPage<>(List.copyOf(items), request.page(), request.size(), total);
    }
}
