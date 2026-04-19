import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const DEFAULT_MODEL_NAME = 'gemini-3.1-pro-preview';
const FALLBACK_MODEL_NAMES = ['gemini-2.0-flash', 'gemini-1.5-flash'];
const RUNTIME_API_KEY_STORAGE = 'summora_gemini_api_key';

let aiClient: GoogleGenAI | null = null;
let activeClientApiKey = '';
let activeModelName = '';
let runtimeApiKey = '';
let runtimeApiKeyLoaded = false;

function readRuntimeKeyFromStorage() {
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem(RUNTIME_API_KEY_STORAGE)?.trim() || '';
  } catch {
    return '';
  }
}

function writeRuntimeKeyToStorage(key: string) {
  if (typeof window === 'undefined') return;

  try {
    if (key) {
      window.localStorage.setItem(RUNTIME_API_KEY_STORAGE, key);
    } else {
      window.localStorage.removeItem(RUNTIME_API_KEY_STORAGE);
    }
  } catch {
    // Ignore storage write errors in restricted browser modes.
  }
}

function getEnvironmentApiKey() {
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
  const legacyKey = (import.meta.env as Record<string, string | undefined>).GEMINI_API_KEY;
  return (viteKey || legacyKey || '').trim();
}

function resetClient() {
  aiClient = null;
  activeClientApiKey = '';
  activeModelName = '';
}

function ensureRuntimeKeyLoaded() {
  if (runtimeApiKeyLoaded) return;
  runtimeApiKey = readRuntimeKeyFromStorage();
  runtimeApiKeyLoaded = true;
}

export function loadRuntimeGeminiApiKey() {
  ensureRuntimeKeyLoaded();
  return runtimeApiKey;
}

export function setRuntimeGeminiApiKey(apiKey: string) {
  const nextKey = apiKey.trim();
  runtimeApiKey = nextKey;
  runtimeApiKeyLoaded = true;
  writeRuntimeKeyToStorage(nextKey);
  resetClient();
  return runtimeApiKey;
}

export function clearRuntimeGeminiApiKey() {
  return setRuntimeGeminiApiKey('');
}

export function getGeminiApiKeySource() {
  const runtimeKey = loadRuntimeGeminiApiKey();
  if (runtimeKey) return 'runtime' as const;
  if (getEnvironmentApiKey()) return 'environment' as const;
  return null;
}

export function getResolvedGeminiApiKey() {
  const runtimeKey = loadRuntimeGeminiApiKey();
  return runtimeKey || getEnvironmentApiKey();
}

function getConfiguredModelName() {
  const envModel =
    (
      import.meta.env.VITE_GEMINI_MODEL ||
      (import.meta.env as Record<string, string | undefined>).GEMINI_MODEL
    )?.trim() || '';
  return envModel || DEFAULT_MODEL_NAME;
}

function getModelCandidates() {
  return Array.from(
    new Set(
      [activeModelName, getConfiguredModelName(), ...FALLBACK_MODEL_NAMES].filter(Boolean),
    ),
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown Gemini API error.';
  }
}

function isMissingModelError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('not found') &&
    (message.includes('models/') ||
      message.includes('generatecontent') ||
      message.includes('api version'))
  );
}

async function generateWithModelFallback(
  ai: GoogleGenAI,
  buildRequest: (model: string) => Parameters<GoogleGenAI['models']['generateContent']>[0],
) {
  const modelCandidates = getModelCandidates();
  let lastError: unknown = null;

  for (const model of modelCandidates) {
    try {
      const response = await ai.models.generateContent(buildRequest(model));
      activeModelName = model;
      return response;
    } catch (error) {
      lastError = error;
      if (!isMissingModelError(error)) {
        throw error;
      }
    }
  }

  const details = getErrorMessage(lastError);
  throw new Error(
    `No compatible Gemini model found. Tried: ${modelCandidates.join(', ')}. Last error: ${details}`,
  );
}

function getClient() {
  const apiKey = getResolvedGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      'Missing Gemini API key. Set it in API Settings or provide VITE_GEMINI_API_KEY (or GEMINI_API_KEY) in .env.local.',
    );
  }

  if (!aiClient || activeClientApiKey !== apiKey) {
    aiClient = new GoogleGenAI({ apiKey });
    activeClientApiKey = apiKey;
  }

  return aiClient;
}

export function hasGeminiApiKey() {
  return Boolean(getResolvedGeminiApiKey());
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

  const response = await generateWithModelFallback(ai, (model) => ({
    model,
    contents,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  }));

  return response.text;
}

export async function chatWithContent(
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  message: string,
) {
  const ai = getClient();

  const response = await generateWithModelFallback(ai, (model) => ({
    model,
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
  }));

  return response.text;
}
