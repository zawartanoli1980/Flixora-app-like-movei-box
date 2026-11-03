import {movies} from './catalog';

const sampleSources = [
  {id: 'fast-cdn', label: 'Fast CDN', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'},
  {id: 'backup-cdn', label: 'Backup Server', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'},
];

const byId = id => movies.find(item => item.id === id);

export const categories = ['All', 'Movies', 'Cricket', 'Dramas', 'Anime', 'Football', 'Live', 'Novels', 'Shorts', 'Family'];

export const heroSlides = [
  {
    ...byId('dune'), category: 'Movies', eyebrow: '#1 MOVIE IN PAKISTAN', heroTitle: 'Dune: Part Two',
    heroDescription: 'Paul Atreides joins Chani and the Fremen on a journey of revenge, destiny and survival.',
  },
  {
    id: 'pak-vs-nz-live', title: 'Pakistan vs New Zealand', heroTitle: 'Pakistan vs New Zealand', eyebrow: 'LIVE NOW · 2ND T20',
    description: 'Watch every ball live with Urdu and English commentary, instant highlights and live scorecards.',
    heroDescription: 'Watch every ball live with Urdu and English commentary, instant highlights and live scorecards.',
    category: 'Cricket', type: 'Live', year: 2026, rating: 9.1, duration: 'Live', isLive: true,
    image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=900&q=85',
    backdrop: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=2000&q=90', sources: sampleSources,
  },
  {
    ...byId('spirited'), category: 'Anime', eyebrow: 'ANIME SPOTLIGHT', heroTitle: 'Spirited Away',
    heroDescription: 'Enter a spellbinding spirit world in Hayao Miyazaki’s Academy Award-winning adventure.',
    backdrop: 'https://image.tmdb.org/t/p/original/Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg',
  },
  {
    id: 'champions-live', title: 'Champions Night Live', heroTitle: 'Champions Night Live', eyebrow: 'FOOTBALL · KICK-OFF 20:00',
    description: 'The biggest European teams meet under the lights. Join the pre-match show and live coverage.',
    heroDescription: 'The biggest European teams meet under the lights. Join the pre-match show and live coverage.',
    category: 'Football', type: 'Live', year: 2026, rating: 8.9, duration: 'Tonight', isLive: true,
    image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=85',
    backdrop: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2000&q=90', sources: sampleSources,
  },
];

const withCategory = (ids, category) => ids.map(id => ({...byId(id), category})).filter(item => item.id);

export const trendingMovies = withCategory(['dune', 'interstellar', 'batman', 'spiderverse', 'oppenheimer', 'arrival', 'maverick'], 'Movies');

export const liveSports = [
  heroSlides[1], heroSlides[3],
  {id: 'psl-live', title: 'Lahore vs Karachi', category: 'Cricket', type: 'Live', isLive: true, description: 'PSL night match live from Lahore.', duration: 'Live · 14.2 overs', rating: 8.8, image: 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=1200&q=85', sources: sampleSources},
  {id: 'premier-live', title: 'North London Derby', category: 'Football', type: 'Live', isLive: true, description: 'Live Premier League coverage and match analysis.', duration: '63 min', rating: 9.0, image: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=85', sources: sampleSources},
  {id: 'cricket-highlights', title: 'Today’s Cricket Highlights', category: 'Cricket', type: 'Highlights', description: 'Boundaries, wickets and the defining moments from today.', duration: '18m', rating: 8.6, image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=85', sources: sampleSources},
];

export const dramas = [
  ...withCategory(['shogun', 'lastofus', 'oppenheimer', 'interstellar'], 'Dramas'),
  {...byId('planet'), id: 'planet-stories', title: 'Planet Earth Stories', category: 'Dramas', image: 'https://image.tmdb.org/t/p/w780/uBZQOYZLIU9dBmd62fdzBAoropu.jpg'},
];

export const anime = [
  {...byId('spirited'), category: 'Anime'},
  {...byId('spiderverse'), id: 'spiderverse-anime', category: 'Anime'},
  {id: 'suzume', title: 'Suzume', category: 'Anime', type: 'Anime', year: 2023, rating: 7.6, duration: '2h 1m', description: 'A determined teenager closes mysterious doors that are releasing disasters across Japan.', image: 'https://image.tmdb.org/t/p/w780/vIeu8WysZrTSFb2uhPViKjX9EcC.jpg', sources: sampleSources},
  {id: 'your-name', title: 'Your Name', category: 'Anime', type: 'Anime', year: 2016, rating: 8.4, duration: '1h 46m', description: 'Two teenagers discover a strange connection that changes both of their lives.', image: 'https://image.tmdb.org/t/p/w780/q719jXXEzOoYaps6babgKnONONX.jpg', sources: sampleSources},
  {id: 'one-piece', title: 'One Piece', category: 'Anime', type: 'Series', year: 2024, rating: 8.9, duration: 'New episode', description: 'Sail with the Straw Hat crew on the ultimate adventure.', image: 'https://image.tmdb.org/t/p/w780/cMD9Ygz11zjJzAovURpO75Qg7rT.jpg', sources: sampleSources},
];

export const novels = [
  {id: 'novel-silent-sea', title: 'The Silent Sea', author: 'Ayesha Khan', category: 'Novels', type: 'Novel', chapters: 32, progress: 68, accent: 'from-cyan-500 to-blue-950', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=85', description: 'A lost signal draws a marine biologist into an impossible mystery.'},
  {id: 'novel-last-kingdom', title: 'The Last Kingdom', author: 'Hassan Raza', category: 'Novels', type: 'Novel', chapters: 46, progress: 21, accent: 'from-amber-500 to-red-950', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=85', description: 'An exiled prince returns to a kingdom divided by secrets.'},
  {id: 'novel-neon-dreams', title: 'Neon Dreams', author: 'Zara Ahmed', category: 'Novels', type: 'Novel', chapters: 28, progress: 0, accent: 'from-fuchsia-500 to-violet-950', image: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=800&q=85', description: 'A cyberpunk romance hidden inside a city that never sleeps.'},
  {id: 'novel-moonlit', title: 'Moonlit Letters', author: 'Mariam Ali', category: 'Novels', type: 'Novel', chapters: 39, progress: 44, accent: 'from-indigo-400 to-slate-950', image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=800&q=85', description: 'Letters from the past reveal a love story that time forgot.'},
  {id: 'novel-dust', title: 'City of Dust', author: 'Omar Farooq', category: 'Novels', type: 'Novel', chapters: 51, progress: 0, accent: 'from-orange-400 to-stone-950', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=85', description: 'One detective faces a city where every memory can be bought.'},
];

export const shorts = [
  {id: 'short-dune', title: 'Behind the sandworms', creator: '@flixora', category: 'Shorts', type: 'Short', views: '2.4M', duration: '0:34', image: 'https://image.tmdb.org/t/p/w780/xOMo8BRK7PfcJv2Jr5a9D8F3GpW.jpg', sources: sampleSources},
  {id: 'short-cricket', title: 'Unbelievable last-ball six', creator: '@sportsdesk', category: 'Shorts', type: 'Short', views: '5.8M', duration: '0:22', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=700&q=85', sources: sampleSources},
  {id: 'short-anime', title: 'Anime scenes that feel unreal', creator: '@otakuworld', category: 'Shorts', type: 'Short', views: '1.2M', duration: '0:41', image: 'https://image.tmdb.org/t/p/w780/Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg', sources: sampleSources},
  {id: 'short-football', title: 'Top corner from 30 yards', creator: '@goalline', category: 'Shorts', type: 'Short', views: '3.7M', duration: '0:18', image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=700&q=85', sources: sampleSources},
  {id: 'short-cinema', title: 'How this shot was made', creator: '@cinefiles', category: 'Shorts', type: 'Short', views: '860K', duration: '0:52', image: 'https://image.tmdb.org/t/p/w780/pbrkL804c8yAv3zBZR4QPEafpAR.jpg', sources: sampleSources},
];

export const sections = [
  {id: 'trending', title: 'Trending Movies', subtitle: 'What everyone is watching', category: 'Movies', items: trendingMovies, layout: 'poster'},
  {id: 'sports', title: 'Live Cricket & Football', subtitle: 'Matches, scores and highlights', category: 'Live', items: liveSports, layout: 'wide'},
  {id: 'dramas', title: 'Popular Dramas & TV Shows', subtitle: 'Stories worth staying up for', category: 'Dramas', items: dramas, layout: 'poster'},
  {id: 'anime', title: 'Trending Anime', subtitle: 'Fresh episodes and timeless favorites', category: 'Anime', items: anime, layout: 'poster'},
  {id: 'novels', title: 'Latest Novels & Read', subtitle: 'Your next chapter starts here', category: 'Novels', items: novels, layout: 'novel'},
  {id: 'shorts', title: 'Short Clips & Reels', subtitle: 'Fast stories, big moments', category: 'Shorts', items: shorts, layout: 'short'},
];

export const searchableItems = Array.from(new Map([...heroSlides, ...sections.flatMap(section => section.items)].map(item => [item.id, item])).values());
