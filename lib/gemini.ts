import { GoogleGenAI } from "@google/genai";

export function geminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}