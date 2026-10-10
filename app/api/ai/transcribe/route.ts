import { NextResponse } from "next/server";
import { geminiClient } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase/server";
import { defaultVoiceLanguage, isVoiceLanguage, voiceLanguageCodes } from "@/lib/voice-language";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const acceptedAudioTypes = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg", "audio/opus"]);

export async function POST(request: Request) {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gemini = geminiClient();
  if (!gemini) return NextResponse.json({ error: "Gemini is not configured. Add GEMINI_API_KEY to .env.local." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const candidate = form?.get("audio");
  if (!candidate || typeof candidate !== "object" || !("arrayBuffer" in candidate) || !("type" in candidate)) {
    return NextResponse.json({ error: "Choose a voice recording first." }, { status: 400 });
  }
  const audio = candidate as File;
  if (!audio.size || audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Audio must be between 1 byte and 5 MB." }, { status: 413 });
  const mimeType = audio.type.split(";")[0].toLowerCase();
  if (!acceptedAudioTypes.has(mimeType)) return NextResponse.json({ error: "Use a WebM, MP4, Ogg, WAV, MP3, or Opus recording." }, { status: 415 });
  const requestedLanguage = form?.get("voice_language");
  const voiceLanguage = isVoiceLanguage(requestedLanguage) ? requestedLanguage : defaultVoiceLanguage;

  try {
    const result = await gemini.interactions.create({
      model: "gemini-3.5-transcribe",
      input: [{ type: "audio", data: Buffer.from(await audio.arrayBuffer()).toString("base64"), mime_type: mimeType }],
      generation_config: { transcription_config: { language_codes: [voiceLanguageCodes[voiceLanguage]], mode: "verbatim" }, max_output_tokens: 1800 },
      store: false,
    });
    const transcript = result.output_text?.trim();
    if (!transcript) return NextResponse.json({ error: "No speech was detected in that recording." }, { status: 422 });
    return NextResponse.json({ transcript });
  } catch {
    return NextResponse.json({ error: "Gemini could not transcribe that recording. Try again in a quieter place." }, { status: 502 });
  }
}