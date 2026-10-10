export type TextDirection = "rtl" | "ltr";
export type BidiSegment = { text: string; direction: TextDirection };

const arabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const latinOrNumber = /[\p{Script=Latin}\p{Number}]/u;
const ltrStart = String.raw`[\p{Script=Latin}\p{Number}€£¥$]`;
const ltrCharacters = String.raw`[\p{Script=Latin}\p{Number}\p{M}_@#$%&*+=:/?~.,;()\[\]{}"'\-€£¥]`;
const ltrRun = new RegExp(`${ltrStart}${ltrCharacters}*(?:\\s+${ltrStart}${ltrCharacters}*)*`, "gu");

export function textDirection(text: string): TextDirection {
  return arabicScript.test(text) ? "rtl" : "ltr";
}

export function bidiSegments(text: string): BidiSegment[] {
  const segments: BidiSegment[] = [];
  const baseDirection = textDirection(text);
  const matcher = new RegExp(ltrRun.source, "gu");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    if (match.index > cursor) {
      const plain = text.slice(cursor, match.index);
      const direction = arabicScript.test(plain) ? "rtl" : latinOrNumber.test(plain) ? "ltr" : baseDirection;
      segments.push({ text: plain, direction });
    }
    segments.push({ text: match[0], direction: "ltr" });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    const plain = text.slice(cursor);
    const direction = arabicScript.test(plain) ? "rtl" : latinOrNumber.test(plain) ? "ltr" : baseDirection;
    segments.push({ text: plain, direction });
  }
  return segments;
}