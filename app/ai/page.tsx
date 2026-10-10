"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Bot, ExternalLink, Globe, History, Info, LoaderCircle, Lock, MessageCircle, Mic, Pause, Play, Plus, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMarkdown, LinkifiedText } from "@/components/chat-markdown";
import { describeSource, splitStoredSources } from "@/lib/chat-format";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { textDirection } from "@/lib/bidi";
import { LiveVoiceControl, type LiveTranscriptMessage } from "@/components/live-voice-control";
import { friendlyDate } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";
import { defaultVoiceLanguage, isVoiceLanguage, voiceLanguageCodes, type VoiceLanguage } from "@/lib/voice-language";

type Conversation = { id: string; title: string | null; created_at: string };
type DetectedLanguage = "ar" | "fr" | "en" | "mixed" | "unknown";
 type WebSource = { title: string; uri: string; domain: string };
 type Message = { id?: string; role: "user" | "assistant"; content: string; created_at?: string; detected_language?: DetectedLanguage; audio_base64?: string; audio_mime_type?: string; web_used?: boolean; web_sources?: WebSource[]; live?: boolean };
type VoiceStage = "idle" | "recording" | "thinking";
type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
const voiceLanguageStorageKey = "lifelens.voiceLanguageLock";
const voiceLanguageLabels: Record<VoiceLanguage, TranslationKey> = { darija: "voiceLangDarija", fr: "voiceLangFrench", en: "voiceLangEnglish" };
const languageLabels: Record<DetectedLanguage, TranslationKey> = { ar: "detectedArabic", fr: "detectedFrench", en: "detectedEnglish", mixed: "detectedMixed", unknown: "detectedUnknown" };
const localMessageId = () => globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function AIPage() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [voiceStage, setVoiceStage] = useState<VoiceStage>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>(defaultVoiceLanguage);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyCloseRef = useRef<HTMLButtonElement | null>(null);
  const historyPanelRef = useRef<HTMLElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const discardRecordingRef = useRef(false);

  const loadConversations = useCallback(async () => {
    const client = supabaseBrowser(); if (!client || !user) return;
    const { data } = await client.from("ai_conversations").select("id,title,created_at").order("created_at", { ascending: false }).limit(30);
    const rows = (data ?? []) as Conversation[];
    setConversations(rows);
    setLoading(false);
    return rows;
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const client = supabaseBrowser(); if (!client) return;
    const { data, error: queryError } = await client.from("ai_messages").select("id,role,content,created_at").eq("conversation_id", conversationId).order("created_at");
    if (queryError) { setError(queryError.message); return; }
    setMessages((data ?? []) as Message[]);
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    const stored = window.localStorage.getItem(voiceLanguageStorageKey);
    if (isVoiceLanguage(stored)) setVoiceLanguage(stored);
  }, []);
  useEffect(() => { if (activeId) void loadMessages(activeId); else setMessages([]); }, [activeId, loadMessages]);
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 32;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
    if (liveActive) {
      if (shouldStickToBottomRef.current && chatContainerRef.current) {
        chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
      }
      return;
    }
    if (shouldStickToBottomRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, sending, liveActive]);
  useEffect(() => {
    if (!historyOpen) return;
    const previousOverflow = document.body.style.overflow;
    const historyButton = historyButtonRef.current;
    document.body.style.overflow = "hidden";
    historyCloseRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHistoryOpen(false);
        return;
      }
      if (event.key !== "Tab" || !historyPanelRef.current) return;
      const focusable = Array.from(historyPanelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      historyButton?.focus();
    };
  }, [historyOpen]);
  useEffect(() => {
    discardRecordingRef.current = false;
    return () => {
      discardRecordingRef.current = true;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recognitionRef.current?.abort();
      playbackRef.current?.pause();
    };
  }, []);

  function autoResizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }

  useEffect(() => {
    autoResizeTextarea();
  }, [question]);

  function appendMessage(message: Message) {
    setMessages((current) => {
      if (message.id && current.some((item) => item.id === message.id)) return current;
      return [...current, message];
    });
  }

  async function ask(text: string, speak: boolean, fromVoice = false) {
    const response = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, language, speak, ...(fromVoice ? { voice_language: voiceLanguage } : {}), ...(activeId ? { conversation_id: activeId } : {}) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? result.error ?? t("aiError"));
    setActiveId(result.conversation_id);
    const answer: Message = { id: localMessageId(), role: "assistant", content: result.answer, created_at: new Date().toISOString(), detected_language: result.detected_language, audio_base64: result.audio_base64, audio_mime_type: result.audio_mime_type, web_used: result.web_used, web_sources: result.web_sources ?? [] };
    appendMessage(answer);
    void loadConversations();
    return result as { detected_language?: DetectedLanguage };
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || sending) return;
    setSending(true); setError(""); setQuestion("");
    const optimistic: Message = { id: localMessageId(), role: "user", content: text, created_at: new Date().toISOString() };
    appendMessage(optimistic);
    try {
      const result = await ask(text, voiceReplies);
      if (result.detected_language) setMessages((current) => current.map((message) => message.id === optimistic.id ? { ...message, detected_language: result.detected_language } : message));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your question.");
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setQuestion(text);
    } finally { setSending(false); }
  }

  async function askFromVoice(transcript: string) {
    const userMessage: Message = { id: localMessageId(), role: "user", content: transcript, created_at: new Date().toISOString() };
    appendMessage(userMessage);
    setVoiceStage("thinking");
    try {
      const result = await ask(transcript, voiceReplies, true);
      if (result.detected_language) setMessages((current) => current.map((message) => message.id === userMessage.id ? { ...message, detected_language: result.detected_language } : message));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("aiError"));
    } finally {
      setVoiceStage("idle");
      setRecordingSeconds(0);
    }
  }

  // Fallback push-to-talk: browser speech recognition pinned to the locked language (never auto-detect).
  function startRecording() {
    setError("");
    if (!window.isSecureContext) {
      setError(t("micRequiresSecure"));
      return;
    }
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError(t("speechFallbackUnsupported"));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = voiceLanguageCodes[voiceLanguage];
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    finalTranscriptRef.current = "";
    let failed = false;
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalTranscriptRef.current += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      setInterimTranscript(`${finalTranscriptRef.current}${interim}`.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      failed = true;
      setError(event.error === "not-allowed" || event.error === "service-not-allowed" ? t("micPermissionDenied") : t("micUnsupported"));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
      setInterimTranscript("");
      if (discardRecordingRef.current) return;
      const transcript = finalTranscriptRef.current.trim();
      if (!transcript || failed) {
        if (!failed) setError(t("noTranscript"));
        setVoiceStage("idle");
        setRecordingSeconds(0);
        return;
      }
      void askFromVoice(transcript);
    };
    try {
      recognition.start();
    } catch {
      setError(t("micUnsupported"));
      return;
    }
    recognitionRef.current = recognition;
    setRecordingSeconds(0);
    setVoiceStage("recording");
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((seconds) => {
        const next = seconds + 1;
        if (next >= 60) recognitionRef.current?.stop();
        return Math.min(next, 60);
      });
    }, 1000);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
  }

  function changeVoiceLanguage(value: string) {
    if (!isVoiceLanguage(value)) return;
    setVoiceLanguage(value);
    window.localStorage.setItem(voiceLanguageStorageKey, value);
  }

  async function playAnswer(message: Message) {
    if (!message.audio_base64) return;
    if (playingMessageId === message.id) {
      playbackRef.current?.pause();
      setPlayingMessageId(null);
      return;
    }
    playbackRef.current?.pause();
    const playback = new Audio(`data:${message.audio_mime_type ?? "audio/wav"};base64,${message.audio_base64}`);
    playbackRef.current = playback;
    setPlayingMessageId(message.id ?? null);
    playback.onended = () => setPlayingMessageId(null);
    playback.onerror = () => { setPlayingMessageId(null); setError(t("playbackError")); };
    try { await playback.play(); } catch { setPlayingMessageId(null); setError(t("playbackError")); }
  }

  function receiveLiveMessage(message: LiveTranscriptMessage) {
    setMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      if (index < 0) return [...current, { ...message, created_at: new Date().toISOString() }];
      const updated = [...current];
      updated[index] = { ...updated[index], ...message, created_at: updated[index].created_at ?? new Date().toISOString() };
      return updated;
    });
  }

  function newChat() {
    if (liveActive) return;
    setActiveId(null);
    setMessages([]);
    setQuestion("");
    setError("");
    setHistoryOpen(false);
    shouldStickToBottomRef.current = true;
  }

  function openConversation(conversationId: string) {
    setMessages([]);
    setActiveId(conversationId);
    setHistoryOpen(false);
    shouldStickToBottomRef.current = true;
  }

  function fillSuggestion(prompt: string) {
    setQuestion(prompt);
    textareaRef.current?.focus();
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);
  const firstQuestion = messages.find((message) => message.role === "user")?.content;
  const conversationTitle = activeConversation?.title || firstQuestion || t("askLifeLens");
  const timeLocale = language === "ar" ? "ar" : language === "fr" ? "fr-FR" : "en-US";
  function messageTime(message: Message) {
    return new Intl.DateTimeFormat(timeLocale, { hour: "numeric", minute: "2-digit" }).format(new Date(message.created_at ?? Date.now()));
  }

  return <div className="ai-page">
    <header className="ai-chat-header">
      <div className="ai-chat-heading">
        <strong className="ai-conversation-title" title={conversationTitle}>{conversationTitle}</strong>
        <span className="ai-status-pill"><i className="privacy-dot" /><span>{t("privateLabel")}</span><span aria-hidden="true">·</span><span>{t("groundedStats")}</span></span>
      </div>
      <div className="ai-header-actions">
        <label className="voice-language-lock" title={t("voiceLanguageLock")}>
          <Lock size={13} aria-hidden="true" />
          <select aria-label={t("voiceLanguageLock")} value={voiceLanguage} disabled={liveActive || voiceStage !== "idle" || messages.length > 0} onChange={(event) => changeVoiceLanguage(event.target.value)}>
            {(Object.keys(voiceLanguageLabels) as VoiceLanguage[]).map((option) => <option key={option} value={option}>{t(voiceLanguageLabels[option])}</option>)}
          </select>
        </label>
        <LiveVoiceControl conversationId={activeId} voiceLanguage={voiceLanguage} onConversationId={setActiveId} onMessage={receiveLiveMessage} onError={setError} onActiveChange={setLiveActive} />
        <button className="ai-icon-button" type="button" aria-label={t("voiceReplies")} aria-pressed={voiceReplies} title={t("voiceReplies")} onClick={() => setVoiceReplies((enabled) => !enabled)}>
          {voiceReplies ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <button className="ai-icon-button" ref={historyButtonRef} type="button" aria-label={t("history")} aria-expanded={historyOpen} aria-controls="ai-history-drawer" title={t("history")} onClick={() => setHistoryOpen(true)}>
          <History size={19} />
        </button>
      </div>
    </header>

    <section className="surface chat-panel" aria-label={t("assistantTitle")}>
      <div className="chat-messages" ref={chatContainerRef}>
        {!messages.length && <div className="chat-welcome">
          <span className="chat-welcome-icon"><Sparkles size={19} /></span>
          <h1>{t("whatNoticing")}</h1>
          <p>{t("aiWelcome")}</p>
          <div className="prompt-suggestions">
            {["promptEnergy", "promptSleepDays", "prompt90Days", "promptAttention"].map((key) => {
              const prompt = t(key as TranslationKey);
              return <button key={key} type="button" onClick={() => fillSuggestion(prompt)}>{prompt}</button>;
            })}
          </div>
        </div>}
        {messages.map((message, index) => {
          const isAssistant = message.role === "assistant";
          const stored = isAssistant ? splitStoredSources(message.content) : { body: message.content, sources: [] };
          const sources = message.web_sources?.length ? message.web_sources : stored.sources;
          return <article key={message.id ?? `${message.role}-${index}`} className={`chat-message chat-message-${message.role}`}>
          {isAssistant && <span className="message-avatar" aria-hidden="true"><Bot size={15} /></span>}
          <div className="message-content">
            <div className="message-bubble" dir={textDirection(stored.body)}>{isAssistant ? <ChatMarkdown content={stored.body} /> : <LinkifiedText content={stored.body} />}</div>
            {(message.web_used || sources.length > 0) && <aside className="web-sources" aria-label={t("webSources")}>
              <div className="web-sources-head"><Globe size={13} aria-hidden="true" /><strong>{t("webSources")}</strong></div>
              <p className="web-sources-note">{t("webContextNotice")}</p>
              {sources.length ? <ol className="web-source-list">{sources.map((source, sourceIndex) => {
                const { name, detail } = describeSource(source);
                const inner = <><span className="web-source-index">{sourceIndex + 1}</span><span className="web-source-text"><strong>{name}</strong>{detail && <small>{detail}</small>}</span>{source.uri && <ExternalLink className="web-source-open" size={14} aria-hidden="true" />}</>;
                return <li key={`${source.uri}-${sourceIndex}`}>{source.uri ? <a className="web-source-card" href={source.uri} target="_blank" rel="noopener noreferrer nofollow" title={`${t("openLink")} – ${name}`}>{inner}</a> : <span className="web-source-card">{inner}</span>}</li>;
              })}</ol> : <small className="web-sources-empty">{t("webNoSources")}</small>}
            </aside>}
            {message.detected_language && <small className="detected-language">{t("detectedLanguage")}: {t(languageLabels[message.detected_language])}</small>}
            {message.audio_base64 && <Button className="audio-play-button" variant="ghost" size="sm" onClick={() => void playAnswer(message)}>{playingMessageId === message.id ? <Pause size={14} /> : <Play size={14} />}{playingMessageId === message.id ? t("pauseVoice") : t("playVoice")}</Button>}
            <time className="message-time" dateTime={message.created_at}>{messageTime(message)}</time>
          </div>
        </article>;
        })}
        {(sending || voiceStage === "thinking") && <article className="chat-message chat-message-assistant" role="status" aria-label={t("thinkingVoice")}>
          <span className="message-avatar" aria-hidden="true"><Bot size={15} /></span>
          <div className="message-content"><div className="message-bubble thinking-bubble"><span /><span /><span /></div></div>
        </article>}
      </div>

      {error && <div className="status-message status-error chat-error" role="alert">{error}</div>}
      {privacyVisible && <aside className="ai-privacy-banner" role="note">
        <Info size={17} aria-hidden="true" />
        <p>{t("aiPrivacy")}</p>
        <button className="ai-notice-close" type="button" aria-label={t("dismissPrivacy")} onClick={() => setPrivacyVisible(false)}><X size={16} /></button>
      </aside>}

      <form className="chat-compose" onSubmit={(event) => void send(event)}>
        <div className="chat-compose-row">
          <div className="chat-input-shell">
            <textarea
              ref={textareaRef}
              className="field chat-input"
              rows={1}
              maxLength={1200}
              placeholder={t("chatPlaceholder")}
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                autoResizeTextarea();
              }}
              onInput={autoResizeTextarea}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  const form = event.currentTarget.form;
                  if (form && question.trim()) form.requestSubmit();
                }
              }}
              disabled={sending || voiceStage !== "idle" || liveActive}
              style={{ overflowY: question ? "auto" : "hidden" }}
            />
            <Button className={`chat-mic ${voiceStage === "recording" ? "chat-mic-recording" : ""}`} type="button" variant={voiceStage === "recording" ? "danger" : "ghost"} size="icon" aria-label={voiceStage === "recording" ? t("stopRecording") : t("voiceRecord")} title={voiceStage === "recording" ? t("stopRecording") : t("voiceRecord")} disabled={sending || liveActive || (voiceStage !== "idle" && voiceStage !== "recording")} onClick={() => voiceStage === "recording" ? stopRecording() : void startRecording()}>{voiceStage === "recording" ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</Button>
          </div>
          <Button className="chat-send" type="submit" size="icon" aria-label={t("sendMessage")} title={t("sendMessage")} disabled={!question.trim() || sending || voiceStage !== "idle" || liveActive}>{sending ? <LoaderCircle className="animate-spin" size={17} /> : <ArrowUp size={19} />}</Button>
        </div>
        {voiceStage === "recording" && <div className="voice-stage-label recording-label" role="status">{t("recordingVoice")} · {recordingSeconds}s / 60s{interimTranscript && <p className="voice-interim-transcript" dir="auto">{interimTranscript}</p>}</div>}
      </form>
    </section>

    {historyOpen && <div className="history-backdrop" onClick={() => setHistoryOpen(false)}>
      <aside id="ai-history-drawer" ref={historyPanelRef} className="history-drawer" role="dialog" aria-modal="true" aria-labelledby="ai-history-title" onClick={(event) => event.stopPropagation()}>
        <div className="history-drawer-heading">
          <h2 id="ai-history-title">{t("conversations")}</h2>
          <button className="ai-icon-button" ref={historyCloseRef} type="button" aria-label={t("closeHistory")} onClick={() => setHistoryOpen(false)}><X size={19} /></button>
        </div>
        <Button className="history-new-chat" variant="outline" onClick={newChat} disabled={liveActive}><Plus size={17} />{t("newConversation")}</Button>
        {loading ? <div className="conversation-loading"><LoaderCircle className="animate-spin" size={18} /></div> : conversations.length ? <div className="history-conversation-list">
          {conversations.map((conversation) => <button key={conversation.id} type="button" disabled={liveActive} aria-current={activeId === conversation.id ? "page" : undefined} className={`conversation-link ${activeId === conversation.id ? "conversation-link-active" : ""}`} onClick={() => openConversation(conversation.id)}>
            <MessageCircle size={17} aria-hidden="true" />
            <span><strong>{conversation.title || t("reflection")}</strong><small>{friendlyDate(conversation.created_at.slice(0, 10), language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR")}</small></span>
          </button>)}
        </div> : <p className="conversation-empty">{t("conversationsEmpty")}</p>}
      </aside>
    </div>}
  </div>;
}