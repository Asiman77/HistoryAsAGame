/** Minimal glossary shape the tokenizer needs. */
export interface GlossaryTerm {
  id: string;
  forms: string[];
}

export type Segment = { text: string; termId?: string };

const LETTER = /[\p{L}\p{M}]/u;
// Suffixes in Azerbaijani start with one of these; a stem followed by anything else
// (e.g. "şah" in "şahzadə") is a different word.
const SUFFIX_START = /^[aıoueəiöüldtnsyçmğ]/;

/** Azerbaijani-aware lower-casing (İ → i, I → ı). */
export function lowerAz(s: string): string {
  return s.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

/**
 * Splits text into plain segments and glossary terms. Only the first
 * occurrence of each term is marked, so a paragraph is not covered in links.
 */
export function tokenizeGlossary(text: string, terms: readonly GlossaryTerm[], seen = new Set<string>()): Segment[] {
  const out: Segment[] = [];
  let plain = "";
  let i = 0;
  const flush = () => {
    if (plain) out.push({ text: plain });
    plain = "";
  };
  while (i < text.length) {
    const ch = text[i]!;
    if (!LETTER.test(ch) || (i > 0 && LETTER.test(text[i - 1]!))) {
      plain += ch;
      i++;
      continue;
    }
    let end = i;
    while (end < text.length && LETTER.test(text[end]!)) end++;
    const word = text.slice(i, end);
    const lower = lowerAz(word);
    const term = terms.find(
      (t) =>
        !seen.has(t.id) &&
        t.forms.some((f) => lower === f || (lower.startsWith(f) && SUFFIX_START.test(lower.slice(f.length)))),
    );
    if (term) {
      flush();
      out.push({ text: word, termId: term.id });
      seen.add(term.id);
    } else {
      plain += word;
    }
    i = end;
  }
  flush();
  return out;
}
