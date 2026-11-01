import React, {lazy, Suspense, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  ArrowRight, Bell, Bookmark, Check, ChevronDown, Clapperboard, Compass,
  Download, Film, HardDrive, House, Info, LockKeyhole, Menu, Pause,
  Play, Plus, Search, SlidersHorizontal, Star, Trash2, Users, X,
} from 'lucide-react';
import {catalogFacets, movies} from './catalog';
import './styles.css';

const Player = lazy(() => import('./Player'));
const PROFILES = {
  alex: {id: 'alex', name: 'Alex', label: 'Personal profile', isKids: false, maxAge: 18},
  kids: {id: 'kids', name: 'Kids', label: 'Kids · 12 and under', isKids: true, maxAge: 12},
};
const EMPTY_PROFILE = {list: [], downloads: [], reviews: {}, history: {}};
const POSTER_FALLBACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#38285b"/><stop offset="1" stop-color="#10131d"/></linearGradient></defs><rect width="500" height="750" fill="url(#g)"/><circle cx="250" cy="325" r="70" fill="#9b78ee" opacity=".25"/><path d="m235 285 65 40-65 40z" fill="#c9b5ff"/><text x="250" y="470" text-anchor="middle" fill="#d8ccef" font-size="34" font-family="sans-serif">FLIXORA</text></svg>')}`;

function safeRead(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function normalProfile(value) {
  if (!value || typeof value !== 'object') return {...EMPTY_PROFILE};
  return {
    list: Array.isArray(value.list) ? value.list.filter(id => typeof id === 'string') : [],
    downloads: Array.isArray(value.downloads) ? value.downloads.filter(item => item && typeof item.id === 'string') : [],
    reviews: value.reviews && typeof value.reviews === 'object' ? value.reviews : {},
    history: value.history && typeof value.history === 'object' ? value.history : {},
  };
}

function initialLibrary() {
  const saved = safeRead('flixora:profile-data:v2', null);
  if (saved?.alex || saved?.kids) return {alex: normalProfile(saved.alex), kids: normalProfile(saved.kids)};
  const now = Date.now();
  return {
    alex: {
      list: safeRead('flixora:list', []),
      downloads: safeRead('flixora:downloads', []),
      reviews: safeRead('flixora:reviews', {}),
      history: {
        interstellar: {position: 3600, duration: 10140, updatedAt: now - 10000},
        shogun: {position: 1180, duration: 3600, updatedAt: now - 20000, episodeId: 'shogun-s1e3'},
      },
    },
    kids: {
      ...EMPTY_PROFILE,
      history: {spiderverse: {position: 1620, duration: 8400, updatedAt: now - 15000}},
    },
  };
}

function imageFallback(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = POSTER_FALLBACK;
  event.currentTarget.classList.add('image-fallback');
}

function useDialog(open, ref, close) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    document.body.classList.add('modal-open');
    const focusable = () => [...(ref.current?.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])') || [])];
    focusable()[0]?.focus();
    const keydown = event => {
      if (event.key === 'Escape') return closeRef.current?.();
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, [open, ref]);
}

function App() {
  const [page, setPage] = useState('Home');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All genres');
  const [type, setType] = useState('All types');
  const [year, setYear] = useState('Any year');
  const [rating, setRating] = useState('Any rating');
  const [language, setLanguage] = useState('All languages');
  const [country, setCountry] = useState('All countries');
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState(null);
  const [player, setPlayer] = useState(null);
  const [library, setLibrary] = useState(initialLibrary);
  const [profileId, setProfileId] = useState('alex');
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [toast, setToast] = useState('');
  const [hero, setHero] = useState(0);
  const [review, setReview] = useState('');
  const [stars, setStars] = useState(5);
  const [downloadQuality, setDownloadQuality] = useState('720p');
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef(null);
  const profilePopoverRef = useRef(null);
  const detailRef = useRef(null);
  const pinRef = useRef(null);

  const profile = PROFILES[profileId];
  const data = normalProfile(library[profileId]);
  const movieMap = useMemo(() => new Map(movies.map(movie => [movie.id, movie])), []);
  const allowedMovies = useMemo(() => movies.filter(movie => movie.ageRating <= profile.maxAge), [profile.maxAge]);

  useEffect(() => {
    try { localStorage.setItem('flixora:profile-data:v2', JSON.stringify(library)); } catch { /* Storage is optional. */ }
  }, [library]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const keydown = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  useEffect(() => {
    if (!profilesOpen) return undefined;
    const outside = event => {
      if (!profilePopoverRef.current?.contains(event.target)) setProfilesOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [profilesOpen]);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const interval = setInterval(() => setHero(current => (current + 1) % Math.min(2, allowedMovies.length)), 9000);
    return () => clearInterval(interval);
  }, [allowedMovies.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLibrary(current => {
        const currentData = normalProfile(current[profileId]);
        let changed = false;
        const downloads = currentData.downloads.map(item => {
          if (!['queued', 'downloading'].includes(item.status || 'queued')) return item;
          changed = true;
          const progress = Math.min(100, Number(item.progress || 0) + (item.status === 'queued' ? 4 : 8));
          return {...item, status: progress >= 100 ? 'complete' : 'downloading', progress};
        });
        return changed ? {...current, [profileId]: {...currentData, downloads}} : current;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [profileId]);

  useEffect(() => {
    const validIds = new Set(movies.map(movie => movie.id));
    if (data.downloads.some(item => !validIds.has(item.id))) {
      setLibrary(current => ({...current, [profileId]: {...normalProfile(current[profileId]), downloads: normalProfile(current[profileId]).downloads.filter(item => validIds.has(item.id))}}));
    }
  }, [data.downloads, profileId]);

  useEffect(() => {
    setReview('');
    setStars(5);
    setDownloadQuality('720p');
  }, [detail?.id]);

  useDialog(Boolean(detail), detailRef, () => setDetail(null));
  useDialog(pinOpen, pinRef, () => setPinOpen(false));

  const updateProfile = change => {
    setLibrary(current => {
      const existing = normalProfile(current[profileId]);
      return {...current, [profileId]: typeof change === 'function' ? change(existing) : {...existing, ...change}};
    });
  };

  const resetFilters = () => {
    setGenre('All genres'); setType('All types'); setYear('Any year');
    setRating('Any rating'); setLanguage('All languages'); setCountry('All countries');
  };

  const nav = target => {
    setPage(target); setQuery(''); setMobileOpen(false); setShowFilters(false);
    if (target === 'Home') resetFilters();
  };

  const switchProfile = target => {
    setProfilesOpen(false);
    if (target === profileId) return;
    if (target === 'alex' && profileId === 'kids') {
      setPin(''); setPinError(''); setPinOpen(true); return;
    }
    setProfileId(target); setPage('Home'); setPlayer(null); setDetail(null);
    setToast(`Switched to ${PROFILES[target].name}.`);
  };

  const unlockAdult = event => {
    event.preventDefault();
    if (pin !== '1234') { setPinError('Demo PIN ghalat hai. 1234 try karein.'); return; }
    setPinOpen(false); setProfileId('alex'); setPage('Home'); setPin('');
    setToast('Adult profile unlocked for this demo session.');
  };

  const toggleList = movie => updateProfile(current => ({
    ...current,
    list: current.list.includes(movie.id) ? current.list.filter(id => id !== movie.id) : [...current.list, movie.id],
  }));

  const queueDownload = movie => {
    const sizeByQuality = {'480p': 350, '720p': 700, '1080p': 1400, '4K': 3600};
    updateProfile(current => ({
      ...current,
      downloads: [...current.downloads.filter(item => item.id !== movie.id), {id: movie.id, quality: downloadQuality, status: 'queued', progress: 0, sizeMb: sizeByQuality[downloadQuality]}],
    }));
    setToast(`${movie.title} ${downloadQuality} demo download queue mein add ho gaya.`);
  };

  const changeDownload = (id, change) => updateProfile(current => ({
    ...current,
    downloads: current.downloads.map(item => item.id === id ? {...item, ...change} : item),
  }));

  const saveProgress = (id, position, duration, metadata = {}) => {
    if (!movieMap.has(id)) return;
    updateProfile(current => ({
      ...current,
      history: {...current.history, [id]: {position, duration: duration || movieMap.get(id).durationSeconds, updatedAt: Date.now(), ...metadata}},
    }));
  };

  const continueWatching = Object.entries(data.history)
    .map(([id, history]) => ({movie: movieMap.get(id), history}))
    .filter(item => item.movie && item.movie.ageRating <= profile.maxAge && item.history.position > 0 && !item.history.completed && item.history.position / item.history.duration < .95)
    .sort((a, b) => b.history.updatedAt - a.history.updatedAt);

  const filtersActive = genre !== 'All genres' || type !== 'All types' || year !== 'Any year' || rating !== 'Any rating' || language !== 'All languages' || country !== 'All countries';
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = allowedMovies.filter(movie => {
    const searchable = [movie.title, movie.description, movie.genre, movie.type, movie.language, movie.country, ...movie.genres].join(' ').toLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (genre === 'All genres' || movie.genres.includes(genre))
      && (type === 'All types' || movie.type === type)
      && (year === 'Any year' || movie.year === Number(year))
      && (rating === 'Any rating' || movie.rating >= Number(rating))
      && (language === 'All languages' || movie.language === language)
      && (country === 'All countries' || movie.country === country)
      && (page !== 'My List' || data.list.includes(movie.id))
      && (page !== 'TV Shows' || movie.type === 'TV Series')
      && (page !== 'Movies' || movie.type === 'Movie');
  });
  const browsing = Boolean(query || showFilters || filtersActive || ['Discover', 'Movies', 'TV Shows', 'My List'].includes(page));
  const heroItems = profile.isKids ? allowedMovies.filter(movie => movie.ageRating <= 9) : allowedMovies;
  const feature = heroItems[hero % Math.max(heroItems.length, 1)] || allowedMovies[0];
  const topTen = [...allowedMovies].sort((a, b) => b.rating - a.rating).slice(0, 10);
  const validDownloads = data.downloads.filter(item => movieMap.has(item.id));
  const usedStorage = validDownloads.reduce((total, item) => total + Math.round((item.sizeMb || 0) * (item.progress || 0) / 100), 0);
  const storageLimit = 4096;

  function Card({movie, wide = false, rank, history}) {
    const progress = history?.duration ? Math.min(100, history.position / history.duration * 100) : 0;
    const minutesLeft = history?.duration ? Math.max(1, Math.round((history.duration - history.position) / 60)) : null;
    return <article className={`movie-card ${wide ? 'wide' : ''}`}>
      <button className="poster-button" onClick={() => setDetail(movie)} aria-label={`View details for ${movie.title}`}>
        <img src={movie.image} alt="" loading="lazy" onError={imageFallback}/>
        {movie.tag && <span className="card-tag">{movie.tag}</span>}
        <span className="hover-play" aria-hidden="true"><Info size={24}/></span>
        {rank && <span className="rank">{rank}</span>}
        {wide && <><div className="wide-title">{movie.title}</div><div className="progress-track" aria-label={`${Math.round(progress)} percent watched`}><span style={{width: `${progress}%`}}/></div></>}
      </button>
      <div className="card-bottom"><div><h3>{movie.title}</h3><p>{movie.year}<span>•</span>{movie.genre}</p></div><span className="card-rating"><Star size={11} fill="currentColor"/>{movie.rating}</span></div>
      {wide && <span className="continue-time">{history?.episodeId ? 'Episode in progress' : 'Movie'} · {minutesLeft}m left</span>}
    </article>;
  }

  function Rail({title, subtitle, items, wide = false, ranked = false}) {
    return <section className="rail-section"><div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="text-button" onClick={() => nav('Discover')}>View all <ArrowRight size={14}/></button></div><div className={`rail ${wide ? 'wide-rail' : ''}`}>{items.map((item, index) => {
      const movie = item.movie || item;
      return <Card key={movie.id} movie={movie} history={item.history} wide={wide} rank={ranked ? index + 1 : null}/>;
    })}</div></section>;
  }

  const libraryNav = [[Bookmark, 'My List'], [Download, 'Downloads'], ...(!profile.isKids ? [[Users, 'Community']] : [])];

  return <div className="app-shell">
    <button className={`mobile-backdrop ${mobileOpen ? 'is-open' : ''}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
      <a className="brand" href="#home" onClick={event => {event.preventDefault(); nav('Home');}}><span className="brand-mark"><Play size={20} fill="currentColor"/></span>flixora<span className="brand-dot">.</span></a>
      <div className="nav-label">MENU</div>
      <nav>{[[House, 'Home'], [Compass, 'Discover'], [Film, 'Movies'], [Clapperboard, 'TV Shows']].map(([Icon, name]) => <button key={name} className={page === name ? 'active' : ''} aria-current={page === name ? 'page' : undefined} onClick={() => nav(name)}><Icon size={19}/>{name}</button>)}</nav>
      <div className="nav-label library-label">YOUR LIBRARY</div>
      <nav>{libraryNav.map(([Icon, name]) => <button key={name} className={page === name ? 'active' : ''} aria-current={page === name ? 'page' : undefined} onClick={() => nav(name)}><Icon size={19}/>{name}{name === 'My List' && <span className="nav-count">{data.list.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="premium-card"><span className="premium-icon">✧</span><h3>A little more cinema.</h3><p>All your favorites.<br/>One extraordinary experience.</p><button onClick={() => setToast('Premium billing is not connected in this demo.')}>Explore Premium <ArrowRight size={13}/></button></div>
        <button className="sidebar-profile" onClick={() => setProfilesOpen(open => !open)} aria-haspopup="menu" aria-expanded={profilesOpen}><div className="avatar">{profile.name[0]}</div><div><strong>{profile.name}</strong><small>{profile.label}</small></div><ChevronDown size={15}/></button>
      </div>
    </aside>

    <main><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(open => !open)} aria-label="Open menu" aria-expanded={mobileOpen}><Menu/></button><div className="breadcrumbs">Discover a world of stories<span>✦</span></div><div className="topbar-actions"><div className="search-box"><Search size={17}/><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search movies, shows, and more" aria-label="Search movies and shows"/><kbd>⌘ K</kbd></div><button className="notification icon-button" onClick={() => setToast('You’re all caught up.')} aria-label="Notifications"><Bell size={19}/><i/></button><button className="top-avatar" onClick={() => setProfilesOpen(open => !open)} aria-label="Switch profile" aria-expanded={profilesOpen}>{profile.name[0]}</button></div></header>

      {page === 'Home' && !browsing && feature && <><section className={`hero hero-${hero}`}><img className="hero-image" src={feature.backdrop || feature.image} alt="" onError={imageFallback}/><div className="hero-shade"/><div className="hero-content"><div className="exclusive"><span className="mini-logo">f</span> THE SPOTLIGHT <span className="exclusive-line"/> {profile.isKids ? 'KIDS SAFE' : 'ONLY ON YOUR RADAR'}</div><h1>{feature.title}</h1><div className="hero-meta"><span className="match">98% match</span><span>{feature.year}</span><span className="age-badge">{feature.ageRating}+</span><span>{feature.duration}</span><span className="quality">4K</span></div><p>{feature.description}</p><div className="hero-buttons"><button className="primary-button" onClick={() => setPlayer(feature)}><Play size={18} fill="currentColor"/> Watch demo</button><button className="secondary-button" onClick={() => toggleList(feature)}>{data.list.includes(feature.id) ? <Check size={19}/> : <Plus size={19}/>} My List</button><button className="hero-info" onClick={() => setDetail(feature)} aria-label={`More information about ${feature.title}`}><Info size={21}/></button></div><div className="hero-genres">{feature.genres.join(' • ')}</div></div><div className="hero-foot"><span><i/> THIS WEEK’S MUST-WATCH</span><div className="hero-dots">{heroItems.slice(0, 2).map((item, index) => <button key={item.id} aria-label={`Featured slide ${index + 1}`} className={hero % 2 === index ? 'selected' : ''} onClick={() => setHero(index)}/>)}<span>0{hero % 2 + 1} <small>/ 02</small></span></div></div></section>
        <div className="genre-bar">{['For you', 'Action', 'Sci-Fi', 'Drama', 'Animation'].map((item, index) => <button key={item} className={index === 0 ? 'selected' : ''} onClick={() => {if (index) {setGenre(item); setPage('Discover');}}}>{index === 0 && <span>✦</span>}{item}</button>)}<button className="filter-button" onClick={() => setShowFilters(true)}><SlidersHorizontal size={15}/> Filters</button></div>
        <div className="content">{continueWatching.length > 0 && <Rail title="Pick up where you left off" subtitle="Har profile ki apni playback history." items={continueWatching} wide/>}<Rail title={<>Trending now <span className="live-badge">LIVE</span></>} subtitle="The stories everyone’s talking about." items={allowedMovies.slice(0, 6)}/><Rail title={<>Your next obsession <span className="for-you-badge">FOR YOU</span></>} subtitle={profile.isKids ? 'Chosen for younger viewers' : 'Because you watched Interstellar'} items={allowedMovies.slice().reverse().slice(0, 6)}/><Rail title="Top 10 today" items={topTen} ranked/></div>
      </>}

      {browsing && <div className="content browse"><div className="page-heading"><span className="eyebrow">YOUR WORLD OF ENTERTAINMENT</span><h1>{query ? 'Search results' : page === 'Home' ? 'Discover' : page}</h1><p>{page === 'My List' ? 'Your favorites, ready when you are.' : profile.isKids ? 'Age-appropriate stories for the Kids profile.' : 'Find the story you’ve been looking for.'}</p></div><div className="filter-row"><fieldset><legend>Catalog filters</legend>{[
        [genre, setGenre, catalogFacets.genres, 'Genre'], [type, setType, catalogFacets.types, 'Content type'], [year, setYear, catalogFacets.years, 'Release year'], [rating, setRating, ['Any rating', '7', '8', '8.5'], 'Minimum rating'], [language, setLanguage, catalogFacets.languages, 'Language'], [country, setCountry, catalogFacets.countries, 'Country'],
      ].map(([value, setter, options, label]) => <select key={label} aria-label={label} value={value} onChange={event => setter(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select>)}</fieldset><button className="text-button" onClick={() => {resetFilters(); setShowFilters(false);}}>Reset filters</button></div><p className="muted">{filtered.length} titles to explore</p><div className="browse-grid">{filtered.map(movie => <Card key={movie.id} movie={movie}/>)}</div>{!filtered.length && <div className="empty-state"><Search size={36}/><h2>No titles found</h2><p>Try a different search or filter.</p></div>}</div>}

      {page === 'Downloads' && !query && <div className="content browse"><span className="eyebrow">TAKE YOUR STORIES WITH YOU</span><h1>Downloads</h1><p className="muted">Simulated browser download manager · real encrypted offline files require the native app.</p><div className="storage"><HardDrive/><div><strong>{Math.round(usedStorage)} MB of {storageLimit} MB used</strong><div className="storage-meter" aria-label={`${Math.round(usedStorage / storageLimit * 100)} percent storage used`}><span style={{width: `${Math.min(100, usedStorage / storageLimit * 100)}%`}}/></div><p>{validDownloads.length} titles · progress is simulated for this product demo.</p></div></div>{validDownloads.map(item => {const movie = movieMap.get(item.id); const status = item.status || 'queued'; return <div className="download-row" key={item.id}><img src={movie.image} alt="" onError={imageFallback}/><div><h3>{movie.title}</h3><p>{item.quality} · {item.sizeMb || 700} MB</p><span className={`download-state is-${status}`}>{status}</span><div className="download-progress" aria-label={`${item.progress || 0} percent downloaded`}><span style={{width: `${item.progress || 0}%`}}/></div></div><div className="download-actions">{['queued', 'downloading'].includes(status) && <button className="icon-button" aria-label={`Pause ${movie.title}`} onClick={() => changeDownload(item.id, {status: 'paused'})}><Pause size={18}/></button>}{status === 'paused' && <button className="icon-button" aria-label={`Resume ${movie.title}`} onClick={() => changeDownload(item.id, {status: 'downloading'})}><Play size={18}/></button>}<button className="icon-button" aria-label={`Remove ${movie.title}`} onClick={() => updateProfile(current => ({...current, downloads: current.downloads.filter(download => download.id !== item.id)}))}><Trash2 size={19}/></button></div></div>;})}{!validDownloads.length && <div className="empty-state"><Download size={40}/><h2>Your next adventure, offline.</h2><p>Open a title and select a quality to add it to your demo queue.</p><button className="primary-button" onClick={() => nav('Discover')}>Find something to watch</button></div>}</div>}

      {page === 'Community' && !query && !profile.isKids && <div className="content browse"><span className="eyebrow">BETTER TOGETHER</span><h1>The conversation starts here.</h1><p className="muted">Open any title to share a device-local demo review.</p><Rail title="The community’s favorites" items={topTen.slice(0, 6)}/><div className="community-feature"><span>COMMUNITY COLLECTION</span><h2>Beyond the stars</h2><p>Big ideas. Uncharted worlds. A handpicked sci-fi watchlist.</p><button className="primary-button" onClick={() => {setGenre('Sci-Fi'); setPage('Discover');}}>Explore collection <ArrowRight size={16}/></button></div></div>}

      <footer><span className="footer-brand">flixora.</span><span>A whole world. One screen.</span><span>© {new Date().getFullYear()} Flixora · Full-stack demo</span></footer>
    </main>

    {profilesOpen && <div className="profile-popover" role="menu" ref={profilePopoverRef} aria-label="Choose profile"><h3>Who’s watching?</h3>{Object.values(PROFILES).map(item => <button role="menuitem" className="profile-option" aria-current={item.id === profileId ? 'true' : undefined} key={item.id} onClick={() => switchProfile(item.id)}><span className="avatar">{item.name[0]}</span><span>{item.name}<small>{item.label}</small></span>{item.id === profileId && <Check size={16}/>}</button>)}<p className="profile-warning"><LockKeyhole size={16}/> Adult profile ka demo PIN 1234 hai. Production PIN server par securely verify hoga.</p></div>}

    {pinOpen && <div className="modal-overlay" onMouseDown={event => {if (event.target === event.currentTarget) setPinOpen(false);}}><section className="detail-modal" ref={pinRef} role="dialog" aria-modal="true" aria-labelledby="pin-title" tabIndex={-1}><button className="close-detail icon-button" onClick={() => setPinOpen(false)} aria-label="Close PIN dialog"><X/></button><h2 id="pin-title">Adult profile locked</h2><p className="muted">Demo PIN <strong>1234</strong> enter karein. Yeh sirf UI demonstration hai.</p><form className="pin-form" onSubmit={unlockAdult}><label>4-digit PIN<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event => {setPin(event.target.value.replace(/\D/g, '')); setPinError('');}} autoComplete="off"/></label>{pinError && <p className="dialog-error" role="alert">{pinError}</p>}<div className="pin-actions"><button type="button" className="secondary-button" onClick={() => setPinOpen(false)}>Cancel</button><button className="primary-button" type="submit">Unlock</button></div></form></section></div>}

    {detail && <div className="modal-overlay" onMouseDown={event => {if (event.target === event.currentTarget) setDetail(null);}}><section ref={detailRef} role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1} className="detail-modal"><button className="close-detail icon-button" aria-label="Close details" onClick={() => setDetail(null)}><X/></button><div className="detail-top"><img src={detail.image} alt="" onError={imageFallback}/><div><span className="eyebrow">FLIXORA FEATURE</span><h1 id="detail-title">{detail.title}</h1><div className="detail-meta"><span className="match"><Star size={13}/> {detail.rating}</span> {detail.year} · {detail.duration} · {detail.genre} · {detail.ageRating}+</div><p>{detail.description}</p><span className="demo-badge">{detail.sources.length} demo sources · {detail.audioTracks.length} audio options · {detail.subtitleTracks.length} subtitle options</span><div className="hero-buttons"><button className="primary-button" onClick={() => {setPlayer(detail); setDetail(null);}}><Play size={17} fill="currentColor"/> Play demo</button><button className="secondary-button" onClick={() => toggleList(detail)}>{data.list.includes(detail.id) ? <Check size={17}/> : <Plus size={17}/>} My List</button></div><div className="download-select"><label htmlFor="download-quality">Offline quality</label><select id="download-quality" value={downloadQuality} onChange={event => setDownloadQuality(event.target.value)}>{['480p', '720p', '1080p', '4K'].map(quality => <option key={quality}>{quality}</option>)}</select><button className="icon-button" aria-label={`Queue ${detail.title} download`} onClick={() => queueDownload(detail)}><Download size={18}/></button></div></div></div>{!profile.isKids ? <div className="review-section"><h2>What’s your take?</h2><form onSubmit={event => {event.preventDefault(); if (!review.trim()) return; updateProfile(current => ({...current, reviews: {...current.reviews, [detail.id]: [...(current.reviews[detail.id] || []), {text: review.trim(), stars, author: profile.name, createdAt: Date.now()}]}})); setReview('');}}><div className="star-picker">{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} stars`} aria-pressed={value === stars} onClick={() => setStars(value)}><Star fill={value <= stars ? 'currentColor' : 'none'} size={20}/></button>)}</div><textarea aria-label="Your review" placeholder="Share what stayed with you…" maxLength={2000} value={review} onChange={event => setReview(event.target.value)} required/><button className="primary-button" type="submit">Post review</button></form>{(data.reviews[detail.id] || []).map((item, index) => <div className="review" key={`${item.createdAt || index}-${index}`}><strong>{item.author}</strong><span>{'★'.repeat(item.stars)}</span><p>{item.text}</p></div>)}<p className="muted">Demo reviews sirf is profile aur browser mein save hoti hain.</p></div> : <p className="profile-warning"><LockKeyhole size={16}/> Community posting Kids profile mein disabled hai.</p>}</section></div>}

    {player && <Suspense fallback={<div className="toast" role="status">Loading player…</div>}><Player movie={player} initialProgress={data.history[player.id]?.position || 0} onClose={() => setPlayer(null)} onProgress={saveProgress}/></Suspense>}
    {toast && <div role="status" className="toast"><Check size={18}/>{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
