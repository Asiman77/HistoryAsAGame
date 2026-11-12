package az.tarix.platform.editorial.internal.validation;

import az.tarix.platform.editorial.internal.validation.ValidationIssue.Level;
import java.util.List;

/** All findings for one revision; {@link #publishable()} when there is no ERROR. */
public record ValidationReport(int revisionNo, int schemaVersion, List<ValidationIssue> issues) {

    public ValidationReport {
        issues = List.copyOf(issues);
    }

    public boolean publishable() {
        return count(Level.ERROR) == 0;
    }

    public long count(Level level) {
        return issues.stream().filter(i -> i.level() == level).count();
    }

    public List<ValidationIssue> errors() {
        return issues.stream().filter(i -> i.level() == Level.ERROR).toList();
    }
}
