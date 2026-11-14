package az.tarix.platform.analytics.internal.web;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Keeps an event batch under the size limit before anything parses it. With a
 * {@code Content-Length} (browsers, {@code sendBeacon}) an oversized body is refused unread;
 * a chunked body is read at most up to the limit. A plain servlet filter: Modulith
 * observability proxies module beans, which breaks the final methods of Spring's filter bases.
 */
class EventBodyLimitFilter implements Filter {

    private final long maxBytes;

    EventBodyLimitFilter(long maxBytes) {
        this.maxBytes = maxBytes;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        if (!"POST".equals(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }
        long length = request.getContentLengthLong();
        if (length > maxBytes) {
            tooLarge((HttpServletResponse) res);
            return;
        }
        if (length >= 0) {
            chain.doFilter(req, res);
            return;
        }
        byte[] body = request.getInputStream().readNBytes((int) maxBytes + 1);
        if (body.length > maxBytes) {
            tooLarge((HttpServletResponse) res);
            return;
        }
        chain.doFilter(new BufferedBody(request, body), res);
    }

    private void tooLarge(HttpServletResponse res) throws IOException {
        res.setStatus(413);
        res.setContentType("application/problem+json");
        res.setHeader("Cache-Control", "no-store");
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.getWriter().write("{\"type\":\"https://tarixin-icinde.az/problems/content-too-large\",\"status\":413,"
                + "\"detail\":\"Sorğu " + maxBytes + " baytdan böyükdür.\"}");
    }

    /** The request with its body already read (within the limit). */
    private static final class BufferedBody extends HttpServletRequestWrapper {

        private final byte[] body;

        BufferedBody(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            InputStream in = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public int read() throws IOException {
                    return in.read();
                }

                @Override
                public int read(byte[] b, int off, int len) throws IOException {
                    return in.read(b, off, len);
                }

                @Override
                public boolean isFinished() {
                    return false;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            String cs = getCharacterEncoding() == null ? StandardCharsets.UTF_8.name() : getCharacterEncoding();
            return new BufferedReader(new InputStreamReader(new ByteArrayInputStream(body), java.nio.charset.Charset.forName(cs)));
        }

        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }
}
