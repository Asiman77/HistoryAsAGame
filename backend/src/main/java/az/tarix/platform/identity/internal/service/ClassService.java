package az.tarix.platform.identity.internal.service;

import az.tarix.platform.identity.api.ClassGroups;
import az.tarix.platform.identity.internal.domain.ClassGroup;
import az.tarix.platform.identity.internal.persistence.ClassGroupRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Teachers' classes: a teacher creates, renames and deletes their own; the code is generated.
 * Another teacher's class looks the same as one that does not exist (404), so codes cannot be
 * probed through this API.
 */
@Service
public class ClassService implements ClassGroups {

    /** Enough for any school year; stops a runaway client from filling the table. */
    public static final int MAX_CLASSES_PER_TEACHER = 100;

    private final ClassGroupRepository classes;
    private final Clock clock;
    private final RandomGenerator random;

    @Autowired
    ClassService(ClassGroupRepository classes, Clock clock) {
        this(classes, clock, new SecureRandom());
    }

    ClassService(ClassGroupRepository classes, Clock clock, RandomGenerator random) {
        this.classes = classes;
        this.clock = clock;
        this.random = random;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ClassGroupRef> byCode(String code) {
        String normalized = ClassGroups.normalize(code);
        if (normalized == null) return Optional.empty();
        return classes.findByCode(normalized).map(c -> new ClassGroupRef(c.id(), c.code(), c.name(), c.teacherId()));
    }

    @Transactional(readOnly = true)
    public List<ClassGroup> ofTeacher(UUID teacher) {
        return classes.findByTeacherIdOrderByCreatedAt(teacher);
    }

    @Transactional(readOnly = true)
    public List<ClassGroup> all() {
        return classes.findAll();
    }

    @Transactional(readOnly = true)
    public ClassGroup get(UUID teacher, String code) {
        return own(teacher, code);
    }

    @Transactional
    public ClassGroup create(UUID teacher, String name) {
        if (classes.countByTeacherId(teacher) >= MAX_CLASSES_PER_TEACHER) {
            throw AccountException.conflict("too-many-classes", "Bir müəllimin ən çox " + MAX_CLASSES_PER_TEACHER + " sinfi ola bilər.");
        }
        // 31^6 codes: a collision is very unlikely; a few retries make it practically impossible.
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = newCode();
            if (!classes.existsByCode(code)) return classes.save(new ClassGroup(code, name.strip(), teacher, clock.instant()));
        }
        throw AccountException.conflict("duplicate-code", "Sinif kodu yaradıla bilmədi; yenidən cəhd edin.");
    }

    @Transactional
    public ClassGroup rename(UUID teacher, String code, String name) {
        ClassGroup c = own(teacher, code);
        c.rename(name.strip(), clock.instant());
        return c;
    }

    @Transactional
    public void delete(UUID teacher, String code) {
        classes.delete(own(teacher, code));
    }

    String newCode() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        return code.toString();
    }

    private ClassGroup own(UUID teacher, String code) {
        String normalized = ClassGroups.normalize(code);
        return Optional.ofNullable(normalized).flatMap(classes::findByCode).filter(c -> c.teacherId().equals(teacher))
                .orElseThrow(() -> AccountException.notFound("Sinif tapılmadı."));
    }
}
