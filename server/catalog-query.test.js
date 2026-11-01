import test from 'node:test';
import assert from 'node:assert/strict';
import { filtersSchema, catalogQuery } from './catalog-query.js';

test('rejects invalid, unknown, and out-of-range filters', () => {
  for (const input of [
    { rating: 11 }, { page: 0 }, { limit: 100 }, { type: 'invalid' },
    { year: 1700 }, { country: 'USA' }, { unknown: 'value' }, { q: '   ' },
  ]) {
    assert.equal(filtersSchema.safeParse(input).success, false);
  }
});

test('builds a parameterized full-text query with deterministic pagination', () => {
  const filters = filtersSchema.parse({
    q: "' OR 1=1 --",
    genre: 'Sci-Fi',
    rating: 8,
    year: 2024,
    type: 'movie',
    page: 2,
    limit: 10,
  });
  const query = catalogQuery(filters);
  assert.ok(!query.text.includes(filters.q));
  assert.deepEqual(query.values, ["' OR 1=1 --", 'Sci-Fi', 2024, 8, 'movie', 10, 10]);
  assert.match(query.text, /websearch_to_tsquery/);
  assert.match(query.text, /ORDER BY m\.popularity DESC, m\.id/);
});

test('normalizes countries and preserves a zero rating', () => {
  const filters = filtersSchema.parse({ country: 'us', rating: 0 });
  const query = catalogQuery(filters);
  assert.equal(filters.country, 'US');
  assert.deepEqual(query.values.slice(0, 2), ['US', 0]);
  assert.match(query.text, /imdb_rating >= \$2/);
});
