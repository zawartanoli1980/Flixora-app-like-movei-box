import type { Episode, MediaItem, Review, StreamSource } from '../types';

const demoPrimary = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const demoBackup = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
const demoMobile = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';
const demoHls = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

const sources = (prefix: string): StreamSource[] => [
  { id: `${prefix}-server-1`, label: 'Server 1', url: demoPrimary, resolution: '1080p', protocol: 'MP4', speed: 'Standard' },
  { id: `${prefix}-server-2`, label: 'Server 2', url: demoBackup, resolution: '720p', protocol: 'MP4', speed: 'Fast' },
  { id: `${prefix}-fast-cdn`, label: 'Fast CDN', url: demoHls, resolution: '4K', protocol: 'HLS', speed: 'Ultra' },
  { id: `${prefix}-mobile-cdn`, label: 'Mobile CDN', url: demoMobile, resolution: '480p', protocol: 'MP4', speed: 'Fast' },
];

const reviews: Review[] = [
  { id: 'review-1', author: 'Maya K.', rating: 5, comment: 'Beautifully paced, visually enormous, and worth watching with good headphones.', createdAt: '2 days ago' },
  { id: 'review-2', author: 'Daniel R.', rating: 4, comment: 'A confident continuation with excellent world-building.', createdAt: '1 week ago' },
];

const episodes = (prefix: string): Episode[] => [
  { id: `${prefix}-e1`, number: 1, title: 'A New Horizon', synopsis: 'An unexpected signal changes the course of the mission.', duration: '48m', thumbnail: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900', sources: sources(`${prefix}-e1`) },
  { id: `${prefix}-e2`, number: 2, title: 'Into the Unknown', synopsis: 'The crew crosses a boundary no one has returned from.', duration: '52m', thumbnail: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=900', sources: sources(`${prefix}-e2`) },
  { id: `${prefix}-e3`, number: 3, title: 'The Choice', synopsis: 'A difficult decision divides old allies.', duration: '55m', thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900', sources: sources(`${prefix}-e3`) },
];

export const catalog: MediaItem[] = [
  {
    id: 'dune-part-two', title: 'Dune: Part Two', synopsis: 'Paul Atreides unites with Chani and the Fremen while seeking justice for his family and facing a choice that will shape the universe.', year: 2024, kind: 'Movie', genre: 'Sci-Fi', country: 'US', language: 'English', rating: 8.5, ageRating: 13, duration: '2h 46m', durationSeconds: 9960, quality: '4K', featured: true, trendingRank: 1, director: 'Denis Villeneuve', cast: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson'], poster: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', backdrop: 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv2Jr5a9D8F3GpW.jpg', sources: sources('dune'), reviews,
  },
  {
    id: 'interstellar', title: 'Interstellar', synopsis: 'A group of explorers travels through a wormhole in space in an attempt to ensure humanity’s survival.', year: 2014, kind: 'Movie', genre: 'Sci-Fi', country: 'US', language: 'English', rating: 8.7, ageRating: 13, duration: '2h 49m', durationSeconds: 10140, quality: '4K', featured: true, trendingRank: 2, director: 'Christopher Nolan', cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'], poster: 'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', backdrop: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1800', sources: sources('interstellar'), reviews,
  },
  {
    id: 'shogun', title: 'Shōgun', synopsis: 'In Japan in the year 1600, a mysterious European ship arrives as a civil war reshapes the country.', year: 2024, kind: 'TV Series', genre: 'Drama', country: 'JP', language: 'Japanese', rating: 8.6, ageRating: 16, duration: '10 episodes', durationSeconds: 3600, quality: '4K', featured: true, trendingRank: 3, director: 'Rachel Kondo', cast: ['Hiroyuki Sanada', 'Cosmo Jarvis', 'Anna Sawai'], poster: 'https://image.tmdb.org/t/p/w780/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg', backdrop: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1800', sources: sources('shogun'), episodes: episodes('shogun'), reviews,
  },
  {
    id: 'spider-verse', title: 'Across the Spider-Verse', synopsis: 'Miles encounters a team of Spider-People charged with protecting the Multiverse.', year: 2023, kind: 'Movie', genre: 'Animation', country: 'US', language: 'English', rating: 8.6, ageRating: 7, duration: '2h 20m', durationSeconds: 8400, quality: '4K', trendingRank: 4, director: 'Joaquim Dos Santos', cast: ['Shameik Moore', 'Hailee Steinfeld', 'Oscar Isaac'], poster: 'https://image.tmdb.org/t/p/w780/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', backdrop: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=1800', sources: sources('spider'), reviews,
  },
  {
    id: 'the-batman', title: 'The Batman', synopsis: 'A trail of cryptic clues sends a masked detective deep into the shadows of Gotham.', year: 2022, kind: 'Movie', genre: 'Action', country: 'US', language: 'English', rating: 7.8, ageRating: 16, duration: '2h 56m', durationSeconds: 10560, quality: '4K', trendingRank: 5, director: 'Matt Reeves', cast: ['Robert Pattinson', 'Zoë Kravitz', 'Jeffrey Wright'], poster: 'https://image.tmdb.org/t/p/w780/74xTEgt7R36Fpooo50r9T25onhq.jpg', backdrop: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1800', sources: sources('batman'), reviews,
  },
  {
    id: 'planet-earth', title: 'Planet Earth: Our Home', synopsis: 'A family-friendly journey through the most remarkable ecosystems on Earth.', year: 2024, kind: 'Documentary', genre: 'Nature', country: 'GB', language: 'English', rating: 9.0, ageRating: 0, duration: '6 episodes', durationSeconds: 3000, quality: '4K', trendingRank: 6, director: 'BBC Earth', cast: ['David Attenborough'], poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900', backdrop: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1800', sources: sources('earth'), episodes: episodes('earth'), reviews,
  },
  {
    id: 'sky-guardians', title: 'Sky Guardians', synopsis: 'Young pilots discover that courage and friendship can change their world.', year: 2024, kind: 'Anime', genre: 'Action', country: 'JP', language: 'Japanese', rating: 8.1, ageRating: 7, duration: '12 episodes', durationSeconds: 1440, quality: 'HD', trendingRank: 7, director: 'Aiko Tanaka', cast: ['Hana Mori', 'Ren Sato'], poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=900', backdrop: 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=1800', sources: sources('sky'), episodes: episodes('sky'), reviews,
  },
  {
    id: 'mad-max', title: 'Fury Road', synopsis: 'Rebels race across a ruined landscape while pursued by a tyrant and his war party.', year: 2015, kind: 'Movie', genre: 'Action', country: 'AU', language: 'English', rating: 8.1, ageRating: 16, duration: '2h', durationSeconds: 7200, quality: '4K', trendingRank: 8, director: 'George Miller', cast: ['Tom Hardy', 'Charlize Theron'], poster: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900', backdrop: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1800', sources: sources('fury'), reviews,
  },
  {
    id: 'arrival', title: 'Arrival', synopsis: 'A linguist works with the military to communicate with mysterious visitors.', year: 2016, kind: 'Movie', genre: 'Sci-Fi', country: 'US', language: 'English', rating: 7.9, ageRating: 13, duration: '1h 56m', durationSeconds: 6960, quality: '4K', trendingRank: 9, director: 'Denis Villeneuve', cast: ['Amy Adams', 'Jeremy Renner'], poster: 'https://image.tmdb.org/t/p/w780/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', backdrop: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1800', sources: sources('arrival'), reviews,
  },
  {
    id: 'blue-eye', title: 'Blue Eye Samurai', synopsis: 'A warrior travels a dangerous path toward revenge in Edo-period Japan.', year: 2023, kind: 'Anime', genre: 'Action', country: 'JP', language: 'English', rating: 8.7, ageRating: 16, duration: '8 episodes', durationSeconds: 3300, quality: 'HD', trendingRank: 10, director: 'Michael Green', cast: ['Maya Erskine', 'George Takei'], poster: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=900', backdrop: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1800', sources: sources('blue-eye'), episodes: episodes('blue-eye'), reviews,
  },
  {
    id: 'wild-ocean', title: 'Wild Ocean', synopsis: 'Dive beneath the surface and discover the hidden rhythm of the open sea.', year: 2025, kind: 'Documentary', genre: 'Nature', country: 'ZA', language: 'English', rating: 8.3, ageRating: 0, duration: '5 episodes', durationSeconds: 2700, quality: '4K', director: 'Lena Okafor', cast: ['Nia Roberts'], poster: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=900', backdrop: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1800', sources: sources('ocean'), episodes: episodes('ocean'), reviews,
  },
  {
    id: 'edge-of-tomorrow', title: 'Edge of Tomorrow', synopsis: 'A soldier caught in a time loop learns to fight an impossible war.', year: 2014, kind: 'Movie', genre: 'Action', country: 'US', language: 'English', rating: 7.9, ageRating: 13, duration: '1h 53m', durationSeconds: 6780, quality: 'HD', director: 'Doug Liman', cast: ['Tom Cruise', 'Emily Blunt'], poster: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?w=900', backdrop: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?w=1800', sources: sources('edge'), reviews,
  },
];

export const featured = catalog.filter((item) => item.featured);
export const trending = [...catalog].filter((item) => item.trendingRank).sort((a, b) => (a.trendingRank ?? 99) - (b.trendingRank ?? 99));

export function mediaById(id: string): MediaItem | undefined {
  return catalog.find((item) => item.id === id);
}
