import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiService, GeminiApiError} from './gemini.js';

test('Gemini service sends the key in a header and returns normalized text', async () => {
  const calls = [];
  const service = createGeminiService({
    apiKey: 'test-gemini-key-with-enough-length',
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return new Response(JSON.stringify({
        candidates: [{content: {parts: [{text: 'Try Interstellar'}, {text: 'Then watch Arrival'}]}}],
      }), {status: 200, headers: {'Content-Type': 'application/json'}});
    },
  });

  const result = await service.chat({message: 'Recommend thoughtful sci-fi', profile: 'general', locale: 'en'});
  assert.equal(result.answer, 'Try Interstellar\nThen watch Arrival');
  assert.equal(result.model, 'gemini-2.5-flash');
  assert.doesNotMatch(calls[0].url, /test-gemini-key/);
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-gemini-key-with-enough-length');
  const body = JSON.parse(calls[0].options.body);
  assert.match(body.contents[0].parts[0].text, /thoughtful sci-fi/);
});

test('Gemini service maps upstream rate limits to a safe API error', async () => {
  const service = createGeminiService({
    apiKey: 'test-gemini-key-with-enough-length',
    fetchImpl: async () => new Response(JSON.stringify({error: {status: 'RESOURCE_EXHAUSTED'}}), {
      status: 429,
      headers: {'Content-Type': 'application/json'},
    }),
  });
  await assert.rejects(
    service.chat({message: 'Recommend something', profile: 'general', locale: 'en'}),
    (error) => error instanceof GeminiApiError && error.status === 429 && error.code === 'RESOURCE_EXHAUSTED',
  );
});
