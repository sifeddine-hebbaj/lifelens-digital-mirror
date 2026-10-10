"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, type FunctionCall, type LiveConnectConfig, type LiveServerMessage, type Session } from "@google/genai";
import { LoaderCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { WebSource } from "@/lib/web-search";
import { hasArabicScript, type VoiceLanguage } from "@/lib/voice-language";

type LiveStage = "idle" | "connecting" | "listening" | "speaking";
export type LiveTranscriptMessage = { id: string; role: "user" | "assistant"; content: string; live?: boolean; web_used?: boolean; web_sources?: WebSource[] };
type Props = {
  conversationId: string | null;
  voiceLanguage: VoiceLanguage;
  onConversationId: (id: string) => void;
  onMessage: (message: LiveTranscriptMessage) => void;
  onError: (message: string) => void;
  onActiveChange: (active: boolean) => void;
};

type TokenResponse = {
  token: string;
  model: string;
  conversation_id: string;
  config: LiveConnectConfig;
};

const sampleRate = 24000;
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `live-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

export function LiveVoiceControl({ conversationId, voiceLanguage, onConversationId, onMessage, onError, onActiveChange }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stage, setStage] = useState<LiveStage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [interimInput, setInterimInput] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const liveSessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const outputNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputTimeRef = useRef(0);
  const conversationRef = useRef(conversationId);
  const assistantTurnRef = useRef<{ id: string; text: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const closingRef = useRef(false);
  const disposedRef = useRef(false);
  const sessionLanguageRef = useRef<VoiceLanguage>(voiceLanguage);
  const latestUserTranscriptRef = useRef("");

  // Transcripts are display-only; under the Darija lock never show a non-Arabic-script mis-hearing.
  const displayTranscript = (text: string) => sessionLanguageRef.current === "darija" && !hasArabicScript(text) ? t("darijaVoiceMessage") : text;

  useEffect(() => { if (!liveSessionRef.current) conversationRef.current = conversationId; }, [conversationId]);

  const clearOutput = useCallback(() => {
    for (const node of outputNodesRef.current) {
      try { node.stop(); } catch { /* The chunk may already have finished. */ }
      node.disconnect();
    }
    outputNodesRef.current.clear();
    outputTimeRef.current = outputContextRef.current?.currentTime ?? 0;
  }, []);

  const releaseMedia = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (expiryRef.current) clearTimeout(expiryRef.current);
    timerRef.current = null;
    expiryRef.current = null;
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    clearOutput();
    void inputContextRef.current?.close().catch(() => undefined);
    void outputContextRef.current?.close().catch(() => undefined);
    inputContextRef.current = null;
    outputContextRef.current = null;
    sourceRef.current = null;
    workletRef.current = null;
    gainRef.current = null;
  }, [clearOutput]);

  function stopLive(showExpired = false) {
    closingRef.current = true;
    abortRef.current?.abort();
    try { liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* Session may already be closed. */ }
    liveSessionRef.current?.close();
    liveSessionRef.current = null;
    releaseMedia();
    assistantTurnRef.current = null;
    setInterimInput("");
    setAssistantDraft("");
    setSeconds(0);
    setStage("idle");
    onActiveChange(false);
    if (showExpired && !disposedRef.current) onError(t("liveSessionExpired"));
  }

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      closingRef.current = true;
      abortRef.current?.abort();
      try { liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* Session may already be closed. */ }
      liveSessionRef.current?.close();
      liveSessionRef.current = null;
      releaseMedia();
    };
  }, [releaseMedia]);

  async function saveTranscript(role: "user" | "assistant", text: string, id: string) {
    const client = supabaseBrowser();
    const currentConversationId = conversationRef.current;
    if (!client || !user || !currentConversationId) return;
    const { error } = await client.from("ai_messages").insert({ user_id: user.id, conversation_id: currentConversationId, role, content: text });
    if (error) {
      if (!disposedRef.current) onError(error.message);
      return;
    }
    if (!disposedRef.current) onMessage({ id, role, content: text });
  }

  function playPcm(data: string) {
    const context = outputContextRef.current;
    if (!context) return;
    const base64 = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
    const binary = atob(base64);
    const frameCount = Math.floor(binary.length / 2);
    if (!frameCount) return;
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);
    const view = new DataView(new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0))).buffer);
    for (let index = 0; index < frameCount; index += 1) channel[index] = view.getInt16(index * 2, true) / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.015, outputTimeRef.current);
    outputTimeRef.current = startAt + buffer.duration;
    outputNodesRef.current.add(source);
    source.onended = () => { outputNodesRef.current.delete(source); source.disconnect(); };
    source.start(startAt);
  }

  async function handleLiveToolCalls(session: Session, calls: FunctionCall[]) {
    for (const call of calls) {
      const name = call.name ?? "search_public_web";
      const topic = call.args?.topic;
      if (name !== "search_public_web" || typeof topic !== "string") {
        session.sendToolResponse({ functionResponses: [{ id: call.id, name, response: { error: "Unsupported Live tool call" } }] });
        continue;
      }
      try {
        const response = await fetch("/api/ai/web-search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic }) });
        const result = await response.json();
        session.sendToolResponse({ functionResponses: [{ id: call.id, name, response: { output: response.ok ? result : { searched: false, error: result.error ?? "Search failed" } } }] });
        if (response.ok && result.searched && Array.isArray(result.sources) && result.sources.length) {
          onMessage({ id: `web-${call.id ?? makeId()}`, role: "assistant", content: "", live: true, web_used: true, web_sources: result.sources as WebSource[] });
        }
      } catch {
        session.sendToolResponse({ functionResponses: [{ id: call.id, name, response: { output: { searched: false, error: "Search is temporarily unavailable" } } }] });
      }
    }
  }

  function handleServerMessage(message: LiveServerMessage) {
    const calls = message.toolCall?.functionCalls;
    if (calls?.length && liveSessionRef.current) void handleLiveToolCalls(liveSessionRef.current, calls);
    const content = message.serverContent;
    if (!content) return;
    if (content.interrupted) {
      clearOutput();
      assistantTurnRef.current = null;
      setAssistantDraft("");
      setStage("listening");
    }
    if (content.interimInputTranscription?.text) setInterimInput(displayTranscript(content.interimInputTranscription.text));
    if (content.inputTranscription?.text?.trim()) {
      const transcript = displayTranscript(content.inputTranscription.text.trim());
      latestUserTranscriptRef.current = transcript;
      setInterimInput("");
      void saveTranscript("user", transcript, makeId());
    }
    if (content.outputTranscription?.text) {
      const current = assistantTurnRef.current ?? { id: makeId(), text: "" };
      current.text += content.outputTranscription.text;
      assistantTurnRef.current = current;
      const displayText = current.text;
      setAssistantDraft(displayText);
      onMessage({ id: current.id, role: "assistant", content: displayText, live: true });
      setStage("speaking");
    }
    for (const part of content.modelTurn?.parts ?? []) {
      if ("inlineData" in part && part.inlineData?.data) {
        playPcm(part.inlineData.data);
        setStage("speaking");
      }
    }
    if (content.turnComplete || content.generationComplete) {
      const turn = assistantTurnRef.current;
      if (turn?.text.trim()) void saveTranscript("assistant", turn.text.trim(), turn.id);
      assistantTurnRef.current = null;
      latestUserTranscriptRef.current = "";
      setAssistantDraft("");
      setStage("listening");
    }
  }

  async function startLive() {
    if (stage !== "idle") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
      onError(t("liveSecureContext"));
      return;
    }
    setStage("connecting");
    onActiveChange(true);
    setSeconds(0);
    onError("");
    closingRef.current = false;
    sessionLanguageRef.current = voiceLanguage;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (controller.signal.aborted) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;

      const inputContext = new AudioContext({ sampleRate: 16000, latencyHint: "interactive" });
      const outputContext = new AudioContext({ sampleRate, latencyHint: "interactive" });
      inputContextRef.current = inputContext;
      outputContextRef.current = outputContext;
      await Promise.all([inputContext.resume(), outputContext.resume()]);
      await inputContext.audioWorklet.addModule("/pcm-capture-worklet.js");
      const source = inputContext.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(inputContext, "lifelens-pcm-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      const gain = inputContext.createGain();
      gain.gain.value = 0;
      source.connect(worklet);
      worklet.connect(gain);
      gain.connect(inputContext.destination);
      sourceRef.current = source;
      workletRef.current = worklet;
      gainRef.current = gain;

      const tokenResponse = await fetch("/api/ai/live-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voice_language: voiceLanguage, ...(conversationId ? { conversation_id: conversationId } : {}) }), signal: controller.signal });
      const tokenResult = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenResult.error ?? t("liveConnectionError"));
      if (controller.signal.aborted) return;
      const token = tokenResult as TokenResponse;
      conversationRef.current = token.conversation_id;
      onConversationId(token.conversation_id);

      const client = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: "v1alpha" } });
      const session = await client.live.connect({
        model: token.model,
        config: token.config,
        callbacks: {
          onmessage: handleServerMessage,
          onerror: () => { if (!closingRef.current) { onError(t("liveConnectionError")); stopLive(); } },
          onclose: () => { if (!closingRef.current && !disposedRef.current) { liveSessionRef.current = null; releaseMedia(); setStage("idle"); onActiveChange(false); onError(t("liveConnectionError")); } },
        },
      });
      if (controller.signal.aborted) { session.close(); releaseMedia(); return; }
      liveSessionRef.current = session;
      worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (liveSessionRef.current !== session) return;
        try {
          session.sendRealtimeInput({ audio: { data: arrayBufferToBase64(event.data), mimeType: "audio/pcm;rate=16000" } });
        } catch {
          if (!closingRef.current) { onError(t("liveConnectionError")); stopLive(); }
        }
      };
      setStage("listening");
      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
      expiryRef.current = setTimeout(() => stopLive(true), 7 * 60 * 1000 + 30 * 1000);
    } catch (error) {
      if (!controller.signal.aborted) onError(error instanceof Error ? error.message : t("liveConnectionError"));
      liveSessionRef.current?.close();
      liveSessionRef.current = null;
      releaseMedia();
      if (!disposedRef.current) setStage("idle");
    }
  }

  const active = stage !== "idle";
  const statusText = stage === "connecting" ? t("liveConnecting") : stage === "speaking" ? t("liveSpeaking") : stage === "listening" ? t("liveListening") : "";

  return (
    <section className={`live-voice-control ${active ? "live-voice-active" : ""}`} aria-label={t("liveTranscript")}>
      <div className="live-voice-toolbar">
        <Button type="button" className="live-voice-button" variant={active ? "danger" : "outline"} size="icon" title={active ? t("liveStop") : t("liveStart")} aria-label={active ? t("liveStop") : t("liveStart")} onClick={() => active ? stopLive() : void startLive()}>
          {stage === "connecting" ? <LoaderCircle className="animate-spin" size={17} /> : active ? <Square size={15} fill="currentColor" /> : <Mic size={17} />}
        </Button>
        <div className="live-voice-status" aria-live="polite">
          {statusText && <span className={`live-status-text live-status-${stage}`}>{statusText}</span>}
          {active && <span className="live-duration">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>}
        </div>
      </div>
      {(interimInput || assistantDraft) && <div className="live-transcript-preview" aria-live="polite">
        {interimInput && <p dir="auto"><b>{t("liveUser")}:</b> {interimInput}</p>}
        {assistantDraft && <p dir="auto"><b>{t("liveAssistant")}:</b> {assistantDraft}</p>}
      </div>}
    </section>
  );
}
