const demoCatalog = Object.freeze([
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Dune: Part Two',
    synopsis: 'Paul Atreides unites with Chani and the Fremen while seeking revenge.',
    kind: 'movie',
    release_year: 2024,
    original_language: 'English',
    countries: ['US'],
    genres: ['Sci-Fi', 'Adventure'],
    age_rating: 13,
    duration_seconds: 9960,
    imdb_rating: 8.5,
    poster_url: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv2Jr5a9D8F3GpW.jpg',
    popularity: 100,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Interstellar',
    synopsis: 'Explorers travel beyond this galaxy to discover whether mankind has a future.',
    kind: 'movie',
    release_year: 2014,
    original_language: 'English',
    countries: ['US'],
    genres: ['Sci-Fi', 'Drama'],
    age_rating: 13,
    duration_seconds: 10140,
    imdb_rating: 8.7,
    poster_url: 'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx2.jpg',
    backdrop_url: null,
    popularity: 95,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Shogun',
    synopsis: 'In Japan in 1600, a mysterious European ship arrives as civil war looms.',
    kind: 'series',
    release_year: 2024,
    original_language: 'Japanese',
    countries: ['JP'],
    genres: ['Drama'],
    age_rating: 16,
    duration_seconds: null,
    imdb_rating: 8.6,
    poster_url: 'https://image.tmdb.org/t/p/w780/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
    backdrop_url: null,
    popularity: 90,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Across the Spider-Verse',
    synopsis: 'Miles Morales encounters a team charged with protecting the Multiverse.',
    kind: 'movie',
    release_year: 2023,
    original_language: 'English',
    countries: ['US'],
    genres: ['Animation', 'Adventure'],
    age_rating: 10,
    duration_seconds: 8400,
    imdb_rating: 8.6,
    poster_url: 'https://image.tmdb.org/t/p/w780/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    backdrop_url: null,
    popularity: 85,
  },
]);

export function filterDemoCatalog(filters) {
  const query = filters.q?.toLocaleLowerCase();
  const items = demoCatalog.filter((media) => {
    if (query && !`${media.title} ${media.synopsis}`.toLocaleLowerCase().includes(query)) return false;
    if (filters.genre && !media.genres.includes(filters.genre)) return false;
    if (filters.year && media.release_year !== filters.year) return false;
    if (filters.language && media.original_language.toLocaleLowerCase() !== filters.language.toLocaleLowerCase()) return false;
    if (filters.country && !media.countries.includes(filters.country)) return false;
    if (filters.rating !== undefined && media.imdb_rating < filters.rating) return false;
    if (filters.type && media.kind !== filters.type) return false;
    return true;
  });
  const start = (filters.page - 1) * filters.limit;
  return items.slice(start, start + filters.limit).map(({ popularity: _popularity, ...media }) => media);
}
