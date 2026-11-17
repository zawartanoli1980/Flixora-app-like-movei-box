import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Film,
  Search,
  Shield,
  ArrowUpRight,
  Plus,
  Upload,
  LogOut,
  Play,
  CheckCircle2,
  AlertCircle,
  Clapperboard,
  ChevronRight,
  Library,
  Users,
  Activity,
  CreditCard,
  Settings,
  Globe,
  Clock,
  Lock,
  Bookmark,
  X,
} from "lucide-react";
import "./styles.css";
import "./platform.css";
const sections = {
  movies: "Movies",
  drama: "Drama series",
  tv: "Other TV series",
  anime: "Anime",
  cartoons: "Cartoons",
  cricket: "Cricket",
  sports: "Other sports",
  videos: "Other videos",
};
async function api(path, body, method = "POST") {
  const r = await fetch("/api/platform" + path, {
    method: body === undefined ? "GET" : method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
function App() {
  const [authMode, setAuthMode] = useState("login"),
    [emailAction, setEmailAction] = useState(() => {
      const p = new URLSearchParams(location.search);
      return p.get("token") && ["verify", "reset"].includes(p.get("action"))
        ? { action: p.get("action"), token: p.get("token") }
        : null;
    }),
    [settings, setSettings] = useState({ name: "Flixora" }),
    [legal, setLegal] = useState(null),
    [user, setUser] = useState(null),
    [status, setStatus] = useState(null),
    [page, setPage] = useState(
      location.pathname.startsWith("/admin") ? "admin" : "browse",
    ),
    [section, setSection] = useState(""),
    [q, setQ] = useState(""),
    [filters, setFilters] = useState({
      genre: "",
      language: "",
      year: "",
      country: "",
    }),
    [items, setItems] = useState([]),
    [visibleCount, setVisibleCount] = useState(48),
    [demo, setDemo] = useState({ enabled: false }),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [login, setLogin] = useState(false),
    [series, setSeries] = useState(null),
    [season, setSeason] = useState(0),
    [playlist, setPlaylist] = useState([]),
    [autoNext, setAutoNext] = useState(true),
    [speed, setSpeed] = useState(1),
    [player, setPlayer] = useState(null),
    [library, setLibrary] = useState({ watchlist: [], progress: [] }),
    [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const refresh = () => {
    setLoading(true);
    api("/catalog?" + new URLSearchParams({ ...filters, section, q }))
      .then((d) => {
        setItems(d.items);
        setDemo(d.demo || { enabled: false });
      })
      .catch((e) => {
        setItems([]);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (emailAction) history.replaceState({}, "", location.pathname);
    api("/me")
      .then((d) => setUser(d.user))
      .catch((e) => setError(e.message));
    api("/settings")
      .then(setSettings)
      .catch((e) => setError(e.message));
    api("/status")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setVisibleCount(48);
    refresh();
  }, [section, q, page, user, filters]);
  useEffect(() => {
    api("/settings")
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, [page]);
  useEffect(() => {
    if (user)
      api("/library")
        .then(setLibrary)
        .catch((e) => setError(e.message));
  }, [user]);
  const navigate = (p) => {
    setPage(p);
    history.pushState({}, "", p === "admin" ? "/admin" : "/");
  };
  const act = async (fn) => {
    try {
      setError("");
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };
  const catalogItems =
    page === "list"
      ? items.filter((item) =>
          library.watchlist.some((entry) => entry.content_id === item.id),
        )
      : items;
  const visibleItems =
    page === "browse" && demo.enabled
      ? catalogItems.slice(0, visibleCount)
      : catalogItems;
  return (
    <div className="platform">
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("browse");
          }}
        >
          <span className="brand-icon">
            <Film size={23} />
          </span>
          {settings.name.toUpperCase()}
          <span className="brand-dot">.</span>
        </a>
        <nav>
          <button
            className={page === "browse" ? "active" : ""}
            onClick={() => navigate("browse")}
          >
            Discover
          </button>
          <button
            className={page === "list" ? "active" : ""}
            onClick={() => {
              if (!user) setLogin(true);
              else navigate("list");
            }}
          >
            My list
          </button>
          <button
            className={page === "connections" ? "active" : ""}
            onClick={() => navigate("connections")}
          >
            Platform status
          </button>
        </nav>
        <div className="header-end">
          {user ? (
            <>
              <button
                className="icon-btn"
                aria-label="Account and profiles"
                onClick={() => navigate("account")}
              >
                <Users size={18} />
              </button>
              <span className="account-email">{user.email}</span>
              {user.role !== "customer" && (
                <button
                  className="icon-btn"
                  aria-label="Administration"
                  onClick={() => navigate("admin")}
                >
                  <Shield size={19} />
                </button>
              )}
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={() =>
                  act(async () => {
                    await api("/logout", {});
                    setUser(null);
                    navigate("browse");
                  })
                }
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button className="btn light" onClick={() => setLogin(true)}>
              Sign in <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </header>
      {settings.announcement && (
        <div className="notice">{settings.announcement}</div>
      )}
      {demo.enabled && (
        <div className="notice demo-notice">
          <Library size={18} />
          <div>
            <strong>Demo catalog enabled</strong>
            <span>
              {demo.titleCount} fictional titles and {demo.episodeCount} sample
              episodes. Metadata previews only; no playable movies or live
              streams are attached.
            </span>
          </div>
        </div>
      )}
      {error && !login && !player && (
        <div role="alert" className="notice error">
          <AlertCircle size={17} />
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      {page === "account" && user ? (
        <main className="page-width">
          <Account
            act={act}
            onChange={() => {
              refresh();
              api("/library")
                .then(setLibrary)
                .catch(() => setLibrary({ watchlist: [], progress: [] }));
            }}
          />
        </main>
      ) : page === "admin" ? (
        user && user.role !== "customer" ? (
          <Admin user={user} act={act} status={status} />
        ) : (
          <main className="center-state">
            <Shield size={36} />
            <h1>Administration</h1>
            <p>
              Sign in with an authorized staff account. Public accounts cannot
              access administration.
            </p>
            <button className="btn primary" onClick={() => setLogin(true)}>
              Staff sign in
            </button>
          </main>
        )
      ) : page === "connections" ? (
        <main className="page-width">
          <div className="page-heading">
            <span className="eyebrow">CONNECTED SERVICES</span>
            <h1>Built on real connections.</h1>
            <p>
              Transparent status. No simulated transactions or invented catalog.
            </p>
          </div>
          <Connections status={status} />
        </main>
      ) : (
        <>
          <main className="page-width">
            <section className="discovery-hero">
              <div className="hero-content">
                <div className="pill">
                  <span className="live-dot" /> YOUR NEXT GREAT STORY
                </div>
                <h1>
                  A world of stories.
                  <br />
                  <span>One place to watch.</span>
                </h1>
                <p>
                  Movies, series, anime and the moments that matter.
                  <br />
                  {demo.enabled
                    ? "Browse fictional previews, then connect your authorized media."
                    : "Explore content from connected, authorized sources."}
                </p>
                <button
                  className="btn primary"
                  onClick={() =>
                    document
                      .getElementById("catalog")
                      .scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Explore the library <ChevronRight size={17} />
                </button>
                <div className="hero-foot">
                  <Shield size={14} /> Authorized media. Clearly labeled access.
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="film-tile tile-one">
                  <Film size={55} />
                  <span>MOVIES & SERIES</span>
                </div>
                <div className="film-tile tile-two">
                  <Play size={43} />
                </div>
                <div className="film-tile tile-three">
                  <Globe size={33} />
                  <span>STORIES WITHOUT BORDERS</span>
                </div>
                <div className="art-caption">THE SCREEN IS YOURS.</div>
              </div>
            </section>
            <section id="catalog" className="catalog">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {page === "list" ? "SAVED FOR YOU" : "EXPLORE FLIXORA"}
                  </span>
                  <h2>
                    {page === "list" ? "My list" : "Find your next watch"}
                  </h2>
                </div>
                <span className="subtle">
                  {items.filter((i) => !i.demo).length} published{" "}
                  {items.filter((i) => !i.demo).length === 1
                    ? "title"
                    : "titles"}
                  {items.some((i) => i.demo) &&
                    ` · ${items.filter((i) => i.demo).length} demo previews`}
                </span>
              </div>
              <details className="filter-panel">
                <summary>More filters</summary>
                <div className="filter-fields">
                  {[
                    ["genre", "Genre"],
                    ["language", "Language"],
                    ["year", "Release year"],
                    ["country", "Country code"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        aria-label={label + " filter"}
                        value={filters[key]}
                        maxLength={
                          key === "year" ? 4 : key === "country" ? 2 : 50
                        }
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            [key]:
                              key === "country"
                                ? e.target.value.toUpperCase()
                                : e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="btn secondary"
                    onClick={() =>
                      setFilters({
                        genre: "",
                        language: "",
                        year: "",
                        country: "",
                      })
                    }
                  >
                    Clear filters
                  </button>
                </div>
              </details>
              <div className="catalog-tools">
                <div className="section-tabs">
                  <button
                    className={!section ? "selected" : ""}
                    onClick={() => setSection("")}
                  >
                    All content
                  </button>
                  {Object.entries(sections).map(([id, label]) => (
                    <button
                      key={id}
                      className={section === id ? "selected" : ""}
                      onClick={() => setSection(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search library"
                    placeholder="Search titles…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </label>
              </div>
              {loading ? (
                <div className="empty-state">
                  <Activity size={28} />
                  <h3>Loading the library…</h3>
                </div>
              ) : visibleItems.length ? (
                <div className="content-grid">
                  {visibleItems.map((i) => (
                    <article
                      className={`content-card ${i.demo ? "demo-card" : ""}`}
                      key={i.id}
                    >
                      {i.demo ? (
                        <DemoPoster item={i} />
                      ) : (
                        <div className="content-art">
                          <img
                            alt=""
                            src={"/api/platform/artwork/" + i.id}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <Clapperboard size={44} />
                          <span>{sections[i.section]}</span>
                        </div>
                      )}
                      <div className="card-body">
                        <span className="eyebrow">
                          {i.demo
                            ? "DEMO · METADATA ONLY"
                            : settings.mode === "premium" ||
                                (settings.mode !== "free" && i.data.premium)
                              ? "PREMIUM"
                              : "FREE"}{" "}
                          · {i.data.language}
                        </span>
                        <h3>{i.title}</h3>
                        <p>{i.data.description}</p>
                        <div className="button-row">
                          <button
                            className="btn primary"
                            onClick={() => {
                              setError("");
                              if (i.demo)
                                act(async () =>
                                  setPreview(await api("/demo/" + i.id)),
                                );
                              else if (i.data.kind === "series")
                                act(async () => {
                                  const response = await api(
                                    "/series/" + i.id + "/episodes",
                                  );
                                  setSeason(0);
                                  setSeries({ ...i, items: response.items });
                                });
                              else {
                                setPlaylist([]);
                                setPlayer(i);
                              }
                            }}
                          >
                            {i.demo ? (
                              <Library size={15} />
                            ) : (
                              <Play size={15} />
                            )}
                            {i.demo
                              ? "View demo"
                              : i.data.kind === "series"
                                ? "Episodes"
                                : "Watch"}
                          </button>
                          <button
                            className="icon-btn"
                            disabled={Boolean(i.demo)}
                            title={
                              i.demo
                                ? "Demo previews do not represent playable media and cannot be saved to My list"
                                : undefined
                            }
                            aria-label={
                              i.demo
                                ? "My list unavailable for demo previews"
                                : "Toggle My list"
                            }
                            onClick={() =>
                              user
                                ? act(async () => {
                                    await api("/library/" + i.id, {
                                      listed: !library.watchlist.some(
                                        (w) => w.content_id === i.id,
                                      ),
                                    });
                                    setLibrary(await api("/library"));
                                  })
                                : setLogin(true)
                            }
                          >
                            <Bookmark size={18} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Library size={30} />
                  </div>
                  <span className="eyebrow">
                    {q
                      ? "NO MATCHING TITLES"
                      : page === "list"
                        ? "YOUR PERSONAL COLLECTION"
                        : "A FRESH START"}
                  </span>
                  <h3>
                    {q
                      ? "No results for this search"
                      : page === "list"
                        ? "Your next watch belongs here"
                        : `The ${section ? sections[section].toLowerCase() : "library"} is taking shape`}
                  </h3>
                  <p>
                    {page === "list"
                      ? "Save published titles to find them here."
                      : "No published content is available here yet. Titles appear only after authorized media is uploaded, validated and published."}
                  </p>
                  <div className="empty-foot">
                    <CheckCircle2 size={15} />{" "}
                    {demo.enabled
                      ? "Demo previews contain metadata only."
                      : "Real content only. No demo movies."}
                  </div>
                </div>
              )}
              {!loading && visibleItems.length < catalogItems.length && (
                <div className="catalog-tools">
                  <p className="subtle">
                    Showing {visibleItems.length} of {catalogItems.length} titles
                  </p>
                  <button
                    className="btn secondary"
                    onClick={() => setVisibleCount((count) => count + 48)}
                  >
                    Load more titles
                  </button>
                </div>
              )}
            </section>
            <section className="trust-row">
              <div>
                <Shield />
                <h3>Rights come first</h3>
                <p>Only authorized, validated content is published.</p>
              </div>
              <div>
                <Library />
                <h3>A place for every story</h3>
                <p>Eight distinct libraries. Clear categories.</p>
              </div>
              <div>
                <Lock />
                <h3>Access you can trust</h3>
                <p>Playback rights are checked on the server.</p>
              </div>
            </section>
          </main>
        </>
      )}
      <footer>
        <a className="brand small" href="/">
          FLIXORA<span className="brand-dot">.</span>
        </a>
        <p>Stories worth your time.</p>
        <button
          className="footer-link"
          onClick={() =>
            setLegal({ title: "Privacy policy", body: settings.privacy })
          }
        >
          Privacy
        </button>
        <button
          className="footer-link"
          onClick={() => setLegal({ title: "Terms", body: settings.terms })}
        >
          Terms
        </button>
        <button
          className="footer-link"
          onClick={() =>
            setLegal({
              title: "Contact",
              body:
                settings.contact || "Contact details have not been configured.",
            })
          }
        >
          Contact
        </button>
        <span>
          © {new Date().getFullYear()} {settings.name}
        </span>
      </footer>
      {emailAction && (
        <div className="modal-overlay">
          <section className="dialog">
            <button
              className="close icon-btn"
              aria-label="Close email action"
              onClick={() => setEmailAction(null)}
            >
              <X />
            </button>
            <h2>
              {emailAction.action === "verify"
                ? "Verify your email"
                : "Choose a new password"}
            </h2>
            {error && (
              <p role="alert" className="player-error">
                {error}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                act(async () => {
                  const r = await api(
                    emailAction.action === "verify"
                      ? "/email/verify"
                      : "/password/reset",
                    {
                      token: emailAction.token,
                      ...(emailAction.action === "reset"
                        ? { password: d.get("password") }
                        : {}),
                    },
                  );
                  setEmailAction(null);
                  setLegal({ title: "Account updated", body: r.message });
                });
              }}
            >
              {emailAction.action === "reset" && (
                <label>
                  New password
                  <input
                    type="password"
                    name="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                  />
                </label>
              )}
              <button className="btn primary">
                {emailAction.action === "verify"
                  ? "Verify email"
                  : "Reset password"}
              </button>
            </form>
          </section>
        </div>
      )}
      {legal && (
        <div className="modal-overlay">
          <section className="dialog">
            <button
              className="close icon-btn"
              aria-label="Close information"
              onClick={() => setLegal(null)}
            >
              <X />
            </button>
            <h2>{legal.title}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{legal.body}</p>
          </section>
        </div>
      )}
      {login && (
        <div className="modal-overlay">
          <section className="dialog">
            <button
              className="close icon-btn"
              aria-label="Close sign in"
              onClick={() => setLogin(false)}
            >
              <X />
            </button>
            <span className="eyebrow">WELCOME TO FLIXORA</span>
            <h2>
              {authMode === "register"
                ? "Create your account."
                : authMode === "reset"
                  ? "Reset your password."
                  : authMode === "verify"
                    ? "Verify your email."
                    : "Your stories start here."}
            </h2>
            <p>Sign in to save your list and synchronize progress.</p>
            <button
              className="btn google"
              onClick={() =>
                status?.integrations.google.status === "Setup required"
                  ? setError(status.integrations.google.detail)
                  : location.assign("/api/platform/auth/google")
              }
            >
              Continue with Google
            </button>
            <small>
              {status?.integrations.google.detail ||
                "Checking Google connection…"}
            </small>
            {error && (
              <p role="alert" className="player-error">
                {error}
              </p>
            )}
            <div className="divider">or sign in with email</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                act(async () => {
                  if (authMode === "login") {
                    const r = await api("/login", Object.fromEntries(d));
                    setUser(r.user);
                    setLogin(false);
                  } else {
                    const r = await api(
                      authMode === "register"
                        ? "/register"
                        : authMode === "reset"
                          ? "/password/request"
                          : "/verification/request",
                      Object.fromEntries(d),
                    );
                    setLegal({ title: "Check your email", body: r.message });
                    setLogin(false);
                  }
                });
              }}
            >
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="username"
                />
              </label>
              {["login", "register"].includes(authMode) && (
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={authMode === "register" ? 12 : 1}
                    autoComplete={
                      authMode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                  />
                </label>
              )}
              <button className="btn primary full">
                {authMode === "register"
                  ? "Create account"
                  : authMode === "reset"
                    ? "Send reset link"
                    : authMode === "verify"
                      ? "Resend verification"
                      : "Sign in"}
              </button>
            </form>
            <div className="button-row">
              {[
                ["login", "Sign in"],
                ["register", "Register"],
                ["reset", "Forgot password?"],
                ["verify", "Resend verification"],
              ]
                .filter(([mode]) => mode !== authMode)
                .map(([mode, label]) => (
                  <button
                    key={mode}
                    className="footer-link"
                    onClick={() => {
                      setError("");
                      setAuthMode(mode);
                    }}
                  >
                    {label}
                  </button>
                ))}
            </div>
            <small>{status?.integrations.email.detail}</small>
          </section>
        </div>
      )}
      {preview && (
        <DemoPreview preview={preview} onClose={() => setPreview(null)} />
      )}
      {series && (
        <div className="modal-overlay">
          <section className="dialog wide">
            <button
              className="close icon-btn"
              aria-label="Close series"
              onClick={() => setSeries(null)}
            >
              <X />
            </button>
            <span className="eyebrow">{sections[series.section]} · SERIES</span>
            <h2>{series.title}</h2>
            <p>{series.data.description}</p>
            <label className="subtle">
              Season{" "}
              <select
                className="episode-select"
                value={season}
                onChange={(e) => setSeason(Number(e.target.value))}
              >
                <option value="0">All seasons</option>
                {[...new Set(series.items.map((i) => i.data.season))].map(
                  (s) => (
                    <option key={s} value={s}>
                      Season {s}
                    </option>
                  ),
                )}
              </select>
            </label>
            {series.items.length ? (
              series.items
                .filter((i) => !season || i.data.season === season)
                .map((i) => (
                  <div className="job-row" key={i.id}>
                    <div>
                      <strong>{i.title}</strong>
                      <p>
                        Season {i.data.season} · Episode {i.data.episode}
                      </p>
                    </div>
                    <button
                      className="btn primary"
                      onClick={() => {
                        setPlaylist(series.items);
                        setPlayer(i);
                        setSeries(null);
                        setError("");
                      }}
                    >
                      <Play size={15} />
                      Play episode
                    </button>
                  </div>
                ))
            ) : (
              <p>No published episodes are available yet.</p>
            )}
          </section>
        </div>
      )}
      {player && (
        <div className="modal-overlay">
          <section className="dialog wide">
            <button
              className="close icon-btn"
              aria-label="Close player"
              onClick={() => {
                setPlayer(null);
                if (user)
                  api("/library")
                    .then(setLibrary)
                    .catch(() => {});
              }}
            >
              <X />
            </button>
            <span className="eyebrow">{sections[player.section]}</span>
            <h2>{player.title}</h2>
            <video
              key={player.id}
              ref={videoRef}
              onEnded={() => {
                const next =
                  playlist[playlist.findIndex((i) => i.id === player.id) + 1];
                if (autoNext && next) setPlayer(next);
              }}
              controls
              autoPlay
              playsInline
              src={"/api/platform/media/" + player.id}
              onLoadedMetadata={(e) => {
                e.currentTarget.playbackRate = speed;
                const saved = library.progress.find(
                  (p) => p.content_id === player.id,
                );
                if (saved) e.currentTarget.currentTime = saved.position;
              }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (
                  user &&
                  Math.floor(v.currentTime) % 10 === 0 &&
                  v.currentTime - (v._lastSync || -11) >= 9
                ) {
                  v._lastSync = v.currentTime;
                  api("/library/" + player.id, {
                    position: v.currentTime,
                  }).catch(() => {});
                }
              }}
              onError={() =>
                setError(
                  "Playback unavailable. Check your subscription, regional rights, and media availability.",
                )
              }
            />
            <div className="button-row">
              <label className="subtle">
                Playback speed{" "}
                <select
                  className="episode-select"
                  value={speed}
                  onChange={(e) => {
                    setSpeed(Number(e.target.value));
                    if (videoRef.current)
                      videoRef.current.playbackRate = Number(e.target.value);
                  }}
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
              </label>
              {document.pictureInPictureEnabled && (
                <button
                  className="btn secondary"
                  onClick={() =>
                    act(() => videoRef.current.requestPictureInPicture())
                  }
                >
                  Picture in picture
                </button>
              )}
              {playlist.length > 0 && (
                <label className="subtle">
                  <input
                    type="checkbox"
                    checked={autoNext}
                    onChange={(e) => setAutoNext(e.target.checked)}
                  />{" "}
                  Autoplay next episode
                </label>
              )}
            </div>
            {error && (
              <p role="alert" className="player-error">
                {error}
              </p>
            )}
            <p>{player.data.description}</p>
            <small>
              Quality, subtitles and audio depend on the uploaded file.
              Downloads and casting are not enabled.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
function Connections({ status }) {
  return (
    <div className="integration-grid">
      {Object.entries(status?.integrations || {}).map(([name, value]) => (
        <article className="integration" key={name}>
          <div className="integration-top">
            <Globe size={21} />
            <span className="status-badge">{value.status}</span>
          </div>
          <h3>
            {name === "cards"
              ? "Cards & subscriptions"
              : name[0].toUpperCase() + name.slice(1)}
          </h3>
          <p>{value.detail}</p>
        </article>
      ))}
    </div>
  );
}
function Admin({ user, act, status }) {
  const [editing, setEditing] = useState(null),
    [tab, setTab] = useState("overview"),
    [data, setData] = useState(null),
    [loadError, setLoadError] = useState(""),
    [uploading, setUploading] = useState(""),
    [refresh, setRefresh] = useState(0);
  const capabilities = {
    owner: [
      "overview",
      "content",
      "jobs",
      "sources",
      "imports",
      "users",
      "grants",
      "demo",
      "settings",
      "audit",
      "connections",
    ],
    administrator: [
      "overview",
      "content",
      "jobs",
      "sources",
      "imports",
      "users",
      "connections",
    ],
    content_manager: [
      "overview",
      "content",
      "jobs",
      "sources",
      "imports",
      "connections",
    ],
    finance: ["grants", "connections"],
    support: ["connections"],
  };
  const tabs = capabilities[user.role] || ["connections"];
  useEffect(() => {
    const effective = tabs.includes(tab) ? tab : tabs[0];
    if (effective !== tab) {
      setTab(effective);
      return;
    }
    if (tab === "connections") {
      setData(null);
      return;
    }
    let active = true;
    const load = () =>
      api("/admin/" + tab)
        .then((d) => {
          if (active) setData(d);
        })
        .catch((error) => {
          if (active) {
            setData(null);
            setLoadError(error.message);
          }
        });
    setLoadError("");
    setData(null);
    load();
    const t = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [tab, refresh]);
  const upload = async (item, file) => {
    if (!file) return;
    setUploading("Preparing upload…");
    try {
      const pending = await api("/admin/uploads");
      let u = pending.items.find((x) => x.content_id === item.id);
      if (u && u.size !== file.size)
        throw Error("Select the same file to resume the existing upload");
      if (!u)
        u = await api("/admin/content/" + item.id + "/upload", {
          size: file.size,
          extension: file.name.split(".").pop().toLowerCase(),
        });
      let offset = u.offset;
      while (offset < file.size) {
        const r = await fetch("/api/platform/admin/uploads/" + u.id, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
            "Upload-Offset": String(offset),
          },
          body: file.slice(offset, offset + 4 * 1024 ** 2),
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        offset = d.offset;
        setUploading(`Uploading ${Math.round((offset / file.size) * 100)}%`);
      }
      await api("/admin/uploads/" + u.id + "/complete", {});
      setRefresh((x) => x + 1);
    } finally {
      setUploading("");
    }
  };
  return (
    <main className="admin-layout">
      <aside>
        <span className="eyebrow">WORKSPACE</span>
        <h2>Control room</h2>
        <div className="role-badge">
          <Shield size={14} />
          {user.role.replaceAll("_", " ")}
        </div>
        <nav>
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => {
                setData(null);
                setTab(t);
              }}
            >
              {
                {
                  overview: <Activity size={17} />,
                  content: <Library size={17} />,
                  jobs: <Clock size={17} />,
                  users: <Users size={17} />,
                  grants: <CreditCard size={17} />,
                  audit: <Shield size={17} />,
                  connections: <Settings size={17} />,
                  demo: <Library size={17} />,
                }[t]
              }
              {t === "demo"
                ? "Demo catalog"
                : t === "grants"
                  ? "Complimentary access"
                  : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <div className="admin-note">
          <Lock size={17} />
          <p>
            Permissions are enforced by the API. Sensitive changes are audited.
          </p>
        </div>
      </aside>
      <div className="admin-main">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FLIXORA ADMINISTRATION</span>
            <h1>
              {tab === "demo"
                ? "Demo catalog"
                : tab === "overview"
                  ? "Your platform, at a glance."
                  : tab === "content"
                    ? "Content library"
                    : tab === "grants"
                      ? "Complimentary access"
                      : tab[0].toUpperCase() + tab.slice(1)}
            </h1>
          </div>
          <span className="status-badge">
            {tab === "demo" ? "Fictional previews" : "Live data"}
          </span>
        </div>
        {tab === "connections" ? (
          <Connections status={status} />
        ) : !data ? (
          <p className="subtle" role={loadError ? "alert" : undefined}>
            {loadError || "Loading authorized workspace…"}
          </p>
        ) : tab === "demo" ? (
          <DemoPanel
            data={data}
            act={act}
            refresh={() => setRefresh((x) => x + 1)}
          />
        ) : tab === "overview" ? (
          <>
            <div className="stat-grid">
              <Stat title="User accounts" value={data.users} />
              <Stat
                title="Published titles"
                value={
                  data.content.find((s) => s.state === "published")?.count || 0
                }
              />
              <Stat
                title="Awaiting review"
                value={
                  data.content.find((s) => s.state === "review")?.count || 0
                }
              />
              <Stat
                title="Failed jobs"
                value={data.jobs.find((s) => s.state === "failed")?.count || 0}
              />
            </div>
            <section className="panel">
              <h3>Library coverage</h3>
              <p className="subtle">
                Actual published records by primary section.
              </p>
              {Object.entries(sections).map(([id, label]) => (
                <div className="table-row" key={id}>
                  <span>{label}</span>
                  <strong>
                    {data.coverage.find((c) => c.section === id)?.count || 0}
                  </strong>
                </div>
              ))}
            </section>
            <section className="panel">
              <h3>Monetization</h3>
              <p className="subtle">
                Revenue and paid subscriptions are unavailable until a verified
                payment adapter is connected. No transactions are simulated.
              </p>
            </section>
          </>
        ) : tab === "content" ? (
          <>
            {editing && (
              <div className="modal-overlay">
                <section className="dialog wide">
                  <button
                    className="close icon-btn"
                    aria-label="Close editor"
                    onClick={() => setEditing(null)}
                  >
                    <X />
                  </button>
                  <h2>Edit content</h2>
                  <ContentForm
                    initial={editing}
                    onSave={(v) =>
                      act(async () => {
                        await api("/admin/content/" + editing.id, v, "PUT");
                        setEditing(null);
                        setRefresh((x) => x + 1);
                      })
                    }
                  />
                </section>
              </div>
            )}
            <ContentForm
              onSave={(v) =>
                act(async () => {
                  await api("/admin/content", v);
                  setRefresh((x) => x + 1);
                })
              }
            />
            {uploading && (
              <div className="notice">
                {uploading} · Keep this page open. An interrupted upload can
                resume by selecting the same file.
              </div>
            )}
            <div className="record-list">
              {data.items.length ? (
                data.items.map((i) => (
                  <article className="panel" key={i.id}>
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          {sections[i.section]} · {i.data.kind}
                        </span>
                        <h3>{i.title}</h3>
                      </div>
                      <span className="status-badge">{i.state}</span>
                    </div>
                    <p>{i.data.description}</p>
                    <small>
                      Rights end {new Date(i.data.rightsEnd).toLocaleString()} ·{" "}
                      {i.validated ? "Media validated" : "Validation required"}{" "}
                      · {i.data.premium ? "Premium" : "Free"}
                    </small>
                    <div className="button-row">
                      {i.state !== "processing" && (
                        <button
                          className="btn secondary"
                          onClick={() => setEditing(i)}
                        >
                          Edit metadata
                        </button>
                      )}
                      {!["published", "processing"].includes(i.state) &&
                        !["series", "live-event"].includes(i.data.kind) && (
                          <label className="btn secondary">
                            <Upload size={15} />
                            Upload / resume
                            <input
                              hidden
                              type="file"
                              accept="video/mp4,video/webm"
                              disabled={Boolean(uploading)}
                              onChange={(e) =>
                                act(() => upload(i, e.target.files[0]))
                              }
                            />
                          </label>
                        )}
                      {(i.state === "review" ||
                        (i.data.kind === "series" && i.state === "draft")) && (
                        <button
                          className="btn primary"
                          onClick={() =>
                            act(async () => {
                              await api("/admin/content/" + i.id + "/state", {
                                state: "published",
                              });
                              setRefresh((x) => x + 1);
                            })
                          }
                        >
                          Publish
                        </button>
                      )}
                      {i.state === "published" && (
                        <button
                          className="btn secondary"
                          onClick={() =>
                            act(async () => {
                              await api("/admin/content/" + i.id + "/state", {
                                state: "archived",
                              });
                              setRefresh((x) => x + 1);
                            })
                          }
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="panel subtle">
                  No content records. Create a draft above, then upload your
                  authorized media.
                </div>
              )}
            </div>
          </>
        ) : tab === "sources" ? (
          <Sources
            data={data}
            act={act}
            refresh={() => setRefresh((x) => x + 1)}
          />
        ) : tab === "imports" ? (
          <Imports
            data={data}
            act={act}
            refresh={() => setRefresh((x) => x + 1)}
          />
        ) : tab === "settings" ? (
          <PlatformSettings
            data={data}
            act={act}
            refresh={() => setRefresh((x) => x + 1)}
          />
        ) : tab === "jobs" ? (
          <section className="panel">
            <p className="subtle">
              Durable queue · ffprobe inspection and representative ffmpeg
              decode · interrupted processing resumes on restart.
            </p>
            {data.items.length ? (
              data.items.map((j) => (
                <div className="job-row" key={j.id}>
                  <div>
                    <code>{j.id.slice(0, 8)}</code>
                    <p>
                      {j.state} · {j.attempts} attempts
                    </p>
                    <small>{j.error || "No processing errors recorded"}</small>
                  </div>
                  {["failed", "queued", "running"].includes(j.state) && (
                    <button
                      className="btn secondary"
                      onClick={() =>
                        act(async () => {
                          await api("/admin/jobs/" + j.id, {
                            action: j.state === "failed" ? "retry" : "cancel",
                          });
                          setRefresh((x) => x + 1);
                        })
                      }
                    >
                      {j.state === "failed" ? "Retry" : "Cancel"}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p>No processing jobs yet.</p>
            )}
          </section>
        ) : tab === "users" ? (
          <>
            <UserForm
              act={act}
              refresh={() => setRefresh((x) => x + 1)}
              owner={user.role === "owner"}
            />
            <section className="panel">
              {data.items.map((u) => (
                <div className="job-row" key={u.id}>
                  <div>
                    <strong>{u.email}</strong>
                    <p>
                      {u.role} · {u.suspended ? "Suspended" : "Active"}
                    </p>
                  </div>
                  {u.role !== "owner" && !u.suspended && (
                    <button
                      className="btn secondary"
                      onClick={() =>
                        act(async () => {
                          await api("/admin/users/" + u.id + "/suspend", {});
                          setRefresh((x) => x + 1);
                        })
                      }
                    >
                      Suspend & revoke sessions
                    </button>
                  )}
                </div>
              ))}
            </section>
          </>
        ) : tab === "grants" ? (
          <>
            <form
              className="panel form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                act(async () => {
                  await api("/admin/grants", {
                    userId: d.get("userId"),
                    expires: new Date(d.get("expires")).toISOString(),
                  });
                  setRefresh((x) => x + 1);
                });
              }}
            >
              <h3 className="full-span">Grant time-limited access</h3>
              <label>
                Customer user ID
                <input name="userId" required />
              </label>
              <label>
                Expires at (your local time)
                <input name="expires" type="datetime-local" required />
              </label>
              <button className="btn primary">
                Grant complimentary access
              </button>
              <p className="subtle">
                This is an audited complimentary grant, not a payment or
                subscription.
              </p>
            </form>
            <section className="panel">
              {data.items.map((g) => (
                <div className="job-row" key={g.id}>
                  <div>
                    {g.email}
                    <p>
                      {g.revoked
                        ? "Revoked"
                        : new Date(g.expires).toLocaleString()}
                    </p>
                  </div>
                  {!g.revoked && (
                    <button
                      className="btn secondary"
                      onClick={() =>
                        act(async () => {
                          await api("/admin/grants/" + g.id + "/revoke", {});
                          setRefresh((x) => x + 1);
                        })
                      }
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="panel">
            {data.items.length ? (
              data.items.map((a) => (
                <div className="table-row" key={a.id}>
                  <div>
                    <strong>{a.action}</strong>
                    <p className="subtle">{a.target}</p>
                  </div>
                  <small>{new Date(a.created).toLocaleString()}</small>
                </div>
              ))
            ) : (
              <p>No audit events.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
function Stat({ title, value }) {
  return (
    <article className="stat">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>From platform records</small>
    </article>
  );
}
function ContentForm({ onSave, initial }) {
  const v = initial?.data || {};
  const localTime = (value) =>
    value
      ? new Date(
          Date.parse(value) - new Date(value).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <details open={Boolean(initial)} className="panel">
      <summary>
        <Plus size={18} />
        Create content draft
      </summary>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          onSave({
            ...Object.fromEntries(
              Object.entries(v).filter(
                ([key]) =>
                  !["parentId", "season", "episode", "releaseDate"].includes(
                    key,
                  ),
              ),
            ),
            title: d.get("title"),
            description: d.get("description"),
            section: d.get("section"),
            kind: d.get("kind"),
            language: d.get("language"),
            ageRating: Number(d.get("ageRating")),
            genres: String(d.get("genres") || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            countries: String(d.get("countries") || "")
              .split(",")
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean),
            cast: String(d.get("cast") || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            directors: String(d.get("directors") || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            ...(d.get("releaseDate")
              ? { releaseDate: d.get("releaseDate") }
              : {}),
            license: d.get("license"),
            rightsStart: new Date(d.get("rightsStart")).toISOString(),
            rightsEnd: new Date(d.get("rightsEnd")).toISOString(),
            authorized: d.get("authorized") === "on",
            premium: d.get("premium") === "on",
            regions: d
              .get("regions")
              .split(",")
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean),
            ...(d.get("kind") === "episode" && d.get("parentId")
              ? {
                  parentId: d.get("parentId"),
                  season: Number(d.get("season")),
                  episode: Number(d.get("episode")),
                }
              : {}),
          });
        }}
      >
        <label>
          Title
          <input name="title" defaultValue={v.title} required maxLength={200} />
        </label>
        <label>
          Primary section
          <select name="section" defaultValue={v.section}>
            {Object.entries(sections).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Content type
          <select name="kind" defaultValue={v.kind}>
            {[
              "movie",
              "series",
              "episode",
              "live-event",
              "highlight",
              "replay",
              "video",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Language
          <input
            name="language"
            defaultValue={v.language}
            required
            minLength={2}
          />
        </label>
        <label>
          Age rating
          <input
            name="ageRating"
            type="number"
            min="0"
            max="18"
            defaultValue={v.ageRating ?? 18}
            required
          />
        </label>
        <label>
          Release date
          <input name="releaseDate" type="date" defaultValue={v.releaseDate} />
        </label>
        {[
          ["genres", "Genres"],
          ["countries", "Country codes"],
          ["cast", "Cast"],
          ["directors", "Directors"],
        ].map(([key, label]) => (
          <label key={key}>
            {label} (comma separated)
            <input name={key} defaultValue={v[key]?.join(", ")} />
          </label>
        ))}
        <label className="full-span">
          Description
          <textarea
            name="description"
            defaultValue={v.description}
            required
            maxLength={5000}
          />
        </label>
        <label className="full-span">
          Authorization / license reference
          <textarea
            name="license"
            defaultValue={v.license}
            required
            minLength={5}
          />
        </label>
        <label>
          Rights start
          <input
            name="rightsStart"
            defaultValue={localTime(v.rightsStart)}
            type="datetime-local"
            required
          />
        </label>
        <label>
          Rights end
          <input
            name="rightsEnd"
            defaultValue={localTime(v.rightsEnd)}
            type="datetime-local"
            required
          />
        </label>
        <label>
          Allowed region codes (blank = worldwide)
          <input
            name="regions"
            defaultValue={v.regions?.join(", ")}
            placeholder="PK, US"
          />
        </label>
        <label>
          Parent series ID (episodes only)
          <input name="parentId" defaultValue={v.parentId} />
        </label>
        <label>
          Season number
          <input name="season" defaultValue={v.season} type="number" min="1" />
        </label>
        <label>
          Episode number
          <input
            name="episode"
            defaultValue={v.episode}
            type="number"
            min="1"
          />
        </label>
        <label className="checkbox">
          <input
            name="authorized"
            defaultChecked={v.authorized}
            type="checkbox"
            required
          />
          I have rights to distribute this content.
        </label>
        <label className="checkbox">
          <input name="premium" defaultChecked={v.premium} type="checkbox" />
          Premium access required
        </label>
        <button className="btn primary">
          {initial ? "Save and return to review" : "Create draft"}{" "}
          <ArrowUpRight size={15} />
        </button>
        <small>
          Series containers publish as episode collections, never as playable
          videos. Editing a series category also returns its episodes to review.
          Live delivery and scheduled publishing are not configured.
        </small>
      </form>
    </details>
  );
}
function UserForm({ act, refresh, owner }) {
  if (!owner) return null;
  return (
    <details className="panel">
      <summary>
        <Plus size={18} />
        Provision account
      </summary>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          act(async () => {
            await api("/admin/users", Object.fromEntries(d));
            e.target.reset();
            refresh();
          });
        }}
      >
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Temporary password
          <input
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </label>
        <label>
          Role
          <select name="role">
            {[
              "customer",
              "administrator",
              "content_manager",
              "finance",
              "support",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button className="btn primary">Create account</button>
      </form>
    </details>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
function Sources({ data, act, refresh }) {
  return (
    <>
      <section className="panel">
        <h3>Authorized storage connector</h3>
        <p>
          Imports read catalog.json from a server-approved private mount. URLs,
          consumer streaming subscriptions and protected streams are not
          accepted. Distributor APIs require a separately implemented authorized
          adapter.
        </p>
        <p>
          {data.configured
            ? "Storage mount configured. Verify license references in each manifest item."
            : "Setup required: mount your authorized storage and set AUTHORIZED_IMPORT_ROOT."}
        </p>
      </section>
      <form
        className="panel form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          act(async () => {
            await api("/admin/sources", {
              name: d.get("name"),
              section: d.get("section") || null,
              authorized: d.get("authorized") === "on",
            });
            refresh();
          });
        }}
      >
        <label>
          Source name
          <input name="name" required />
        </label>
        <label>
          Explicit category override
          <select name="section">
            <option value="">
              Use manifest classification; review ambiguous entries
            </option>
            {Object.entries(sections).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input name="authorized" type="checkbox" required />I am authorized to
          import and distribute this source.
        </label>
        <button className="btn primary">Connect storage source</button>
      </form>
      {data.items.map((s) => (
        <section className="panel" key={s.id}>
          <h3>{s.name}</h3>
          <p>
            {s.section
              ? sections[s.section]
              : "Manifest categories with ambiguity review"}{" "}
            · Automatic checks:{" "}
            {s.intervalMinutes ? `every ${s.intervalMinutes} minutes` : "off"}
          </p>
          <div className="button-row">
            <button
              className="btn primary"
              onClick={() =>
                act(async () => {
                  await api("/admin/sources/" + s.id + "/import", {});
                  refresh();
                })
              }
            >
              Import now
            </button>
            <button
              className="btn secondary"
              onClick={() =>
                act(async () => {
                  await api("/admin/sources/" + s.id + "/schedule", {
                    intervalMinutes: s.intervalMinutes ? 0 : 60,
                  });
                  refresh();
                })
              }
            >
              {s.intervalMinutes ? "Disable schedule" : "Check hourly"}
            </button>
          </div>
        </section>
      ))}
    </>
  );
}
function Imports({ data, act, refresh }) {
  return (
    <>
      <section className="panel">
        <h3>Import runs</h3>
        <p>
          Checkpointed storage imports. Metadata-only records remain drafts.
          Uploaded media must pass processing and review before publication.
        </p>
        {!data.items.length && <p>No imports have run.</p>}
        {data.items.map((r) => (
          <div className="job-row" key={r.id}>
            <div>
              <code>{r.id.slice(0, 8)}</code>
              <p>
                {r.state} · {r.cursor} scanned · {r.imported} imported ·{" "}
                {r.duplicates} duplicates · {r.review} for review
              </p>
              {JSON.parse(r.errors).map((e, n) => (
                <small key={n} style={{ display: "block" }}>
                  Entry {e.index ?? "—"}: {e.error}
                </small>
              ))}
            </div>
            {["queued", "running", "failed", "canceled"].includes(r.state) && (
              <button
                className="btn secondary"
                onClick={() =>
                  act(async () => {
                    await api("/admin/imports/" + r.id, {
                      action: ["failed", "canceled"].includes(r.state)
                        ? "resume"
                        : "cancel",
                    });
                    refresh();
                  })
                }
              >
                {["failed", "canceled"].includes(r.state) ? "Resume" : "Cancel"}
              </button>
            )}
          </div>
        ))}
      </section>
      <section className="panel">
        <h3>Classification review</h3>
        {!data.review.length && (
          <p>No ambiguous imports awaiting classification.</p>
        )}
        {data.review.map((r) => (
          <form
            className="job-row"
            key={r.id}
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              act(async () => {
                await api("/admin/import-review/" + r.id, {
                  section: d.get("section"),
                });
                refresh();
              });
            }}
          >
            <div>
              <strong>{r.data.metadata?.title || "Unclassified entry"}</strong>
              <p>{r.reason}</p>
            </div>
            <label>
              Primary section
              <select name="section">
                {Object.entries(sections).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn primary">Create reviewed draft</button>
          </form>
        ))}
      </section>
    </>
  );
}
function PlatformSettings({ data, act, refresh }) {
  const s = data.settings;
  return (
    <>
      <form
        className="panel form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          act(async () => {
            await api("/admin/settings", {
              name: d.get("name"),
              mode: d.get("mode"),
              maintenance: d.get("maintenance") === "on",
              announcement: d.get("announcement"),
              contact: d.get("contact"),
              privacy: d.get("privacy"),
              terms: d.get("terms"),
            });
            refresh();
          });
        }}
      >
        <h3 className="full-span">Platform settings</h3>
        <label>
          Brand name
          <input name="name" defaultValue={s.name} required maxLength={40} />
        </label>
        <label>
          Access mode
          <select name="mode" defaultValue={s.mode}>
            <option value="free">Entirely free</option>
            <option value="mixed">Mixed: per-title access</option>
            <option value="premium">Entirely premium</option>
          </select>
        </label>
        <label className="full-span">
          Announcement
          <textarea name="announcement" defaultValue={s.announcement} />
        </label>
        <label>
          Contact
          <input name="contact" defaultValue={s.contact} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="maintenance"
            defaultChecked={s.maintenance}
          />
          Maintenance mode: deny public browsing and playback
        </label>
        <label>
          Privacy policy
          <textarea name="privacy" defaultValue={s.privacy} />
        </label>
        <label>
          Terms
          <textarea name="terms" defaultValue={s.terms} />
        </label>
        <button className="btn primary">Save platform settings</button>
        <small>
          Free mode grants free playback immediately. Premium mode requires a
          current grant. Billing agreements are not created or modified.
        </small>
      </form>
      <form
        className="panel form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          act(async () => {
            await api("/admin/plans", {
              name: d.get("name"),
              amountMinor: Number(d.get("amountMinor")),
              currency: d.get("currency"),
              days: Number(d.get("days")),
              quality: d.get("quality"),
              devices: Number(d.get("devices")),
              streams: Number(d.get("streams")),
              enabled: true,
            });
            e.target.reset();
            refresh();
          });
        }}
      >
        <h3 className="full-span">Create a prepaid plan definition</h3>
        <p className="full-span subtle">
          Checkout remains disabled. Quality and device limits are plan
          definitions awaiting provider and stream-session enforcement. Plans
          cannot be sold yet. Existing definitions are immutable; create a new
          plan when prices change.
        </p>
        <label>
          Plan name
          <input name="name" required />
        </label>
        <label>
          Price in minor currency units
          <input type="number" name="amountMinor" min="0" required />
        </label>
        <label>
          ISO currency
          <input
            name="currency"
            pattern="[A-Z]{3}"
            required
            placeholder="PKR"
          />
        </label>
        <label>
          Prepaid days
          <input type="number" name="days" min="1" max="366" required />
        </label>
        <label>
          Maximum quality
          <select name="quality">
            {["source", "720p", "1080p", "4k"].map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </label>
        <label>
          Devices
          <input name="devices" type="number" min="1" max="20" required />
        </label>
        <label>
          Concurrent streams
          <input name="streams" type="number" min="1" max="10" required />
        </label>
        <button className="btn primary">Save plan definition</button>
      </form>
      <section className="panel">
        {data.plans.length ? (
          data.plans.map((p) => (
            <div className="job-row" key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <p>
                  {p.amountMinor} minor units {p.currency} · {p.days} prepaid
                  days · {p.enabled ? "Listed" : "Disabled"}
                </p>
              </div>
              {p.enabled && (
                <button
                  className="btn secondary"
                  onClick={() =>
                    act(async () => {
                      await api("/admin/plans/" + p.id + "/disable", {});
                      refresh();
                    })
                  }
                >
                  Disable listing
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No plan definitions configured.</p>
        )}
      </section>
    </>
  );
}
function Account({ act, onChange }) {
  const [profiles, setProfiles] = useState(null),
    [sessions, setSessions] = useState([]);
  const load = () => {
    api("/profiles").then(setProfiles);
    api("/sessions").then((d) => setSessions(d.items));
  };
  useEffect(load, []);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">YOUR FLIXORA</span>
        <h1>Make yourself at home.</h1>
        <p>
          Manage viewing profiles and active sessions. Billing is unavailable
          until a payment service is connected.
        </p>
      </div>
      <div className="integration-grid">
        {profiles?.items.map((p) => (
          <section className="panel" key={p.id}>
            <div className="integration-top">
              <Users size={22} />
              <span className="status-badge">
                {profiles.active?.id === p.id
                  ? "Active"
                  : p.kids
                    ? "Kids"
                    : "Standard"}
              </span>
            </div>
            <h3 style={{ marginTop: 20 }}>{p.name}</h3>
            <p>
              Maximum age rating {p.max_age} ·{" "}
              {p.protected ? "PIN protected" : "No PIN set"}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                act(async () => {
                  await api(
                    "/profiles/" + p.id + "/select",
                    p.protected ? { pin: d.get("pin") } : {},
                  );
                  load();
                  onChange();
                });
              }}
            >
              {p.protected && (
                <label>
                  Profile PIN
                  <input
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    required
                  />
                </label>
              )}
              <button className="btn secondary">Select profile</button>
            </form>
            <details style={{ marginTop: 20 }}>
              <summary>
                <Lock size={14} />
                Set parental PIN
              </summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  act(async () => {
                    await api(
                      "/profiles/" + p.id + "/pin",
                      Object.fromEntries(d),
                    );
                    e.target.reset();
                    load();
                  });
                }}
              >
                <label>
                  Account password
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </label>
                <label>
                  New PIN
                  <input
                    name="pin"
                    type="password"
                    pattern="[0-9]{4,8}"
                    inputMode="numeric"
                    required
                  />
                </label>
                <button className="btn secondary">Set PIN</button>
              </form>
            </details>
          </section>
        ))}
      </div>
      <details className="panel">
        <summary>
          <Plus size={16} />
          Create viewing profile
        </summary>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            act(async () => {
              await api("/profiles", {
                name: d.get("name"),
                kids: d.get("kids") === "on",
                maxAge: Number(d.get("maxAge")),
                password: d.get("password"),
                ...(d.get("pin") ? { pin: d.get("pin") } : {}),
              });
              e.target.reset();
              load();
            });
          }}
        >
          <label>
            Profile name
            <input name="name" required maxLength={40} />
          </label>
          <label>
            Maximum age rating
            <input
              name="maxAge"
              type="number"
              min="0"
              max="18"
              defaultValue="12"
              required
            />
          </label>
          <label>
            Optional profile PIN
            <input
              name="pin"
              type="password"
              pattern="[0-9]{4,8}"
              inputMode="numeric"
            />
          </label>
          <label>
            Account password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label className="checkbox">
            <input name="kids" type="checkbox" />
            Kids profile (maximum age 12)
          </label>
          <button className="btn primary">Create profile</button>
          <small>
            Protect every adult profile with a PIN to prevent unrestricted
            profile switching. Google-only accounts need a password-management
            integration before using parental account controls.
          </small>
        </form>
      </details>
      <section className="panel">
        <h3>Active sessions</h3>
        <p>
          These are authenticated sessions. Browser/device fingerprints are
          deliberately not collected.
        </p>
        {sessions.map((s) => (
          <div className="job-row" key={s.id}>
            <div>
              <strong>
                {s.current ? "This session" : "Other signed-in session"}
              </strong>
              <p>Expires {new Date(s.expires).toLocaleString()}</p>
            </div>
            <button
              className="btn secondary"
              onClick={() =>
                act(async () => {
                  await api("/sessions/" + s.id + "/revoke", {});
                  if (s.current) location.reload();
                  else load();
                })
              }
            >
              Revoke
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <h3>Delete account</h3>
        <p>
          Permanently removes this customer account, profiles, sessions,
          history, lists and complimentary grants. Owner transfer must happen
          separately.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            act(async () => {
              await api("/account/delete", { password: d.get("password") });
              location.reload();
            });
          }}
        >
          <label>
            Confirm with account password
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" required />I understand this permanently
            deletes my account data.
          </label>
          <button className="btn secondary">Permanently delete account</button>
        </form>
      </section>
    </>
  );
}

function DemoPoster({ item }) {
  return (
    <div
      className={`demo-poster demo-pattern-${item.data.variant}`}
      style={{ "--demo-color": item.data.color }}
    >
      <span className="demo-label">DEMO</span>
      <span className="demo-series-label">{sections[item.section]}</span>
      <div className="demo-orb" />
      <div className="demo-orb second" />
      <div className="demo-poster-title">{item.title}</div>
      <span className="demo-poster-caption">
        FICTIONAL CATALOG · {String(item.data.sequence).padStart(3, "0")}
      </span>
    </div>
  );
}
function DemoPreview({ preview, onClose }) {
  const { item, episodes } = preview;
  return (
    <div className="modal-overlay">
      <section
        className="dialog wide demo-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Demo metadata preview"
      >
        <button
          className="close icon-btn"
          aria-label="Close demo preview"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="eyebrow">DEMO · FICTIONAL METADATA</span>
        <h2>{item.title}</h2>
        <p>{item.data.description}</p>
        <div className="demo-facts">
          <span>{sections[item.section]}</span>
          <span>{item.data.language}</span>
          <span>Sample release: {item.data.releaseDate}</span>
          <span>Sample age rating: {item.data.ageRating}+</span>
          <span>{item.data.genres.join(", ")}</span>
        </div>
        <div className="notice demo-warning">
          <AlertCircle size={18} />
          <span>
            This is a fictional preview. No video, stream, real event or
            distribution license is attached. Upload your own authorized media
            as a real content draft to test playback.
          </span>
        </div>
        {episodes.length > 0 && (
          <>
            <h3>Sample seasons and episodes</h3>
            <p>Fictional episode metadata. These entries are not playable.</p>
            {episodes.map((e) => (
              <div key={e.id} className="job-row">
                <div>
                  <strong>{e.title}</strong>
                  <p>
                    Season {e.data.season} · Episode {e.data.episode}
                  </p>
                </div>
                <span className="status-badge">Demo · No video</span>
              </div>
            ))}
          </>
        )}
        <button className="btn secondary" onClick={onClose}>
          Back to library
        </button>
      </section>
    </div>
  );
}
function DemoPanel({ data, act, refresh }) {
  const [section, setSection] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);
  const search = query.trim().toLowerCase();
  const matches = (data.items || []).filter(
    (item) =>
      (!section || item.section === section) &&
      item.title.toLowerCase().includes(search),
  );
  const visible = matches.slice(0, limit);
  return (
    <>
      <section className="panel">
        <h3>Populate the design with fictional previews</h3>
        <p>
          Add fictional titles across all eight primary sections, including
          series with sample seasons and episodes. Every preview carries a Demo
          label and opens fictional metadata.
        </p>
        <div className="stat-grid">
          <Stat title="Demo title previews" value={data.titleCount} />
          <Stat title="Sample episodes" value={data.episodeCount} />
          <div className="stat">
            <span>Public demo catalog</span>
            <strong style={{ fontSize: 22 }}>
              {data.enabled ? "Enabled" : "Hidden"}
            </strong>
            <small>Explicit demo labels on every card</small>
          </div>
        </div>
        <div className="button-row">
          <button
            className="btn primary"
            onClick={() =>
              act(async () => {
                await api("/admin/demo", { action: "seed" });
                refresh();
              })
            }
          >
            {data.installed ? "Refresh demo catalog" : "Add demo previews"}
          </button>
          {data.installed && (
            <>
              <button
                className="btn secondary"
                onClick={() =>
                  act(async () => {
                    await api("/admin/demo", {
                      action: data.enabled ? "hide" : "show",
                    });
                    refresh();
                  })
                }
              >
                {data.enabled ? "Hide demos" : "Show demos"}
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  act(async () => {
                    await api("/admin/demo", { action: "clear" });
                    refresh();
                  })
                }
              >
                Remove demo previews
              </button>
            </>
          )}
        </div>
      </section>
      {data.installed && (
        <section className="panel">
          <h3>Demo library coverage</h3>
          {Object.entries(data.sections).map(([key, count]) => (
            <div className="table-row" key={key}>
              <span>{sections[key]}</span>
              <strong>{count} fictional titles</strong>
            </div>
          ))}
          <h3>Demo titles</h3>
          <div className="filter-fields">
            <label>
              Search demo titles
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(25);
                }}
              />
            </label>
            <label>
              Demo category
              <select
                value={section}
                onChange={(event) => {
                  setSection(event.target.value);
                  setLimit(25);
                }}
              >
                <option value="">All categories</option>
                {Object.entries(sections).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {visible.length ? (
            <>
              <p className="subtle">
                Showing {visible.length} of {matches.length} demo titles
              </p>
              {visible.map((item) => (
                <div key={item.id} className="table-row">
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {sections[item.section]} · {item.kind} · {item.language} ·{" "}
                      {item.releaseDate.slice(0, 4)}
                    </small>
                  </div>
                  <span className="status-badge">Demo</span>
                </div>
              ))}
              {visible.length < matches.length && (
                <button
                  className="btn secondary"
                  onClick={() => setLimit((count) => count + 25)}
                >
                  Load more demo titles
                </button>
              )}
            </>
          ) : (
            <p>No demo titles match your search.</p>
          )}
        </section>
      )}
    </>
  );
}
