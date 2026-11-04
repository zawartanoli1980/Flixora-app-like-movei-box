const DEMO_STREAMS = [
  {id: 'cdn-auto', label: 'Fast CDN', quality: 'Auto', type: 'video/mp4', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', audioLanguages: ['English', 'Urdu', 'Hindi'], subtitles: [{language: 'English', label: 'English'}, {language: 'Urdu', label: 'Urdu'}], isDemo: true},
  {id: 'cdn-4k', label: 'Ultra Server', quality: '4K', type: 'video/mp4', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', audioLanguages: ['English', 'Hindi'], subtitles: [{language: 'English', label: 'English'}], isDemo: true},
  {id: 'cdn-1080', label: 'Server 2', quality: '1080p', type: 'video/mp4', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', audioLanguages: ['English', 'Urdu'], subtitles: [{language: 'English', label: 'English'}], isDemo: true},
  {id: 'cdn-720', label: 'Data Saver', quality: '720p', type: 'video/mp4', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', audioLanguages: ['English'], subtitles: [{language: 'English', label: 'English'}], isDemo: true},
];

const POSTERS = [
  '1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', 'gEU2QniE6E77NI6lCU6MxlNBvIx2.jpg', '7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
  '74xTEgt7R36Fpooo50r9T25onhq.jpg', '8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', 'ptpr0kGAckfQkJeJIt8st5dglvd.jpg',
  'uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg', 'x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', '62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
  'wRSnArnQBmeUYb5GWDU595bGsBr.jpg', '39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', '9p4pNoGcuyCf3acAJrRzTKa7u7P.jpg',
  'vIeu8WysZrTSFb2uhPViKjX9EcC.jpg', 'q719jXXEzOoYaps6babgKnONONX.jpg', 'cMD9Ygz11zjJzAovURpO75Qg7rT.jpg',
  'udDclJoHjfjb8Ekgsd4FDteOkCU.jpg', '2CAL2433ZeIihfX1Hb2139CX0pW.jpg', 'rktDFPbfHfUbArZ6OOOKsXcv0Bm.jpg',
  '6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg', 'pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', 'q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
  'iB64vpL3dIObOtMZgX3RqdVdQDc.jpg', 'zqkmTXzjkAgXmEWLRsY4UpTWCeo.jpg', 'd5NXSklXo0qyIYkgV94XAgMIckC.jpg',
];

const BACKDROPS = [
  'xOMo8BRK7PfcJv2Jr5a9D8F3GpW.jpg', 'pbrkL804c8yAv3zBZR4QPEafpAR.jpg', 'm4TUa2ciEWSlk37rOsjiSIvZDXE.jpg',
  'rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg', 'en971MEXui9diirXlogOrPKmsEn.jpg', 'bQXAqRx2Fgc46uCVWgoPz5L5Dtr.jpg',
  'jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg', 'yY76zq9XSuJ4nWyPDuwkdV7Wt0c.jpg', 'askg3SMvhqEl4OL52YuvdtY40Yb.jpg',
  'Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg', '5MnP0h7RcUCeX7gpxMYoMScmfq7.jpg', 'sRvXNDItGlWCqtO3j6wks52FmbD.jpg',
];

const poster = index => `https://image.tmdb.org/t/p/w780/${POSTERS[index % POSTERS.length]}`;
const backdrop = index => `https://image.tmdb.org/t/p/original/${BACKDROPS[index % BACKDROPS.length]}`;
const slugify = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const categories = ['Home', 'Trending', 'Live', 'Movies', 'TV Series', 'Dramas', 'Short TV', 'Anime', 'Cricket', 'Football', 'Games', 'Kids'];
export const searchFilterTags = ['All', 'Movies', 'Dramas', 'Series', 'Anime', 'Games', 'Novels'];
export const trendingTabs = ['All Trending', 'Trending Movies', 'Trending Series', 'Trending Dramas', 'Trending Anime'];
export const catalogSchemaVersion = 'flixora.mock.v3';

export const openMovies = [
  ['big-buck-bunny', 'Big Buck Bunny', 'BigBuckBunny.mp4', 'BigBuckBunny.jpg', 2008],
  ['sintel', 'Sintel', 'Sintel.mp4', 'Sintel.jpg', 2010],
  ['elephants-dream', 'Elephants Dream', 'ElephantsDream.mp4', 'ElephantsDream.jpg', 2006],
  ['tears-of-steel', 'Tears of Steel', 'TearsOfSteel.mp4', 'TearsOfSteel.jpg', 2012],
].map(([id, title, file, image, year], index) => ({
  id: `blender:${id}`, title, year, type: 'Movie', category: 'Open Movies',
  description: `${title} is a Creative Commons licensed Blender Foundation open movie.`,
  genres: ['Open Movie', index % 2 ? 'Fantasy' : 'Animation'], rating: 7.5 + index / 10,
  duration: 'Full movie', views: 'Open content',
  image: `https://storage.googleapis.com/gtv-videos-bucket/sample/images/${image}`,
  backdrop: `https://storage.googleapis.com/gtv-videos-bucket/sample/images/${image}`,
  licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  attribution: `${title} — Blender Foundation Open Movie`,
  audioTracks: ['Original'], subtitleTracks: [], qualities: ['Auto'],
  sources: [{id: `blender-${id}`, label: 'Open Movie CDN', quality: 'Auto', type: 'video/mp4', url: `https://storage.googleapis.com/gtv-videos-bucket/sample/${file}`, audioLanguages: ['Original'], subtitles: [], isDemo: true}],
}));

const sectionDefinitions = [
  {id: 'live-sports', title: 'Live Sports & Events', subtitle: 'Cricket, football and 24/7 live channels', category: 'Live', navTags: ['Live', 'Cricket', 'Football'], layout: 'wide', type: 'Live', titles: ['Pakistan vs Australia Live', 'Champions League Night', 'PSL Super Over', 'Premier League Live', 'World Cricket Highlights', 'Formula Grand Prix', 'Tennis Centre Court', 'Flixora News 24']},
  {id: 'pakistani', title: 'Pakistani Movies & Dramas', subtitle: 'Cinema and television stories from Pakistan', category: 'Dramas', navTags: ['Movies', 'Dramas'], type: 'Drama', languages: ['Urdu', 'Punjabi'], titles: ['The Legend of Maula Jatt', 'Parizaad', 'Zindagi Gulzar Hai', 'Humsafar', 'Suno Chanda', 'Kabuli Pulao', 'Punjab Nahi Jaungi', 'Ehd-e-Wafa']},
  {id: 'indian-hindi', title: 'Indian Movies & Hindi Dubbed', subtitle: 'Popular stories in Hindi and dual audio', category: 'Movies', navTags: ['Movies'], type: 'Movie', languages: ['Hindi', 'English'], titles: ['Jawan', 'Pathaan', 'Dangal', 'Drishyam 2', '12th Fail', 'Vikram Vedha', 'Kantara Hindi', 'Shershaah']},
  {id: 'bollywood', title: 'Bollywood Blockbusters', subtitle: 'Big stars, music and unforgettable cinema', category: 'Movies', navTags: ['Movies', 'Trending'], type: 'Movie', languages: ['Hindi'], titles: ['Brahmāstra', 'War', 'Animal', 'Rocky Aur Rani', 'Fighter', 'Tiger 3', 'Gully Boy', 'Zindagi Na Milegi Dobara']},
  {id: 'hollywood', title: 'Hollywood Hits', subtitle: 'English originals and dual-audio editions', category: 'Movies', navTags: ['Movies', 'Trending'], type: 'Movie', languages: ['English', 'Hindi'], titles: ['Dune: Part Two', 'Oppenheimer', 'Interstellar', 'The Batman', 'Top Gun: Maverick', 'Arrival', 'The Creator', 'Mission: Impossible']},
  {id: 'south-indian', title: 'South Indian Movies', subtitle: 'Hindi dubbed and subtitled action favorites', category: 'Movies', navTags: ['Movies'], type: 'Movie', languages: ['Tamil', 'Telugu', 'Hindi'], titles: ['RRR', 'Vikram', 'Leo', 'Jailer', 'Pushpa', 'Baahubali', 'Salaar', 'K.G.F: Chapter 2']},
  {id: 'k-dramas', title: 'Korean Dramas & K-Series', subtitle: 'Romance, mystery and must-watch K-drama', category: 'Dramas', navTags: ['Dramas', 'TV Series'], type: 'Drama', languages: ['Korean', 'English', 'Urdu'], titles: ['Queen of Tears', 'Crash Landing on You', 'Vincenzo', 'Moving', 'Lovely Runner', 'My Demon', 'Goblin', 'Extraordinary Attorney Woo']},
  {id: 'k-web', title: 'Korean Web Series', subtitle: 'Binge-ready thrillers and originals', category: 'Series', navTags: ['TV Series', 'Trending'], type: 'Series', languages: ['Korean', 'English'], titles: ['Squid Game', 'All of Us Are Dead', 'The Glory', 'Bloodhounds', 'Sweet Home', 'Mask Girl', 'My Name', 'Kingdom']},
  {id: 'turkish', title: 'Turkish Dramas', subtitle: 'Urdu and Hindi dubbed Turkish favorites', category: 'Dramas', navTags: ['Dramas', 'TV Series'], type: 'Drama', languages: ['Turkish', 'Urdu', 'Hindi'], titles: ['Ertuğrul', 'Kuruluş Osman', 'The Protector', 'Endless Love', 'The Gift', 'Golden Boy', 'The Pit', 'Midnight at the Pera Palace']},
  {id: 'punjabi', title: 'Trending Punjabi Box', subtitle: 'Punjabi movies, comedy and music shows', category: 'Movies', navTags: ['Movies', 'Trending'], type: 'Movie', languages: ['Punjabi', 'Urdu'], titles: ['Carry on Jatta 3', 'Mastaney', 'Chal Mera Putt', 'Qismat 2', 'Jatt & Juliet', 'Warning 2', 'Ardaas', 'Angrej']},
  {id: 'anime', title: 'Top Anime & Animated Series', subtitle: 'Simulcasts, classics and animated adventures', category: 'Anime', navTags: ['Anime', 'Kids'], type: 'Anime', languages: ['Japanese', 'English', 'Hindi'], titles: ['One Piece', 'Demon Slayer', 'Jujutsu Kaisen', 'Attack on Titan', 'Spy × Family', 'My Hero Academia', 'Spirited Away', 'Suzume']},
  {id: 'web-series', title: 'Web Series & TV Serials', subtitle: 'Every genre, every episode, one library', category: 'Series', navTags: ['TV Series', 'Short TV'], type: 'Series', languages: ['English', 'Hindi'], titles: ['Shōgun', 'The Last of Us', 'The Bear', 'Fallout', 'Silo', 'Reacher', 'The Night Agent', 'Wednesday']},
  {id: 'western-tv', title: 'Western TV Shows & Series', subtitle: 'Award-winning seasons and weekly episodes', category: 'Series', navTags: ['TV Series'], type: 'Series', languages: ['English', 'Spanish'], titles: ['House of the Dragon', 'The Boys', 'Succession', 'Stranger Things', 'The Crown', 'Peaky Blinders', 'Severance', 'Yellowstone']},
  {id: 'indian-dramas', title: 'Indian Dramas & Serials', subtitle: 'Daily drama, family stories and romance', category: 'Dramas', navTags: ['Dramas', 'TV Series'], type: 'Drama', languages: ['Hindi', 'Urdu'], titles: ['Anupamaa', 'Yeh Rishta Kya Kehlata Hai', 'Ghum Hai Kisikey Pyaar Meiin', 'Kumkum Bhagya', 'Imlie', 'Udne Ki Aasha', 'Taarak Mehta', 'Kaise Mujhe Tum Mil Gaye']},
  {id: 'kids', title: 'Kids & Family Collection', subtitle: 'Cartoons and safe family entertainment', category: 'Kids', navTags: ['Kids'], type: 'Kids', languages: ['English', 'Hindi', 'Urdu'], titles: ['Bluey', 'The Super Mario Bros. Movie', 'Inside Out 2', 'Kung Fu Panda 4', 'Moana', 'Frozen', 'Paw Patrol', 'The Lion King']},
  {id: 'games-shorts', title: 'Online Games & Short TV', subtitle: 'Instant games and vertical mini-dramas', category: 'Games', navTags: ['Games', 'Short TV'], type: 'Game', languages: ['English', 'Urdu'], titles: ['Neon Drift', 'Cricket Super Over', 'Love in 60 Seconds', 'Mystery Door', 'Penalty King', 'Royal Match', 'Campus Secret', 'Zombie Dash']},
  {id: 'novels', title: 'E-Books & Novels', subtitle: 'Interactive reading and offline chapters', category: 'Novels', navTags: [], type: 'Novel', languages: ['English', 'Urdu'], titles: ['The Silent Sea', 'The Last Kingdom', 'Neon Dreams', 'Moonlit Letters', 'City of Dust', 'The Glass Minaret', 'Echoes of Lahore', 'Beyond the Monsoon']},
];

function createEpisodes(itemId, seed) {
  return Array.from({length: 10}, (_, index) => {
    const season = index < 5 ? 1 : 2;
    const number = index % 5 + 1;
    return {
      id: `${itemId}-s${season}e${number}`, season, number,
      title: ['The Beginning', 'Crossing Lines', 'Hidden Truths', 'The Turning Point', 'After the Storm'][number - 1],
      duration: `${42 + (seed + index) % 17}m`, introEnd: 78, sources: DEMO_STREAMS,
    };
  });
}

function createItem(definition, itemIndex, sectionIndex) {
  const seed = sectionIndex * 11 + itemIndex;
  const title = definition.titles[itemIndex];
  const id = `${definition.id}-${slugify(title)}`;
  const episodic = ['Series', 'Drama', 'Anime', 'Kids'].includes(definition.type);
  const isLive = definition.type === 'Live' && itemIndex < 5;
  const isNovel = definition.type === 'Novel';
  const isGame = definition.type === 'Game';
  return {
    schema: catalogSchemaVersion,
    id,
    tmdbMockId: 10000 + seed,
    slug: slugify(title),
    title,
    description: isNovel
      ? `${title} is a Flixora original digital novel with immersive chapters, saved reading progress and offline access.`
      : `${title} delivers a polished ${definition.type.toLowerCase()} experience with complete metadata, multi-language playback and personalized discovery.`,
    overview: `Stream ${title} with adaptive quality, multiple audio tracks, subtitles and cross-device progress on Flixora.`,
    category: definition.category,
    sectionId: definition.id,
    navTags: definition.navTags,
    type: isLive ? 'Live' : definition.type,
    genres: isGame ? ['Games', itemIndex % 2 ? 'Arcade' : 'Interactive'] : isNovel ? ['Fiction', itemIndex % 2 ? 'Mystery' : 'Drama'] : [itemIndex % 2 ? 'Drama' : 'Action', itemIndex % 3 ? 'Adventure' : 'Thriller'],
    year: 2026 - seed % 7,
    releaseDate: `${2026 - seed % 7}-${String(seed % 12 + 1).padStart(2, '0')}-15`,
    rating: Number((7.2 + seed % 20 / 10).toFixed(1)),
    popularity: 99 - seed % 42,
    views: `${(1.1 + seed % 83 / 10).toFixed(1)}M`,
    duration: isLive ? 'LIVE' : isNovel ? `${28 + seed % 34} chapters` : episodic ? '2 seasons' : `${105 + seed % 68}m`,
    ageRating: definition.id === 'kids' ? '7+' : seed % 3 === 0 ? '16+' : '13+',
    languages: definition.languages || ['English', 'Hindi'],
    audioTracks: definition.languages || ['English', 'Hindi'],
    subtitleTracks: ['English', 'Urdu', 'Hindi'],
    qualities: ['Auto', '720p', '1080p', '4K'],
    image: poster(seed),
    backdrop: backdrop(seed),
    trailerUrl: DEMO_STREAMS[2].url,
    sources: isNovel ? [] : DEMO_STREAMS,
    seasons: episodic ? [{number: 1, episodeCount: 5}, {number: 2, episodeCount: 5}] : [],
    episodes: episodic ? createEpisodes(id, seed) : [],
    isLive,
    author: isNovel ? ['Ayesha Khan', 'Hassan Raza', 'Zara Ahmed', 'Mariam Ali'][itemIndex % 4] : undefined,
    chapters: isNovel ? 28 + seed % 34 : undefined,
    progress: isNovel ? [68, 21, 0, 44, 12, 0, 33, 6][itemIndex] : undefined,
    accent: ['from-red-500 to-zinc-950', 'from-fuchsia-500 to-indigo-950', 'from-cyan-500 to-slate-950'][seed % 3],
  };
}

export const sections = sectionDefinitions.map((definition, sectionIndex) => ({
  ...definition,
  layout: definition.layout || (definition.type === 'Novel' ? 'novel' : definition.type === 'Game' ? 'wide' : 'poster'),
  items: definition.titles.map((_, itemIndex) => createItem(definition, itemIndex, sectionIndex)),
}));

export const contentCatalog = sections.flatMap(section => section.items);

const pick = (sectionId, index = 0) => sections.find(section => section.id === sectionId).items[index];
export const heroSlides = [
  {...pick('hollywood', 0), eyebrow: '#1 TRENDING WORLDWIDE', heroTitle: 'Dune: Part Two', heroDescription: 'A spectacular journey of destiny, courage and survival across the sands of Arrakis.'},
  {...pick('live-sports', 0), eyebrow: 'LIVE NOW · CRICKET', heroTitle: 'Pakistan vs Australia', heroDescription: 'Watch every ball live with multi-language commentary, instant highlights and real-time scores.'},
  {...pick('k-dramas', 0), eyebrow: 'K-DRAMA SPOTLIGHT', heroDescription: 'The global romance sensation, now streaming with Urdu, Hindi and English subtitles.'},
  {...pick('anime', 0), eyebrow: 'NEW EPISODE', heroDescription: 'Set sail with the Straw Hat crew in the world’s biggest anime adventure.'},
  {...pick('south-indian', 0), eyebrow: 'DUAL AUDIO PREMIERE', heroDescription: 'An epic action event presented in original audio and Hindi dubbed editions.'},
];

const trendPicks = [
  pick('hollywood', 0), pick('k-web', 0), pick('pakistani', 1), pick('anime', 0), pick('bollywood', 0),
  pick('web-series', 0), pick('turkish', 0), pick('south-indian', 0), pick('k-dramas', 0), pick('punjabi', 0),
];

export const trendingNow = trendPicks.map((item, index) => ({
  ...item,
  rank: index + 1,
  popularityBadge: index < 3 ? 'HOT' : index < 6 ? 'RISING' : 'POPULAR',
  trendGroup: item.type === 'Movie' ? 'Trending Movies' : item.type === 'Anime' ? 'Trending Anime' : item.type === 'Drama' ? 'Trending Dramas' : 'Trending Series',
}));

export const novels = sections.find(section => section.id === 'novels').items;
export const shorts = sections.find(section => section.id === 'games-shorts').items.map((item, index) => ({
  ...item,
  type: 'Short',
  category: 'Short TV',
  creator: ['@flixoraoriginals', '@sportsdesk', '@dramabox', '@gamezone'][index % 4],
  duration: `0:${18 + index * 5}`,
}));

export const searchableItems = Array.from(new Map([...heroSlides, ...trendingNow, ...contentCatalog, ...shorts].map(item => [item.id, item])).values());

export const mockCatalogResponse = {
  schema: catalogSchemaVersion,
  generatedAt: '2026-11-03T00:00:00.000Z',
  pagination: {page: 1, pageSize: contentCatalog.length, total: contentCatalog.length},
  facets: {categories, searchFilterTags, languages: ['English', 'Urdu', 'Hindi', 'Punjabi', 'Korean', 'Turkish', 'Japanese', 'Tamil', 'Telugu']},
  results: contentCatalog,
};
