import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const MODEL_NAME = 'gemini-3-flash-preview';

let aiClient: GoogleGenAI | null = null;

function getApiKey() {
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
  const legacyKey = (import.meta.env as Record<string, string | undefined>).GEMINI_API_KEY;
  const resolved = viteKey || legacyKey;
  return resolved?.trim() || '';
}

function getClient() {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      'Missing Gemini API key. Add VITE_GEMINI_API_KEY (or GEMINI_API_KEY) to .env.local and restart the dev server.',
    );
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }

  return aiClient;
}

export function hasGeminiApiKey() {
  return Boolean(getApiKey());
}

export type SummaryStyle = 'bullet points' | 'prose' | 'executive summary' | 'action items';
export type SummaryLength = 'short' | 'medium' | 'detailed';

export interface SummarizeOptions {
  style: SummaryStyle;
  length: SummaryLength;
}

export async function summarizeContent(
  content: string | { mimeType: string; data: string },
  options: SummarizeOptions,
) {
  const ai = getClient();

  const prompt = `Summarize the provided content. 
Style: ${options.style}
Length: ${options.length}
Focus on key insights and main takeaways. 
If it's a transcript, identify speakers if possible. 
If it's a PDF, maintain technical accuracy.`;

  const contents =
    typeof content === 'string'
      ? { parts: [{ text: prompt }, { text: content }] }
      : {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: content.mimeType,
                data: content.data,
              },
            },
          ],
        };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return response.text;
}

export async function chatWithContent(
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  message: string,
) {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
  });

  return response.text;
}
