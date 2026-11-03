import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Bell, BookOpen, Bookmark, Check, ChevronLeft, ChevronRight, Clock3, Download,
  Flame, Heart, Home, LibraryBig, Mic, MicOff, Pause, Play, Search, Settings,
  SlidersHorizontal, Star, Trash2, TrendingUp, UserRound, Video, Wifi, X,
} from 'lucide-react';
import Player from './Player';
import {
  categories, heroSlides, novels, searchableItems, searchFilterTags, sections,
  shorts, trendingNow, trendingTabs,
} from './dashboardData';
import './styles.css';

const POSTER_FALLBACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#312e81"/><stop offset="1" stop-color="#020617"/></linearGradient></defs><rect width="700" height="1000" fill="url(#g)"/><circle cx="350" cy="420" r="100" fill="#8b5cf6" opacity=".3"/><path d="m325 365 105 60-105 60z" fill="#fff"/><text x="350" y="650" text-anchor="middle" fill="#fff" font-size="50" font-family="sans-serif" font-weight="bold">FLIXORA</text></svg>')}`;

const tabs = [
  {id: 'Home', label: 'Home', icon: Home},
  {id: 'Shorts', label: 'Shorts', icon: Video},
  {id: 'Download', label: 'Download', icon: Download},
  {id: 'Novels', label: 'Novels', icon: LibraryBig},
  {id: 'Me', label: 'Me', icon: UserRound},
];

function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function imageError(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = POSTER_FALLBACK;
}

function Meta({item}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
      {item.isLive && <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[10px] font-extrabold tracking-wider text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE</span>}
      {item.rating && <span className="flex items-center gap-1 text-amber-300"><Star size={12} fill="currentColor" /> {item.rating}</span>}
      {item.year && <span>{item.year}</span>}
      {item.duration && <span>{item.duration}</span>}
      {item.genres?.slice(0, 2).map(genre => <span key={genre}>{genre}</span>)}
      {item.type && <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] uppercase">{item.type}</span>}
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2" aria-label="Flixora home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-red-500 via-rose-600 to-red-950 shadow-[0_0_28px_rgba(239,68,68,.38)]"><Play size={18} fill="white" className="ml-0.5 text-white" /></span>
      <span className="text-xl font-black tracking-tight text-white sm:text-2xl">Flix<span className="text-red-500">ora</span></span>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [activeCategory, setActiveCategory] = useState('Home');
  const [query, setQuery] = useState('');
  const [searchTag, setSearchTag] = useState('All');
  const [showSearchTags, setShowSearchTags] = useState(false);
  const [listening, setListening] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [player, setPlayer] = useState(null);
  const [viewAll, setViewAll] = useState(null);
  const [downloads, setDownloads] = useState(() => readStorage('flixora:dashboard-downloads', []));
  const [favorites, setFavorites] = useState(() => readStorage('flixora:dashboard-favorites', []));
  const [history, setHistory] = useState(() => readStorage('flixora:dashboard-history', {
    [heroSlides[0].id]: {position: 2840, duration: 9960, updatedAt: Date.now() - 240000},
    [heroSlides[2].id]: {position: 1240, duration: 3300, updatedAt: Date.now() - 480000},
  }));
  const [toast, setToast] = useState('');

  useEffect(() => { localStorage.setItem('flixora:dashboard-downloads', JSON.stringify(downloads)); }, [downloads]);
  useEffect(() => { localStorage.setItem('flixora:dashboard-favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('flixora:dashboard-history', JSON.stringify(history)); }, [history]);

  useEffect(() => {
    if (heroPaused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setHeroIndex(index => (index + 1) % heroSlides.length), 5000);
    return () => clearInterval(timer);
  }, [heroPaused]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDownloads(current => current.map(item => {
        if (item.status !== 'downloading') return item;
        const progress = Math.min(100, item.progress + 4);
        return {...item, progress, status: progress >= 100 ? 'complete' : 'downloading'};
      }));
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    const tagMatch = item => searchTag === 'All'
      || (searchTag === 'Movies' && item.type === 'Movie')
      || (searchTag === 'Dramas' && item.type === 'Drama')
      || (searchTag === 'Series' && ['Series', 'TV Series'].includes(item.type))
      || item.type === searchTag.slice(0, -1)
      || item.category === searchTag;
    return searchableItems.filter(item => tagMatch(item) && (!term || [item.title, item.category, item.type, item.description, item.author, ...(item.genres || []), ...(item.languages || [])]
      .filter(Boolean).some(value => String(value).toLowerCase().includes(term))));
  }, [query, searchTag]);

  const visibleSections = useMemo(() => {
    if (activeCategory === 'Home') return sections;
    return sections.filter(section => section.category === activeCategory || section.navTags?.includes(activeCategory));
  }, [activeCategory]);

  const continueItems = useMemo(() => searchableItems
    .filter(item => history[item.id]?.position > 0 && history[item.id].position / Math.max(history[item.id].duration || 1, 1) < .95)
    .sort((a, b) => history[b.id].updatedAt - history[a.id].updatedAt), [history]);

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast('Voice search is browser mein supported nahi hai.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-PK'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); showToast('Voice search dobara try karein.'); };
    recognition.onresult = event => { setQuery(event.results[0][0].transcript); setActiveTab('Home'); setViewAll(null); };
    recognition.start();
  };

  const showToast = message => setToast(message);
  const play = item => {
    if (item.type === 'Novel') { setActiveTab('Novels'); setQuery(''); return; }
    setPlayer(item);
  };
  const addDownload = item => {
    setDownloads(current => current.some(entry => entry.id === item.id) ? current : [{...item, progress: 4, status: 'downloading', quality: '1080p'}, ...current]);
    showToast(`${item.title} download queue mein add ho gaya.`);
  };
  const toggleFavorite = item => {
    const exists = favorites.includes(item.id);
    setFavorites(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]);
    showToast(exists ? 'My List se remove ho gaya.' : 'My List mein save ho gaya.');
  };
  const navigate = tab => {
    setActiveTab(tab); setViewAll(null); setQuery(''); setSearchTag('All');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const renderCard = (item, layout = 'poster') => (
    <MediaCard key={item.id} item={item} layout={layout} favorite={favorites.includes(item.id)} onPlay={() => play(item)} onDownload={() => addDownload(item)} onFavorite={() => toggleFavorite(item)} />
  );
  const searchMode = Boolean(query.trim() || searchTag !== 'All');

  return (
    <div data-testid="flixora-app" className="min-h-screen overflow-x-hidden bg-slate-950 text-white selection:bg-violet-500/40">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-10">
          <button onClick={() => navigate('Home')} className="shrink-0" aria-label="Go to Flixora home"><Logo /></button>
          <div className="relative ml-auto w-full max-w-2xl sm:w-auto sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={query} onChange={event => { setQuery(event.target.value); setActiveTab('Home'); setViewAll(null); }} className="h-10 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-24 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-red-400/70 focus:bg-white/10 focus:ring-4 focus:ring-red-500/10 sm:ml-auto" placeholder="Search everything…" aria-label="Search all Flixora content" />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {query && <button onClick={() => setQuery('')} className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Clear search"><X size={15} /></button>}
              <button onClick={startVoiceSearch} className={`grid h-7 w-7 place-items-center rounded-full transition ${listening ? 'animate-pulse bg-red-500 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`} aria-label="Voice search">{listening ? <MicOff size={15} /> : <Mic size={15} />}</button>
              <button onClick={() => setShowSearchTags(value => !value)} className={`grid h-7 w-7 place-items-center rounded-full transition ${showSearchTags || searchTag !== 'All' ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`} aria-label="Search filters"><SlidersHorizontal size={15} /></button>
            </div>
            {showSearchTags && <div className="absolute right-0 top-12 z-50 w-[min(92vw,480px)] rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-2xl"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">Filter search</strong><button onClick={() => setShowSearchTags(false)} aria-label="Close filters"><X size={16} /></button></div><div className="flex flex-wrap gap-2">{searchFilterTags.map(tag => <button key={tag} onClick={() => { setSearchTag(tag); setShowSearchTags(false); setActiveTab('Home'); setViewAll(null); }} className={`rounded-full px-3 py-2 text-xs font-bold transition ${searchTag === tag ? 'bg-red-500 text-white' : 'bg-white/[.06] text-slate-300 hover:bg-white/10'}`}>{tag}</button>)}</div></div>}
          </div>
          <button className="hidden h-10 w-10 place-items-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white sm:grid" aria-label="Notifications"><Bell size={18} /></button>
          <button onClick={() => navigate('Me')} className="hidden h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-red-500 to-red-950 text-sm font-black shadow-lg shadow-red-950/50 sm:grid">AK</button>
        </div>
        <div className="border-t border-white/5">
          <div className="no-scrollbar mx-auto flex max-w-[1600px] gap-2 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-10">
            {categories.map(category => (
              <button key={category} onClick={() => { setActiveCategory(category); setActiveTab('Home'); setViewAll(null); setQuery(''); setSearchTag('All'); }} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${activeCategory === category && activeTab === 'Home' ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,.3)]' : 'bg-white/[.06] text-slate-300 hover:bg-white/10 hover:text-white'}`}>{category}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="pb-28 pt-[117px] sm:pb-32">
        {activeTab === 'Home' && searchMode && <SearchView query={query || searchTag} items={searchResults} renderCard={renderCard} />}
        {activeTab === 'Home' && !searchMode && viewAll && <ViewAll section={viewAll} onBack={() => setViewAll(null)} renderCard={renderCard} />}
        {activeTab === 'Home' && !searchMode && !viewAll && (
          <>
            <Hero slide={heroSlides[heroIndex]} index={heroIndex} total={heroSlides.length} favorite={favorites.includes(heroSlides[heroIndex].id)} onPlay={() => play(heroSlides[heroIndex])} onDownload={() => addDownload(heroSlides[heroIndex])} onFavorite={() => toggleFavorite(heroSlides[heroIndex])} onChange={setHeroIndex} onPause={setHeroPaused} />
            <div className="relative z-10 -mt-5 space-y-10 sm:-mt-10 sm:space-y-12">
              {['Home', 'Trending'].includes(activeCategory) && <TrendingHub items={trendingNow} onPlay={play} />}
              {activeCategory === 'Home' && continueItems.length > 0 && <ContinueWatching items={continueItems} history={history} onPlay={play} />}
              {visibleSections.map(section => section.items.length > 0 && <ContentRow key={section.id} section={section} onSeeAll={() => setViewAll(section)} renderCard={renderCard} />)}
            </div>
          </>
        )}
        {activeTab === 'Shorts' && <ShortsView items={shorts} onPlay={play} />}
        {activeTab === 'Download' && <DownloadsView downloads={downloads} setDownloads={setDownloads} onPlay={play} />}
        {activeTab === 'Novels' && <NovelsView items={novels} />}
        {activeTab === 'Me' && <ProfileView favorites={favorites} history={history} onPlay={play} onNavigate={navigate} />}
      </main>

      <BottomNav active={activeTab} onChange={navigate} />
      {player && <Player movie={player} onClose={() => setPlayer(null)} initialProgress={history[player.id]?.position || 0} onProgress={(id, position, duration, metadata) => setHistory(current => ({...current, [id]: {position, duration, updatedAt: Date.now(), ...metadata}}))} />}
      {toast && <div className="fixed bottom-28 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-zinc-900/95 px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl"><Check size={17} className="text-emerald-400" />{toast}</div>}
    </div>
  );
}

function Hero({slide, index, total, favorite, onPlay, onDownload, onFavorite, onChange, onPause}) {
  return (
    <section className="relative min-h-[520px] overflow-hidden sm:min-h-[620px] lg:min-h-[680px]" onMouseEnter={() => onPause(true)} onMouseLeave={() => onPause(false)} aria-roledescription="carousel" aria-label="Featured content">
      <img key={slide.id} src={slide.backdrop || slide.image} onError={imageError} alt="" className="hero-enter absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-slate-950/5" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20" />
      <div className="relative mx-auto flex min-h-[520px] max-w-[1600px] items-end px-4 pb-20 pt-20 sm:min-h-[620px] sm:px-6 sm:pb-28 lg:min-h-[680px] lg:px-10">
        <div className="hero-copy max-w-2xl">
          <div className="mb-4 flex items-center gap-3"><span className={`rounded-full px-3 py-1.5 text-[10px] font-black tracking-[.18em] ${slide.isLive ? 'bg-red-500' : 'bg-violet-500/90'}`}>{slide.eyebrow}</span><span className="text-xs font-bold text-slate-200">FLIXORA ORIGINAL</span></div>
          <h1 className="max-w-3xl text-4xl font-black leading-[.95] tracking-[-.04em] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">{slide.heroTitle || slide.title}</h1>
          <div className="mt-5"><Meta item={slide} /></div><p className="mt-5 max-w-xl text-sm leading-6 text-slate-200 drop-shadow sm:text-base sm:leading-7">{slide.heroDescription || slide.description}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={onPlay} className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-slate-950 shadow-xl transition hover:scale-[1.03] hover:bg-red-100 sm:px-7"><Play size={18} fill="currentColor" /> Play Now</button>
            <button onClick={onFavorite} className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-extrabold text-white shadow-xl shadow-red-950/40 transition hover:bg-red-400"><Bookmark size={18} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'In Watchlist' : 'Add to Watchlist'}</button>
            <button onClick={onDownload} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/20"><Download size={18} /> Download</button>
          </div>
        </div>
      </div>
      <button onClick={() => onChange((index - 1 + total) % total)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/30 backdrop-blur transition hover:bg-black/60 sm:grid" aria-label="Previous banner"><ChevronLeft /></button>
      <button onClick={() => onChange((index + 1) % total)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/30 backdrop-blur transition hover:bg-black/60 sm:grid" aria-label="Next banner"><ChevronRight /></button>
      <div className="absolute bottom-16 right-5 flex gap-2 sm:bottom-24 sm:right-10">{Array.from({length: total}, (_, dot) => <button key={dot} onClick={() => onChange(dot)} className={`h-1.5 rounded-full transition-all ${dot === index ? 'w-8 bg-violet-400' : 'w-2 bg-white/40 hover:bg-white/70'}`} aria-label={`Open banner ${dot + 1}`} />)}</div>
    </section>
  );
}

function PosterImage({src, alt, className = '', wrapperClassName = ''}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`relative block overflow-hidden bg-zinc-900 ${wrapperClassName}`}>
      {!loaded && <span className="poster-skeleton absolute inset-0" aria-hidden="true" />}
      <img src={src} alt={alt} loading="lazy" onLoad={() => setLoaded(true)} onError={event => { imageError(event); setLoaded(true); }} className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
    </span>
  );
}

function TrendingHub({items, onPlay}) {
  const [active, setActive] = useState(trendingTabs[0]);
  const filtered = active === 'All Trending' ? items : items.filter(item => item.trendGroup === active);
  return (
    <section className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
      <div className="overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-950/40 via-zinc-950 to-black p-4 shadow-[0_25px_80px_rgba(0,0,0,.45)] sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div><div className="flex items-center gap-2 text-xs font-black tracking-[.2em] text-red-400"><TrendingUp size={17} /> EXCLUSIVE HUB</div><h2 className="mt-2 text-2xl font-black sm:text-3xl">Trending Now</h2><p className="mt-1 text-sm text-slate-500">Live popularity, rankings and what Flixora viewers are playing.</p></div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{trendingTabs.map(tab => <button key={tab} onClick={() => setActive(tab)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold transition ${active === tab ? 'bg-red-500 text-white shadow-lg shadow-red-950/50' : 'bg-white/[.06] text-slate-400 hover:bg-white/10 hover:text-white'}`}>{tab}</button>)}</div>
        </div>
        <div className="no-scrollbar mt-6 flex snap-x gap-3 overflow-x-auto pb-2">
          {filtered.map(item => <button key={item.id} onClick={() => onPlay(item)} className="group relative w-[230px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-900 text-left transition hover:-translate-y-1 hover:border-red-500/40 sm:w-[285px]"><div className="aspect-video overflow-hidden"><PosterImage src={item.backdrop || item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" wrapperClassName="h-full w-full" /></div><div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" /><span className="absolute -bottom-4 left-2 text-7xl font-black leading-none text-white/20 [-webkit-text-stroke:1px_rgba(255,255,255,.45)]">{item.rank}</span><span className="absolute left-3 top-3 rounded-md bg-red-500 px-2 py-1 text-[9px] font-black tracking-widest">{item.popularityBadge}</span><div className="absolute bottom-3 left-14 right-3"><strong className="line-clamp-1 text-sm sm:text-base">{item.title}</strong><span className="mt-1 flex items-center justify-between text-[10px] text-slate-300"><span>{item.views} views</span><span>#{item.rank} today</span></span></div></button>)}
        </div>
      </div>
    </section>
  );
}

function ContinueWatching({items, history, onPlay}) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
      <div className="mb-4"><h2 className="text-xl font-black sm:text-2xl">Continue Watching</h2><p className="mt-1 text-xs text-slate-500 sm:text-sm">Resume on any device from the exact moment you stopped.</p></div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">{items.map(item => {
        const progress = Math.min(100, history[item.id].position / Math.max(history[item.id].duration || 1, 1) * 100);
        return <button key={item.id} onClick={() => onPlay(item)} className="group w-[270px] shrink-0 text-left sm:w-[340px]"><div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10"><PosterImage src={item.backdrop || item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" wrapperClassName="h-full w-full" /><div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" /><span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-white text-black transition group-hover:scale-110"><Play size={17} fill="currentColor" /></span></span><div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20"><div className="h-full bg-red-500" style={{width: `${progress}%`}} /></div></div><div className="mt-2 flex justify-between gap-3"><strong className="truncate text-sm">{item.title}</strong><span className="shrink-0 text-[10px] text-slate-500">{Math.round(progress)}%</span></div></button>;
      })}</div>
    </section>
  );
}

function ContentRow({section, onSeeAll, renderCard}) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
      <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-xl font-black tracking-tight sm:text-2xl">{section.title}</h2><p className="mt-1 text-xs text-slate-500 sm:text-sm">{section.subtitle}</p></div><button onClick={onSeeAll} className="group flex shrink-0 items-center gap-1 text-xs font-bold text-red-300 transition hover:text-white sm:text-sm">See All <ChevronRight size={16} className="transition group-hover:translate-x-1" /></button></div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-5 sm:-mx-6 sm:gap-4 sm:px-6 lg:-mx-10 lg:px-10">{section.items.map(item => renderCard(item, section.layout))}</div>
    </section>
  );
}

function MediaCard({item, layout, favorite, onPlay, onDownload, onFavorite}) {
  if (layout === 'novel') return <NovelCard item={item} />;
  if (layout === 'short') return <ShortCard item={item} onPlay={onPlay} />;
  const wide = layout === 'wide';
  return (
    <article className={`media-card group relative shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[.07] bg-zinc-900 shadow-xl ${wide ? 'w-[280px] sm:w-[360px]' : 'w-[148px] sm:w-[190px] lg:w-[210px]'}`}>
      <button onClick={onPlay} className="block w-full text-left" aria-label={`Play ${item.title}`}>
        <div className={`relative overflow-hidden ${wide ? 'aspect-video' : 'aspect-[2/3]'}`}>
          <PosterImage src={item.image || item.backdrop} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" wrapperClassName="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90" />
          {item.isLive && <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-red-500 px-2 py-1 text-[10px] font-black tracking-wider"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE</span>}
          {!item.isLive && item.tag && <span className="absolute left-3 top-3 rounded-md bg-violet-500 px-2 py-1 text-[9px] font-black tracking-wider">{item.tag}</span>}
          <span className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100"><span className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-950 shadow-2xl"><Play size={20} fill="currentColor" className="ml-0.5" /></span></span>
          <div className="absolute bottom-3 left-3 right-3"><p className="line-clamp-1 text-sm font-extrabold text-white sm:text-base">{item.title}</p>{wide && <div className="mt-1"><Meta item={item} /></div>}</div>
        </div>
      </button>
      {!wide && <div className="p-3"><Meta item={item} /></div>}
      <div className="absolute right-2 top-2 flex translate-y-1 gap-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
        <button onClick={onFavorite} className="grid h-8 w-8 place-items-center rounded-full bg-black/65 backdrop-blur hover:bg-red-500" aria-label="Add to My List"><Heart size={14} fill={favorite ? 'currentColor' : 'none'} /></button>
        <button onClick={onDownload} className="grid h-8 w-8 place-items-center rounded-full bg-black/65 backdrop-blur hover:bg-red-500" aria-label="Download"><Download size={14} /></button>
      </div>
    </article>
  );
}

function NovelCard({item}) {
  return (
    <article className="group flex w-[260px] shrink-0 snap-start gap-3 rounded-2xl border border-white/[.07] bg-white/[.035] p-3 transition hover:-translate-y-1 hover:border-red-400/30 sm:w-[310px]">
      <PosterImage src={item.image} alt={item.title} className="h-full w-full object-cover" wrapperClassName="h-36 w-24 shrink-0 rounded-xl shadow-2xl" />
      <div className="min-w-0 flex-1 py-1"><span className="text-[10px] font-black tracking-[.18em] text-red-400">FLIXORA READ</span><h3 className="mt-2 line-clamp-2 font-extrabold">{item.title}</h3><p className="mt-1 text-xs text-slate-400">by {item.author}</p><p className="mt-3 text-xs text-slate-500">{item.chapters} chapters</p><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-400" style={{width: `${item.progress}%`}} /></div><button className="mt-3 flex items-center gap-1 text-xs font-bold text-red-300 group-hover:text-white"><BookOpen size={14} /> {item.progress ? 'Continue reading' : 'Start reading'}</button></div>
    </article>
  );
}

function ShortCard({item, onPlay}) {
  return (
    <button onClick={onPlay} className="group relative aspect-[9/16] w-[145px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-900 text-left shadow-xl sm:w-[180px]">
      <PosterImage src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" wrapperClassName="absolute inset-0" /><div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10" />
      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold backdrop-blur">{item.duration}</span><span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/20 backdrop-blur transition group-hover:scale-110 group-hover:bg-red-500"><Play size={18} fill="white" /></span></span>
      <span className="absolute bottom-3 left-3 right-3"><strong className="line-clamp-2 text-sm leading-tight">{item.title}</strong><span className="mt-1 flex justify-between text-[10px] text-slate-300"><span>{item.creator}</span><span>{item.views} views</span></span></span>
    </button>
  );
}

function SearchView({query, items, renderCard}) {
  return (
    <section className="mx-auto min-h-[70vh] max-w-[1600px] px-4 py-10 sm:px-6 lg:px-10"><span className="text-xs font-black tracking-[.18em] text-red-400">SEARCH ACROSS FLIXORA</span><h1 className="mt-2 text-3xl font-black">Results for “{query}”</h1><p className="mt-2 text-sm text-slate-400">{items.length} {items.length === 1 ? 'result' : 'results'} across movies, sports, anime, shorts and books.</p>
      {items.length ? <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{items.map(item => renderCard(item, item.type === 'Short' ? 'short' : item.type === 'Novel' ? 'novel' : item.isLive ? 'wide' : 'poster'))}</div> : <EmptyState icon={Search} title="No matches yet" text="Try another title, sport, creator or category." />}
    </section>
  );
}

function ViewAll({section, onBack, renderCard}) {
  return (
    <section className="fixed inset-0 z-[70] overflow-y-auto bg-black/95 px-4 py-8 backdrop-blur-xl sm:px-6 lg:px-10" role="dialog" aria-modal="true" aria-label={section.title}><div className="mx-auto max-w-[1600px]"><button onClick={onBack} className="mb-6 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-red-500 hover:text-white"><ChevronLeft size={18} /> Close collection</button><h1 className="text-3xl font-black">{section.title}</h1><p className="mt-2 text-slate-400">{section.subtitle}</p>
      <div className={`mt-8 grid gap-4 ${section.layout === 'novel' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : section.layout === 'wide' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>{section.items.map(item => renderCard(item, section.layout))}</div></div>
    </section>
  );
}

function ShortsView({items, onPlay}) {
  return <section className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6"><PageHeading icon={Flame} eyebrow="VERTICAL FEED" title="Flixora Shorts" text="Swipe through mini-dramas, match moments and fast entertainment." /><div className="no-scrollbar mx-auto mt-6 h-[calc(100vh-260px)] min-h-[520px] snap-y snap-mandatory overflow-y-auto rounded-3xl bg-black">{items.map(item => <article key={item.id} className="relative mx-auto flex min-h-full max-w-md snap-start items-center justify-center"><button onClick={() => onPlay(item)} className="group relative aspect-[9/16] max-h-[calc(100vh-280px)] w-full overflow-hidden rounded-3xl bg-zinc-900 text-left"><PosterImage src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" wrapperClassName="absolute inset-0" /><div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" /><span className="absolute left-4 top-4 rounded-full bg-red-500 px-3 py-1 text-[10px] font-black tracking-wider">SHORT TV</span><span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-white/20 backdrop-blur group-hover:bg-red-500"><Play fill="white" /></span></span><div className="absolute bottom-5 left-5 right-16"><strong className="text-xl">{item.title}</strong><p className="mt-1 text-sm text-slate-300">{item.creator} · {item.views} views</p></div><div className="absolute bottom-5 right-3 flex flex-col gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 backdrop-blur"><Heart size={19} /></span><span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 backdrop-blur"><Bookmark size={19} /></span></div></button></article>)}</div></section>;
}

function DownloadsView({downloads, setDownloads, onPlay}) {
  const used = downloads.reduce((sum, item) => sum + (item.status === 'complete' ? 1.4 : item.progress * .014), 0);
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><PageHeading icon={Download} eyebrow="WATCH ANYWHERE" title="Your Downloads" text="Keep entertainment ready for flights, commutes and slow connections." />
      <div className="mt-8 rounded-2xl border border-white/[.07] bg-white/[.035] p-5"><div className="flex justify-between text-sm"><span className="font-bold">Device storage</span><span className="text-slate-400">{used.toFixed(1)} GB of 24 GB</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{width: `${Math.min(100, used / 24 * 100)}%`}} /></div></div>
      {downloads.length ? <div className="mt-6 space-y-3">{downloads.map(item => (
        <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-zinc-900/80 p-3 sm:gap-5 sm:p-4"><img src={item.image || item.backdrop} onError={imageError} alt="" className="h-20 w-28 rounded-xl object-cover sm:h-24 sm:w-36" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="truncate font-extrabold">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{item.quality} · {item.status === 'complete' ? 'Ready offline' : `${item.progress}% downloaded`}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.status === 'complete' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-violet-500/15 text-violet-300'}`}>{item.status}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500 transition-all" style={{width: `${item.progress}%`}} /></div></div><button onClick={() => item.status === 'complete' ? onPlay(item) : setDownloads(current => current.map(entry => entry.id === item.id ? {...entry, status: entry.status === 'paused' ? 'downloading' : 'paused'} : entry))} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-violet-500" aria-label="Pause, resume or play">{item.status === 'downloading' ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</button><button onClick={() => setDownloads(current => current.filter(entry => entry.id !== item.id))} className="grid h-10 w-10 place-items-center rounded-full text-slate-400 hover:bg-red-500/15 hover:text-red-400" aria-label="Remove download"><Trash2 size={17} /></button></article>
      ))}</div> : <EmptyState icon={Download} title="Your offline library is empty" text="Tap Download on any movie, episode or live replay to save it here." />}
    </section>
  );
}

function NovelsView({items}) {
  const [reading, setReading] = useState(null);
  const [chapter, setChapter] = useState(1);
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10"><PageHeading icon={BookOpen} eyebrow="FLIXORA READ" title="Stories beyond the screen" text="Read original novels, save chapters offline and continue exactly where you stopped." />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <article key={item.id} className="group relative min-h-72 overflow-hidden rounded-3xl border border-white/[.08] bg-zinc-900 p-5"><div className={`absolute inset-0 bg-gradient-to-br ${item.accent} opacity-25 transition group-hover:opacity-40`} /><div className="relative flex gap-5"><PosterImage src={item.image} alt={item.title} className="h-full w-full object-cover transition group-hover:-rotate-2 group-hover:scale-105" wrapperClassName="h-52 w-36 shrink-0 rounded-2xl shadow-2xl" /><div className="min-w-0 py-2"><span className="text-[10px] font-black tracking-[.18em] text-red-300">ORIGINAL NOVEL</span><h2 className="mt-3 text-xl font-black">{item.title}</h2><p className="mt-1 text-sm text-slate-300">{item.author}</p><p className="mt-4 text-xs leading-5 text-slate-400">{item.description}</p></div></div><div className="relative mt-5 flex items-center gap-3"><button onClick={() => { setReading(item); setChapter(Math.max(1, Math.round((item.progress || 0) / 100 * item.chapters))); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-black text-slate-950 transition hover:bg-red-100"><BookOpen size={17} /> {item.progress ? 'Continue' : 'Start reading'}</button><button className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Download chapters"><Download size={17} /></button></div></article>)}</div>
      {reading && <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#f4efe5] p-4 text-zinc-900 sm:p-10" role="dialog" aria-modal="true"><div className="mx-auto max-w-3xl"><div className="sticky top-0 flex items-center justify-between rounded-2xl bg-[#f4efe5]/95 py-3 backdrop-blur"><div><span className="text-xs font-black tracking-widest text-red-700">CHAPTER {chapter} OF {reading.chapters}</span><h2 className="text-xl font-black">{reading.title}</h2></div><button onClick={() => setReading(null)} className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-white" aria-label="Close reader"><X size={18} /></button></div><article className="mt-8 font-serif text-lg leading-9"><h1 className="mb-8 text-4xl font-black">{chapter}. {['A Signal in the Dark', 'Beyond the Old City', 'The Unwritten Promise', 'When the Rain Returned'][chapter % 4]}</h1><p>{reading.description} The city had learned to keep its secrets beneath the noise of evening traffic, but tonight every street seemed to point toward the same unanswered question.</p><p className="mt-6">A pale light crossed the window. For a moment, the room held its breath. Somewhere beyond the rooftops, a message waited for the one person willing to follow it.</p><p className="mt-6">This interactive preview saves the chapter automatically and keeps the reader position available across the Flixora library.</p></article><div className="mt-12 flex justify-between border-t border-zinc-900/10 py-6"><button disabled={chapter <= 1} onClick={() => setChapter(value => Math.max(1, value - 1))} className="rounded-xl bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-30">Previous</button><button disabled={chapter >= reading.chapters} onClick={() => setChapter(value => Math.min(reading.chapters, value + 1))} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-30">Next chapter</button></div></div></div>}
    </section>
  );
}

function ProfileView({favorites, history, onPlay, onNavigate}) {
  const favoriteItems = searchableItems.filter(item => favorites.includes(item.id));
  const historyItems = searchableItems.filter(item => history[item.id]).sort((a, b) => history[b.id].updatedAt - history[a.id].updatedAt);
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div className="overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-red-950/70 via-zinc-900 to-black p-6 sm:p-10"><div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center"><div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-red-500 to-red-950 text-3xl font-black shadow-[0_0_50px_rgba(239,68,68,.25)]">AK</div><div><span className="text-xs font-black tracking-[.18em] text-red-300">PREMIUM MEMBER</span><h1 className="mt-2 text-3xl font-black">Alex Khan</h1><p className="mt-1 text-sm text-slate-400">4K streaming · 4 devices · Kids profile enabled</p></div><button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold hover:bg-white/10 sm:ml-auto"><Settings size={17} /> Settings</button></div></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3"><Stat icon={Clock3} value={historyItems.length} label="Recently watched" /><Stat icon={Bookmark} value={favoriteItems.length} label="Saved to My List" /><Stat icon={Wifi} value="Ultra HD" label="Streaming quality" /></div>
      <div className="mt-6 grid gap-4 rounded-3xl border border-white/[.07] bg-white/[.03] p-5 md:grid-cols-3"><label className="text-sm font-bold text-slate-300">App language<select className="mt-2 block h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-white"><option>English</option><option>Urdu</option><option>Hindi</option><option>Punjabi</option></select></label><label className="text-sm font-bold text-slate-300">Playback quality<select className="mt-2 block h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-white"><option>Auto (recommended)</option><option>4K Ultra HD</option><option>1080p</option><option>Data saver</option></select></label><div><p className="text-sm font-bold text-slate-300">Parental control</p><button className="mt-2 flex h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm"><span>Kids PIN enabled</span><span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-400">ON</span></button></div></div>
      <div className="mt-10"><h2 className="text-xl font-black">My List</h2>{favoriteItems.length ? <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{favoriteItems.map(item => <MediaCard key={item.id} item={item} layout="poster" favorite onPlay={() => onPlay(item)} onDownload={() => onNavigate('Download')} onFavorite={() => {}} />)}</div> : <EmptyState icon={Heart} title="Build your personal watchlist" text="Tap the heart on a title and it will appear here." />}</div>
    </section>
  );
}

function Stat({icon: Icon, value, label}) { return <div className="flex items-center gap-4 rounded-2xl border border-white/[.07] bg-white/[.035] p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-red-500/15 text-red-300"><Icon size={20} /></span><div><strong className="text-xl">{value}</strong><p className="text-xs text-slate-500">{label}</p></div></div>; }
function PageHeading({icon: Icon, eyebrow, title, text}) { return <div><div className="flex items-center gap-2 text-xs font-black tracking-[.18em] text-red-400"><Icon size={16} />{eyebrow}</div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{text}</p></div>; }
function EmptyState({icon: Icon, title, text}) { return <div className="mt-10 grid min-h-64 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[.02] p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-red-300"><Icon size={24} /></span><h2 className="mt-4 text-lg font-black">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p></div></div>; }

function BottomNav({active, onChange}) {
  return <nav className="fixed bottom-0 left-1/2 z-40 w-full -translate-x-1/2 border-t border-white/10 bg-slate-950/90 px-2 pb-[max(.6rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-20px_50px_rgba(2,6,23,.65)] backdrop-blur-2xl sm:bottom-5 sm:max-w-xl sm:rounded-2xl sm:border sm:px-3 sm:pb-2"><div className="flex items-center justify-around">{tabs.map(({id, label, icon: Icon}) => <button key={id} onClick={() => onChange(id)} className={`relative flex min-w-14 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold transition sm:min-w-20 ${active === id ? 'bg-red-500/15 text-red-300' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}><Icon size={20} fill={active === id && id === 'Home' ? 'currentColor' : 'none'} /><span>{label}</span>{active === id && <span className="absolute -top-2 h-0.5 w-6 rounded-full bg-red-400 shadow-[0_0_10px_#ef4444]" />}</button>)}</div></nav>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
