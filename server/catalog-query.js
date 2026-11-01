import { z } from 'zod';

const optionalText = (max) => z.string().trim().min(1).max(max).optional();

export const filtersSchema = z.object({
  q: optionalText(120),
  genre: optionalText(50),
  year: z.coerce.number().int().min(1888).max(2100).optional(),
  language: optionalText(50),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  rating: z.coerce.number().min(0).max(10).optional(),
  type: z.enum(['movie', 'series', 'anime', 'documentary']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
}).strict();

export function catalogQuery(filters) {
  const values = [];
  const clauses = ['m.published = true'];
  const add = (sql, value) => {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  };

  if (filters.q) {
    add("to_tsvector('english', m.title || ' ' || m.synopsis) @@ websearch_to_tsquery('english', ?)", filters.q);
  }
  if (filters.genre) add('? = ANY(m.genres)', filters.genre);
  if (filters.year) add('m.release_year = ?', filters.year);
  if (filters.language) add('lower(m.original_language) = lower(?)', filters.language);
  if (filters.country) add('?::bpchar = ANY(m.countries)', filters.country);
  if (filters.rating !== undefined) add('m.imdb_rating >= ?', filters.rating);
  if (filters.type) add('m.kind = ?', filters.type);

  values.push(filters.limit, (filters.page - 1) * filters.limit);
  return {
    text: `SELECT m.id, m.title, m.synopsis, m.kind, m.release_year,
      m.original_language, m.countries, m.genres, m.age_rating,
      m.duration_seconds, m.imdb_rating, m.poster_url, m.backdrop_url
      FROM media m
      WHERE ${clauses.join(' AND ')}
      ORDER BY m.popularity DESC, m.id
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  };
}
