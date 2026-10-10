import { z } from "zod";
import type { GoogleGenAI } from "@google/genai";

export const webSearchTopicSchema = z.enum(["sleep_health", "physical_activity", "nutrition", "wellbeing", "habit_science", "digital_wellbeing", "productivity", "financial_basics", "current_facts"]);
export type WebSearchTopic = z.infer<typeof webSearchTopicSchema>;
export const searchTopics = [...webSearchTopicSchema.options, "none"] as const;
export type SearchTopic = typeof searchTopics[number];
export type WebSource = { title: string; uri: string; domain: string };
export type WebSearchResult = { topic?: Exclude<SearchTopic, "none">; query: string; summary: string; sources: WebSource[] };

// Per-conversation consent: "pending" waits for the user's yes; "approved" covers follow-up searches for the same task.
export const webSearchStateSchema = z.object({
  status: z.enum(["pending", "approved"]),
  query: z.string().min(1).max(200),
  task: z.string().max(1000),
});
export type WebSearchState = z.infer<typeof webSearchStateSchema>;
export type PermissionReply = "granted" | "declined" | "none";
export type WebSearchPlan = { permission: PermissionReply; needsWebSearch: boolean; explicitRequest: boolean; sameTask: boolean; query: string };

const topicQueries: Record<WebSearchTopic, string> = {
  sleep_health: "site:cdc.gov OR site:nih.gov adult sleep duration sleep health recommendations",
  physical_activity: "site:who.int adults physical activity guidelines recommendations",
  nutrition: "site:who.int healthy diet evidence based recommendations",
  wellbeing: "site:who.int mental wellbeing self care professional support guidance",
  habit_science: "habit formation behavior change systematic review evidence university research",
  digital_wellbeing: "screen time digital wellbeing evidence based adult recommendations health authority",
  productivity: "evidence based focus work breaks productivity university research",
  financial_basics: "site:consumerfinance.gov budgeting savings financial wellbeing guidance",
  current_facts: "reliable official current public facts authoritative sources",
};

const affirmativeWords = new Set(["wakha", "wakhha", "waxa", "wa5a", "ah", "ahh", "aah", "eh", "ih", "iyeh", "ayeh", "aywa", "sir", "sirr", "yes", "yeah", "yep", "yup", "ok", "okay", "okey", "oki", "oui", "ouais", "daccord", "dac", "vasy", "sure", "naam", "na3am", "n3am", "نعم", "واخا", "وخا", "اه", "ايه", "ايوا", "ايوه", "سير", "اوكي", "موافق", "تفضل"]);
const permissionFillers = new Set(["3afak", "afak", "please", "pls", "stp", "svp", "qlb", "9lb", "9leb", "qleb", "search", "cherche", "chercher", "recherche", "dir", "diri", "go", "ahead", "do", "it", "merci", "thanks", "mzyan", "bien", "sur", "sûr", "yallah", "yalah", "عافاك", "قلب", "دير", "ابحث", "بحث", "يالاه", "يلا", "مزيان"]);
const negativeWords = new Set(["la", "lla", "no", "non", "nope", "nah", "لا", "بلا"]);
const negativeFillers = new Set(["merci", "thanks", "thank", "you", "shukran", "choukran", "chokran", "3afak", "safi", "mabghitch", "pas", "besoin", "need", "daba", "شكرا", "صافي", "مابغيتش", "دابا"]);

function permissionTokens(message: string) {
  return message.toLowerCase().normalize("NFC").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/['’-]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
}

// Fast path for short, unambiguous replies to a pending permission question; anything else goes to the planner.
export function quickPermissionReply(message: string): PermissionReply | null {
  const tokens = permissionTokens(message);
  if (!tokens.length || tokens.length > 6) return null;
  if (negativeWords.has(tokens[0]) && tokens.every((token) => negativeWords.has(token) || negativeFillers.has(token))) return "declined";
  if (tokens.some((token) => affirmativeWords.has(token)) && tokens.every((token) => affirmativeWords.has(token) || permissionFillers.has(token))) return "granted";
  return null;
}

const planSchema = z.object({
  permission_reply: z.enum(["granted", "declined", "none"]),
  needs_web_search: z.boolean(),
  explicit_request: z.boolean(),
  same_task: z.boolean(),
  query: z.string().max(400),
});

export function sanitizeSearchQuery(query: string) {
  return query
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

// Sees only the user's own latest message and earlier task text; never Supabase records.
export async function planWebSearch(gemini: GoogleGenAI, message: string, state: WebSearchState | null): Promise<WebSearchPlan | null> {
  const stateNote = state?.status === "pending"
    ? `A Web Search is PENDING the user's permission. Proposed query: "${state.query}". Original request: "${state.task}".`
    : state?.status === "approved"
      ? `The user already approved Web Search for this task: "${state.task}" (last query: "${state.query}").`
      : "No Web Search is pending or approved.";
  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `You plan Web Search for LifeLens, a personal coach that already has the user's private records (sleep, mood, energy, stress, activities, habits, goals, journal, budget) and strong general knowledge. LifeLens solves problems itself first; Web Search is only a supporting tool.

Return JSON:
- needs_web_search: true ONLY when external or current information would materially improve the answer: explicit requests to search/look up/research/find something (e.g. "qlb liya", "9lb lia", "chof lia f internet", "cherche", "search", "find me", "قلب ليا"), job/internship/freelance listings, current events, news, prices, laws, regulations, schedules, products or services and their availability, latest software versions/docs or technical research, or explicit requests for official guidance, studies, or sources. FALSE for questions answerable from the user's own records, coaching, plans (sport, sleep, budget, study), emotional support, stable general knowledge, greetings, chit-chat, and follow-ups that need no new facts.
- explicit_request: true if the user explicitly asked to search, research, look up, or find external information.
- query: when needs_web_search is true, one concise public search query (max 12 words) describing only the public information need, in the language most likely to find good results. Keep public context the user wrote that matters for search (field, technology, city/country, product type). NEVER include names, emails, phone numbers, exact personal amounts, addresses, health details, or any personal/private detail. Empty string otherwise.
- permission_reply: if a search is PENDING, "granted" when the message approves it (wakha, ah, sir, yes, oui, نعم, go ahead, even with extra words), "declined" when it refuses, otherwise "none". Always "none" when nothing is pending.
- same_task: if a task is already approved, true when this message continues that same task (e.g. asks for more results, refinements, or a related lookup for the same goal); false otherwise.

State: ${stateNote}

Latest user message (planning only): ${message.slice(0, 2000)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            permission_reply: { type: "string", enum: ["granted", "declined", "none"] },
            needs_web_search: { type: "boolean" },
            explicit_request: { type: "boolean" },
            same_task: { type: "boolean" },
            query: { type: "string" },
          },
          required: ["permission_reply", "needs_web_search", "explicit_request", "same_task", "query"],
        },
        maxOutputTokens: 160,
        temperature: 0,
      },
    });
    const plan = planSchema.safeParse(JSON.parse(response.text ?? "{}"));
    if (!plan.success) return null;
    const query = sanitizeSearchQuery(plan.data.query);
    return {
      permission: state?.status === "pending" ? plan.data.permission_reply : "none",
      needsWebSearch: plan.data.needs_web_search && query.length > 0,
      explicitRequest: plan.data.explicit_request,
      sameTask: state?.status === "approved" && plan.data.same_task,
      query,
    };
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
    console.warn("Web Search planning failed", { name: error instanceof Error ? error.name : "unknown", status });
    return null;
  }
}

export async function searchPublicWeb(gemini: GoogleGenAI, topic: SearchTopic): Promise<WebSearchResult | null> {
  if (topic === "none") return null;
  return groundedSearch(gemini, topicQueries[topic], `Search the public web for reliable sources about this general topic. Summarize only sourced facts relevant to this topic in 3-5 concise bullet points. Do not infer anything about a specific person. Search query: ${topicQueries[topic]}`, 500, topic);
}

export async function searchWebQuery(gemini: GoogleGenAI, rawQuery: string): Promise<WebSearchResult | null> {
  const query = sanitizeSearchQuery(rawQuery);
  if (!query) return null;
  return groundedSearch(gemini, query, `Search the public web for reliable, current sources that answer this query. Summarize only facts stated by the sources in up to 8 concise bullet points. For listings (jobs, programs, products, services), give each item's name, organization or provider, location, and key details exactly as the source states them, and note dates when shown. Never invent results, names, prices, dates, or links; if sources are weak or missing, say so. Do not infer anything about a specific person. Search query: ${query}`, 900);
}

async function groundedSearch(gemini: GoogleGenAI, query: string, contents: string, maxOutputTokens: number, topic?: WebSearchTopic): Promise<WebSearchResult | null> {
  try {
    const response = await gemini.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: { tools: [{ googleSearch: {} }], maxOutputTokens },
    });
    const chunks = response.candidates?.flatMap((candidate) => candidate.groundingMetadata?.groundingChunks ?? []) ?? [];
    const sources = chunks.flatMap((chunk) => {
      const uri = chunk.web?.uri;
      if (!uri) return [];
      try {
        const parsed = new URL(uri);
        return [{ title: chunk.web?.title?.slice(0, 180) || parsed.hostname, uri, domain: parsed.hostname }];
      } catch {
        return [];
      }
    }).filter((source, index, all) => all.findIndex((item) => item.uri === source.uri) === index).slice(0, 5);
    const summary = response.text?.trim() ?? "";
    const groundingMetadata = response.candidates?.some((candidate) => candidate.groundingMetadata?.webSearchQueries?.length || candidate.groundingMetadata?.groundingChunks?.some((chunk) => chunk.web?.uri));
    if (!groundingMetadata) {
      console.warn("Google Search grounding returned no citations", { model: "gemini-3.5-flash", candidateCount: response.candidates?.length ?? 0 });
      return null;
    }
    return { topic, query, summary: summary.slice(0, 6000), sources };
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const reason = error instanceof Error ? error.message.replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]").slice(0, 240) : "unknown";
    console.error("Google Search grounding failed", { name: error instanceof Error ? error.name : "unknown", status, code, reason });
    return null;
  }
}
