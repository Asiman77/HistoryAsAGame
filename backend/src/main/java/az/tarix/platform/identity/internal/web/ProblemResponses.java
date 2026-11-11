package az.tarix.platform.identity.internal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * 401 and 403 from the security filter chain as RFC 9457 Problem Details, like every other
 * error of the API. 401 also carries {@code WWW-Authenticate: Bearer} (RFC 6750).
 */
@Component
class ProblemResponses implements AuthenticationEntryPoint, AccessDeniedHandler {

    static final URI UNAUTHORIZED = URI.create("https://tarixin-icinde.az/problems/unauthorized");
    static final URI FORBIDDEN = URI.create("https://tarixin-icinde.az/problems/forbidden");

    private final JsonMapper json;

    ProblemResponses(JsonMapper json) {
        this.json = json;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
            throws IOException {
        boolean badToken = e instanceof InvalidBearerTokenException;
        response.setHeader("WWW-Authenticate", badToken ? "Bearer error=\"invalid_token\"" : "Bearer");
        write(response, HttpStatus.UNAUTHORIZED, UNAUTHORIZED,
                badToken ? "The access token is invalid or expired." : "Authentication is required.");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException e)
            throws IOException {
        write(response, HttpStatus.FORBIDDEN, FORBIDDEN, "You do not have permission for this action.");
    }

    private void write(HttpServletResponse response, HttpStatus status, URI type, String detail) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(type);
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        json.writeValue(response.getOutputStream(), problem);
    }
}
