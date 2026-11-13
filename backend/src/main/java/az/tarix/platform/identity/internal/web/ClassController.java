package az.tarix.platform.identity.internal.web;

import az.tarix.platform.identity.api.CurrentUserProvider;
import az.tarix.platform.identity.internal.domain.ClassGroup;
import az.tarix.platform.identity.internal.service.ClassService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Teacher classes (BACKEND_SPEC.md §7.3, §12). A TEACHER manages their own classes; an ADMIN may
 * list all of them. A class of another teacher is 404, the same as one that does not exist.
 */
@RestController
class ClassController {

    private final ClassService classes;
    private final CurrentUserProvider currentUser;

    ClassController(ClassService classes, CurrentUserProvider currentUser) {
        this.classes = classes;
        this.currentUser = currentUser;
    }

    record ClassView(String code, String name, Instant createdAt, Instant updatedAt) {
        static ClassView of(ClassGroup c) {
            return new ClassView(c.code(), c.name(), c.createdAt(), c.updatedAt());
        }
    }

    record AdminClassView(String code, String name, UUID teacherId, Instant createdAt) {}

    record ClassName(@NotBlank @Size(max = 120) String name) {}

    @GetMapping("/api/v1/teacher/classes")
    @PreAuthorize("hasRole('TEACHER')")
    ResponseEntity<List<ClassView>> mine() {
        return noStore(classes.ofTeacher(me()).stream().map(ClassView::of).toList());
    }

    /** The code is generated: six characters without look-alikes, e.g. {@code K7MQ2X}. */
    @PostMapping("/api/v1/teacher/classes")
    @PreAuthorize("hasRole('TEACHER')")
    ResponseEntity<ClassView> create(@Valid @RequestBody ClassName body) {
        ClassGroup c = classes.create(me(), body.name());
        return ResponseEntity.created(URI.create("/api/v1/teacher/classes/" + c.code())).cacheControl(CacheControl.noStore())
                .body(ClassView.of(c));
    }

    @GetMapping("/api/v1/teacher/classes/{code}")
    @PreAuthorize("hasRole('TEACHER')")
    ResponseEntity<ClassView> get(@PathVariable String code) {
        return noStore(ClassView.of(classes.get(me(), code)));
    }

    @PatchMapping("/api/v1/teacher/classes/{code}")
    @PreAuthorize("hasRole('TEACHER')")
    ResponseEntity<ClassView> rename(@PathVariable String code, @Valid @RequestBody ClassName body) {
        return noStore(ClassView.of(classes.rename(me(), code, body.name())));
    }

    /** Deletes the class; aggregated statistics already collected for its code stay (phase 12). */
    @DeleteMapping("/api/v1/teacher/classes/{code}")
    @PreAuthorize("hasRole('TEACHER')")
    ResponseEntity<Void> delete(@PathVariable String code) {
        classes.delete(me(), code);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/v1/admin/classes")
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<List<AdminClassView>> all() {
        return noStore(classes.all().stream()
                .map(c -> new AdminClassView(c.code(), c.name(), c.teacherId(), c.createdAt())).toList());
    }

    private UUID me() {
        return currentUser.require().id();
    }

    private static <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
