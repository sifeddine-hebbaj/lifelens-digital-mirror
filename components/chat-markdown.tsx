"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { looksLikeUrl, safeHref, siteName } from "@/lib/chat-format";
import { bidiSegments, textDirection } from "@/lib/bidi";

type Align = "left" | "center" | "right" | undefined;
type ListItem = { text: string; checked?: boolean; children: Block[] };
type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "quote"; children: Block[] }
  | { type: "hr" }
  | { type: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { type: "table"; align: Align[]; header: string[]; rows: string[][] };

const fenceRe = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)[^\n]*$/;
const headingRe = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const hrRe = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const quoteRe = /^\s{0,3}>\s?(.*)$/;
const listRe = /^(\s*)([-*+•]|\d{1,9}[.)])\s+(.*)$/;
const tableSepRe = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function indentWidth(text: string) {
  return text.replace(/\t/g, "    ").length;
}

function leadingIndent(line: string) {
  return indentWidth(line.match(/^\s*/)?.[0] ?? "");
}

function splitRow(line: string) {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells: string[] = [];
  let cell = "";
  let inCode = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === "\\" && row[index + 1] === "|") { cell += "|"; index += 1; continue; }
    if (char === "`") inCode = !inCode;
    if (char === "|" && !inCode) { cells.push(cell.trim()); cell = ""; continue; }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function isTableStart(lines: string[], index: number) {
  const next = lines[index + 1];
  return lines[index].includes("|") && next !== undefined && next.includes("|") && next.includes("-") && tableSepRe.test(next);
}

function startsBlock(lines: string[], index: number) {
  const line = lines[index];
  return fenceRe.test(line) || headingRe.test(line) || hrRe.test(line) || quoteRe.test(line) || listRe.test(line) || isTableStart(lines, index);
}

function dedent(lines: string[]) {
  const indents = lines.filter((line) => line.trim()).map(leadingIndent);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.replace(/\t/g, "    ").slice(Math.min(min, leadingIndent(line))));
}

function parseList(lines: string[]): Block[] {
  const blocks: Block[] = [];
  const base = leadingIndent(lines[0]);
  let raw: { text: string[]; sub: string[]; checked?: boolean; ordered: boolean; start: number }[] = [];
  const flush = () => {
    if (!raw.length) return;
    blocks.push({
      type: "list",
      ordered: raw[0].ordered,
      start: raw[0].start,
      items: raw.map((item) => ({ text: item.text.join("\n"), checked: item.checked, children: item.sub.some((line) => line.trim()) ? parseBlocks(dedent(item.sub)) : [] })),
    });
    raw = [];
  };
  for (const line of lines) {
    const match = line.match(listRe);
    if (match && indentWidth(match[1]) <= base + 1) {
      const ordered = /\d/.test(match[2]);
      if (raw.length && raw[0].ordered !== ordered) flush();
      let text = match[3];
      let checked: boolean | undefined;
      const task = text.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) { checked = task[1] !== " "; text = task[2]; }
      raw.push({ text: [text], sub: [], checked, ordered, start: ordered ? Number.parseInt(match[2], 10) : 1 });
      continue;
    }
    const last = raw[raw.length - 1];
    if (!last) continue;
    if (match || last.sub.length) last.sub.push(line);
    else if (line.trim()) last.text.push(line.trim());
  }
  flush();
  return blocks;
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(fenceRe);
    if (fence) {
      const marker = fence[1];
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(marker)) { body.push(lines[index]); index += 1; }
      index += 1;
      blocks.push({ type: "code", lang: fence[2], code: body.join("\n") });
      continue;
    }

    const heading = line.match(headingRe);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (hrRe.test(line)) { blocks.push({ type: "hr" }); index += 1; continue; }

    if (isTableStart(lines, index)) {
      const header = splitRow(line);
      const align = splitRow(lines[index + 1]).map((cell): Align => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : undefined);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) { rows.push(splitRow(lines[index])); index += 1; }
      const width = Math.max(header.length, ...rows.map((row) => row.length));
      const pad = (row: string[]) => Array.from({ length: width }, (_, cell) => row[cell] ?? "");
      blocks.push({ type: "table", header: pad(header), align: Array.from({ length: width }, (_, cell) => align[cell]), rows: rows.map(pad) });
      continue;
    }

    if (quoteRe.test(line)) {
      const inner: string[] = [];
      while (index < lines.length && lines[index].trim()) {
        const quoted = lines[index].match(quoteRe);
        inner.push(quoted ? quoted[1] : lines[index]);
        index += 1;
      }
      blocks.push({ type: "quote", children: parseBlocks(inner) });
      continue;
    }

    const listMatch = line.match(listRe);
    if (listMatch) {
      const base = indentWidth(listMatch[1]);
      const collected: string[] = [];
      while (index < lines.length) {
        const current = lines[index];
        if (current.trim()) {
          const isItem = listRe.test(current) && leadingIndent(current) <= base + 1;
          const isNested = leadingIndent(current) > base;
          const isLazy = !startsBlock(lines, index) && collected.length > 0 && lines[index - 1].trim() !== "";
          if (!isItem && !isNested && !isLazy) break;
          collected.push(current);
          index += 1;
          continue;
        }
        let next = index + 1;
        while (next < lines.length && !lines[next].trim()) next += 1;
        if (next >= lines.length) break;
        const continues = leadingIndent(lines[next]) > base || (listRe.test(lines[next]) && leadingIndent(lines[next]) <= base + 1);
        if (!continues) break;
        collected.push("");
        index += 1;
      }
      blocks.push(...parseList(collected));
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && (paragraph.length === 0 || !startsBlock(lines, index))) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }
  return blocks;
}

const inlineRe = new RegExp([
  String.raw`\\(?<esc>[\\\x60*_{}\[\]()#+\-.!|~>])`,
  String.raw`(?<tick>\x60+)(?<code>[^\x60]|[^\x60][\s\S]*?[^\x60])\k<tick>(?!\x60)`,
  String.raw`!?\[(?<label>[^\]\n]*(?:\[[^\]\n]*\][^\]\n]*)*)\]\(\s*<?(?<href>[^\s<>()]*(?:\([^\s<>()]*\)[^\s<>()]*)*)>?(?:\s+["'][^"'\n]*["'])?\s*\)`,
  String.raw`<(?<auto>(?:https?:\/\/|mailto:)[^\s<>]+)>`,
  String.raw`(?<bm>\*\*|__)(?=\S)(?<bold>[\s\S]*?\S)\k<bm>`,
  String.raw`~~(?=\S)(?<strike>[\s\S]*?\S)~~`,
  String.raw`(?<im>[*_])(?=[^\s*_])(?<em>[^\n]*?[^\s\\])\k<im>`,
  String.raw`(?<url>(?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,:;!?'")\]*_~])`,
].join("|"), "g");

function textWithBreaks(text: string, key: string): ReactNode[] {
  return text.split("\n").flatMap((part, index) => index === 0 ? [part] : [<br key={`${key}-br-${index}`} />, part]).filter((part) => part !== "");
}

function renderBidiText(text: string, key: string): ReactNode[] {
  return bidiSegments(text).map((segment, index) => {
    const content = textWithBreaks(segment.text, `${key}-${index}`);
    return <bdi key={`${key}-bidi-${index}`} className={`md-bidi-${segment.direction}`} dir={segment.direction}>{content}</bdi>;
  });
}

function ChatLink({ href, children, source }: { href: string; children: ReactNode; source?: boolean }) {
  const { t } = useLanguage();
  const external = /^https?:/i.test(href);
  return <a className={source ? "md-link md-link-source" : "md-link"} href={href} title={href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})} aria-label={source ? `${t("openLink")}: ${href}` : undefined}>
    {source && <Globe size={12} aria-hidden="true" />}
    <bdi className="md-bidi-auto" dir="auto">{children}</bdi>
    {external && !source && <ExternalLink className="md-link-icon" size={11} aria-hidden="true" />}
  </a>;
}

function renderLink(rawHref: string, label: string, key: string): ReactNode {
  const href = safeHref(rawHref);
  if (!href) return label || rawHref;
  const bare = !label.trim() || looksLikeUrl(label) || label.trim() === rawHref.trim();
  return <ChatLink key={key} href={href} source={bare}>{bare ? siteName(href) : renderInline(label, key)}</ChatLink>;
}

function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = new RegExp(inlineRe.source, "g");
  let cursor = 0;
  let plain = "";
  let match: RegExpExecArray | null;
  const flushPlain = () => {
    if (plain) nodes.push(...renderBidiText(plain, `${keyPrefix}-${nodes.length}`));
    plain = "";
  };
  while ((match = re.exec(text))) {
    const groups = match.groups ?? {};
    const before = text[match.index - 1] ?? "";
    const after = text[match.index + match[0].length] ?? "";
    // Leave snake_case and intra-word underscores untouched.
    if ((groups.im === "_" || groups.bm === "__") && (/\w/.test(before) || /\w/.test(after))) {
      plain += text.slice(cursor, match.index + 1);
      cursor = match.index + 1;
      re.lastIndex = cursor;
      continue;
    }
    plain += text.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const key = `${keyPrefix}-${match.index}`;
    if (groups.esc !== undefined) { plain += groups.esc; continue; }
    if (groups.url !== undefined) {
      let url = groups.url;
      if (after === ")" && (url.match(/\(/g)?.length ?? 0) > (url.match(/\)/g)?.length ?? 0)) { url += ")"; cursor += 1; re.lastIndex = cursor; }
      flushPlain();
      nodes.push(renderLink(url, "", key));
      continue;
    }
    flushPlain();
    if (groups.code !== undefined) nodes.push(<code key={key} className="md-inline-code" dir="ltr">{groups.code.replace(/^ (.*) $/, "$1")}</code>);
    else if (groups.href !== undefined) nodes.push(renderLink(groups.href, groups.label ?? "", key));
    else if (groups.auto !== undefined) nodes.push(renderLink(groups.auto, "", key));
    else if (groups.bold !== undefined) nodes.push(<strong key={key}>{renderInline(groups.bold, key)}</strong>);
    else if (groups.strike !== undefined) nodes.push(<del key={key}>{renderInline(groups.strike, key)}</del>);
    else if (groups.em !== undefined) nodes.push(<em key={key}>{renderInline(groups.em, key)}</em>);
  }
  plain += text.slice(cursor);
  flushPlain();
  return nodes;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return <div className="md-code" dir="ltr">
    <div className="md-code-head">
      <span>{lang || "code"}</span>
      <button type="button" onClick={() => void copy()} aria-label={copied ? t("copied") : t("copyCode")}>{copied ? <Check size={13} /> : <Copy size={13} />}<span>{copied ? t("copied") : t("copyCode")}</span></button>
    </div>
    <pre dir="ltr"><code>{code}</code></pre>
  </div>;
}

function blockText(block: Block): string {
  switch (block.type) {
    case "heading":
    case "paragraph": return block.text;
    case "code": return block.code;
    case "quote": return block.children.map(blockText).join(" ");
    case "list": return block.items.map((item) => `${item.text} ${item.children.map(blockText).join(" ")}`).join(" ");
    case "table": return [...block.header, ...block.rows.flat()].join(" ");
    case "hr": return "";
  }
}

const numericCell = /^[\s+\-−~≈<>]*[\d\s.,:%/]+\s*([a-zA-Z€$£¥%°]{0,5}|MAD|DH|h|min)?\s*$/;

function renderBlocks(blocks: Block[], keyPrefix: string): ReactNode[] {
  return blocks.map((block, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (block.type) {
      case "heading": {
        const Tag = block.level <= 1 ? "h3" : block.level === 2 ? "h4" : "h5";
        return <Tag key={key} className={`md-heading md-h${Math.min(block.level, 3)}`} dir={textDirection(block.text)}>{renderInline(block.text, key)}</Tag>;
      }
      case "paragraph":
        return <p key={key} className="md-p" dir={textDirection(block.text)}>{renderInline(block.text, key)}</p>;
      case "code":
        return <CodeBlock key={key} code={block.code} lang={block.lang} />;
      case "quote":
        return <blockquote key={key} className="md-quote" dir={textDirection(blockText(block))}>{renderBlocks(block.children, key)}</blockquote>;
      case "hr":
        return <hr key={key} className="md-hr" />;
      case "list": {
        const items = block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`} className={item.checked !== undefined ? "md-task" : undefined}>
          {item.checked !== undefined && <input type="checkbox" checked={item.checked} readOnly disabled aria-hidden="true" />}
          <span className="md-li-text" dir={textDirection(item.text)}>{renderInline(item.text, `${key}-${itemIndex}`)}</span>
          {item.children.length > 0 && renderBlocks(item.children, `${key}-${itemIndex}-c`)}
        </li>);
        return block.ordered
          ? <ol key={key} className="md-list md-ol" start={block.start !== 1 ? block.start : undefined} dir={textDirection(blockText(block))}>{items}</ol>
          : <ul key={key} className="md-list md-ul" dir={textDirection(blockText(block))}>{items}</ul>;
      }
      case "table":
        return <div key={key} className="md-table-wrap" role="region" aria-label={block.header.join(" · ")} tabIndex={0} dir={textDirection(blockText(block))}>
          <table className="md-table" dir={textDirection(blockText(block))}>
            <thead><tr>{block.header.map((cell, cellIndex) => <th key={cellIndex} scope="col" dir={textDirection(cell)} style={block.align[cellIndex] ? { textAlign: block.align[cellIndex] } : undefined}>{renderInline(cell, `${key}-h${cellIndex}`)}</th>)}</tr></thead>
            <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} dir={textDirection(cell)} className={numericCell.test(cell) && cell.trim() ? "md-num" : undefined} style={block.align[cellIndex] ? { textAlign: block.align[cellIndex] } : undefined}>{renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>;
      default:
        return <Fragment key={key} />;
    }
  });
}

export function ChatMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n").map((line) => line.replace(/\s+$/, ""));
  return <div className="md-body" dir={textDirection(content)}>{renderBlocks(parseBlocks(lines), "b")}</div>;
}

/** Plain text with clickable links, for user-written messages. */
export function LinkifiedText({ content }: { content: string }) {
  const nodes: ReactNode[] = [];
  const re = /(?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,:;!?'")\]]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    nodes.push(...renderBidiText(content.slice(cursor, match.index), `u-${match.index}`));
    const href = safeHref(match[0]);
    nodes.push(href ? <ChatLink key={match.index} href={href}>{match[0]}</ChatLink> : match[0]);
    cursor = match.index + match[0].length;
  }
  nodes.push(...renderBidiText(content.slice(cursor), "u-end"));
  return <>{nodes}</>;
}
