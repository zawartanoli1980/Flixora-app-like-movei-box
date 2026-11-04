export class GeminiApiError extends Error {
  constructor(message, {status = 502, code = 'GEMINI_ERROR'} = {}) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
    this.code = code;
  }
}

function extractText(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n')
    .trim() || '';
}

export function createGeminiService({
  apiKey,
  model = 'gemini-2.5-flash',
  baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
} = {}) {
  if (typeof apiKey !== 'string' || apiKey.trim().length < 20) {
    throw new TypeError('A valid Gemini API key is required');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const endpoint = `${normalizedBaseUrl}/models/${encodeURIComponent(model)}:generateContent`;

  return {
    model,
    async chat({message, profile = 'general', locale = 'en'}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{text: 'You are Flixora AI, a concise entertainment discovery assistant. Recommend age-appropriate titles, explain genres, and help users navigate Flixora. Never invent playback availability or claim that unlicensed streams exist.'}],
            },
            contents: [{
              role: 'user',
              parts: [{text: `Locale: ${locale}\nProfile: ${profile}\nRequest: ${message}`}],
            }],
            generationConfig: {
              temperature: 0.65,
              topP: 0.9,
              maxOutputTokens: 600,
            },
          }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const upstreamMessage = payload?.error?.message;
          throw new GeminiApiError(
            response.status === 429 ? 'Gemini request limit reached. Please try again shortly.' : 'Gemini is unavailable right now.',
            {status: response.status === 429 ? 429 : 502, code: payload?.error?.status || 'GEMINI_UPSTREAM_ERROR'},
          );
        }
        const answer = extractText(payload);
        if (!answer) throw new GeminiApiError('Gemini returned an empty response', {code: 'GEMINI_EMPTY_RESPONSE'});
        return {answer, model, upstreamMessage: undefined};
      } catch (error) {
        if (error instanceof GeminiApiError) throw error;
        throw new GeminiApiError(
          error?.name === 'AbortError' ? 'Gemini request timed out.' : 'Gemini is unavailable right now.',
          {code: error?.name === 'AbortError' ? 'GEMINI_TIMEOUT' : 'GEMINI_NETWORK_ERROR'},
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
