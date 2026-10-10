export type ChatSource = { title: string; uri: string; domain: string };

const knownSiteNames: Record<string, string> = {
  wikipedia: "Wikipedia",
  youtube: "YouTube",
  youtu: "YouTube",
  github: "GitHub",
  linkedin: "LinkedIn",
  mayoclinic: "Mayo Clinic",
  healthline: "Healthline",
  webmd: "WebMD",
  medlineplus: "MedlinePlus",
  sleepfoundation: "Sleep Foundation",
  hsph: "Harvard",
  harvard: "Harvard",
  stackoverflow: "Stack Overflow",
  lemonde: "Le Monde",
  lefigaro: "Le Figaro",
  hespress: "Hespress",
  bankofengland: "Bank of England",
};
const redirectHosts = /(^|\.)vertexaisearch\.cloud\.google\.com$/i;

export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const candidate = /^www\./i.test(value) ? `https://${value}` : value;
  try {
    const url = new URL(candidate);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function hostnameOf(value: string) {
  try {
    return new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\d?\./, "");
  } catch {
    return "";
  }
}

/** Human site name for a URL or domain, e.g. https://www.cdc.gov/sleep → "CDC". */
export function siteName(value: string): string {
  if (/^mailto:/i.test(value)) return value.replace(/^mailto:/i, "");
  if (/^tel:/i.test(value)) return value.replace(/^tel:/i, "");
  const host = hostnameOf(value);
  if (!host) return value;
  const parts = host.split(".");
  let index = parts.length - 2;
  // Handle second-level public suffixes such as gov.uk, co.ma, com.au.
  if (index > 0 && parts[parts.length - 1].length === 2 && /^(co|com|gov|org|net|ac|edu|gouv)$/.test(parts[index])) index -= 1;
  const label = parts[Math.max(index, 0)] ?? host;
  if (knownSiteNames[label]) return knownSiteNames[label];
  if (label.length <= 3) return label.toUpperCase();
  return label.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function looksLikeUrl(text: string) {
  return /^(https?:\/\/|www\.)\S+$/i.test(text.trim());
}

function looksLikeDomain(text: string) {
  return /^[a-z\d-]+(\.[a-z\d-]+)+$/i.test(text.trim());
}

/** Readable name + secondary detail for a Web source card. */
export function describeSource(source: ChatSource): { name: string; detail: string } {
  const title = source.title.trim();
  const realDomain = source.domain && !redirectHosts.test(source.domain) ? source.domain : looksLikeDomain(title) ? title : hostnameOf(source.uri);
  const usableDomain = realDomain && !redirectHosts.test(realDomain) ? realDomain.replace(/^www\./, "") : "";
  if (!title || looksLikeDomain(title) || looksLikeUrl(title)) return { name: siteName(usableDomain || title || source.uri), detail: usableDomain };
  return { name: title, detail: usableDomain ? siteName(usableDomain) === title ? usableDomain : `${siteName(usableDomain)} · ${usableDomain}` : "" };
}

const legacySourceHeadings = ["Sources Web consultées", "Web sources consulted", "مصادر من الويب", "مصادر الويب / Web sources"];

/** Splits the Web sources appendix saved with assistant messages so it can be rendered as source cards. */
export function splitStoredSources(content: string): { body: string; sources: ChatSource[] } {
  const markdown = content.match(/\n\n\*\*[^*\n]{3,60}\*\*\n((?:- \[[^\]\n]*\]\([^\s)]+\)[ \t]*(?:\n|$))+)\s*$/);
  if (markdown && markdown.index !== undefined) {
    const sources = Array.from(markdown[1].matchAll(/- \[([^\]\n]*)\]\(([^\s)]+)\)/g)).flatMap(([, title, uri]) => {
      const href = safeHref(uri);
      return href ? [{ title, uri: href, domain: hostnameOf(href) }] : [];
    });
    return { body: content.slice(0, markdown.index).trimEnd(), sources };
  }
  const legacy = content.match(/\n\n([^\n:]{3,40}): ([^\n]+)\s*$/);
  if (legacy && legacy.index !== undefined && legacySourceHeadings.includes(legacy[1].trim())) {
    const sources = legacy[2].split("; ").flatMap((entry) => {
      const parsed = entry.match(/^(.*) \(([^()\s]+)\)$/);
      if (!parsed) return [];
      const [, title, domain] = parsed;
      const target = redirectHosts.test(domain) ? looksLikeDomain(title) ? title : "" : domain;
      return [{ title, uri: target ? `https://${target}` : "", domain: target }];
    });
    return { body: content.slice(0, legacy.index).trimEnd(), sources };
  }
  return { body: content, sources: [] };
}

export function sourcesAppendix(heading: string, sources: ChatSource[]) {
  const items = sources.map((source) => `- [${source.title.replace(/[[\]\n]/g, " ").trim() || source.domain}](${source.uri.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20")})`);
  return `**${heading}**\n${items.join("\n")}`;
}

/** Converts Markdown to plain text suitable for text-to-speech. */
export function toSpeechText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<?(https?:\/\/|www\.)[^\s>]+>?/g, "")
    .replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm, "")
    .replace(/^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$/gm, "")
    .replace(/[ \t]*\|[ \t]*/g, ", ")
    .replace(/^[ \t]*(#{1,6}[ \t]+|>[ \t]?|[-*+•][ \t]+(\[[ xX]\][ \t]+)?)/gm, "")
    .replace(/^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gm, "")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|[\s(])[*_](\S[^*_\n]*?)[*_](?=[\s).,!?:;]|$)/gm, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
