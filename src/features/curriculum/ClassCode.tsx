"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { setClassCode, usePrefs } from "@/stores/prefs";

/**
 * The class code a teacher gives out (FRONTEND_SPEC §10): typed once, kept on
 * this device. It will bring the topic the teacher assigned (teacher panel,
 * phase 13) and counts this device's anonymous events for the class.
 */
export function ClassCode() {
  const t = useTranslations("pages.curriculum.classCode");
  const code = usePrefs((p) => p.classCode);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (setClassCode(value)) {
      setEditing(false);
      setInvalid(false);
      setValue("");
    } else setInvalid(true);
  };

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-col gap-3 rounded-card border border-fg/12 p-4" data-testid="class-code-form" aria-label={t("title")}>
        <p className="m-0 text-14 font-semibold text-fg">{t("title")}</p>
        <p className="m-0 text-13 text-fg-muted">{t("lead")}</p>
        <label htmlFor={inputId} className="sr-only">
          {t("label")}
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="K7MQ2X"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className="min-h-11 rounded-button border border-fg/20 bg-surface px-3 font-mono text-16 tracking-[0.3em] text-fg placeholder:text-fg-muted/60 focus:border-accent focus:outline-none"
        />
        {invalid ? (
          <p id={errorId} className="m-0 text-13 text-negative" role="alert">
            {t("invalid")}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit">{t("save")}</Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    );
  }

  if (!code) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setEditing(true)} data-testid="class-code-open">
        {t("open")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-fg/12 p-4" data-testid="class-code">
      <p className="m-0 text-14 text-fg">{t("current", { code })}</p>
      <p className="m-0 text-13 text-fg-muted">{t("pending")}</p>
      <div className="flex gap-3 text-14">
        <button type="button" className="text-accent hover:underline" onClick={() => setEditing(true)}>
          {t("change")}
        </button>
        <button type="button" className="text-fg-muted hover:text-fg hover:underline" onClick={() => setClassCode(null)}>
          {t("remove")}
        </button>
      </div>
    </div>
  );
}
