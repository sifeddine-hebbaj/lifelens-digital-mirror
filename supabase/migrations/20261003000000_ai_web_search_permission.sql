-- Per-conversation Web Search consent for Ask AI: {status: "pending" | "approved", query, task}.
alter table public.ai_conversations
  add column if not exists web_search_state jsonb;
