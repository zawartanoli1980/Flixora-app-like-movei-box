import { z } from "zod";
import { sections, audit } from "./store.js";
const settingKey = "demo:catalog:v1";
const sectionData = {
  movies: {
    adjectives: [
      "Amber",
      "Silent",
      "Midnight",
      "Crimson",
      "Hidden",
      "Golden",
      "Distant",
      "Velvet",
      "Silver",
      "Forgotten",
    ],
    nouns: [
      "Horizon",
      "Voyage",
      "Crossroads",
      "Harbor",
      "Passage",
      "Promise",
      "Frontier",
      "Echoes",
      "Trail",
      "Return",
    ],
    genres: ["Adventure", "Mystery", "Drama"],
    age: 12,
    language: ["en", "ur", "hi"],
    countries: ["US", "PK", "IN"],
    color: "#a84362",
  },
  drama: {
    adjectives: [
      "Gulabi",
      "Sunehri",
      "Khamosh",
      "Purani",
      "Nayi",
      "Roshan",
      "Anokhi",
      "Bheegi",
      "Meethi",
      "Rangeen",
    ],
    nouns: [
      "Raah",
      "Dastaan",
      "Manzil",
      "Yaadein",
      "Subah",
      "Umeed",
      "Roshni",
      "Shaam",
      "Baarish",
      "Kahani",
    ],
    genres: ["Family", "Romance", "Drama"],
    age: 16,
    language: ["ur", "hi"],
    countries: ["PK", "IN"],
    color: "#9e5c98",
  },
  tv: {
    adjectives: [
      "Northern",
      "Hidden",
      "Endless",
      "Quiet",
      "Broken",
      "Autumn",
      "Crimson",
      "Last",
      "Open",
      "Distant",
    ],
    nouns: [
      "District",
      "Letters",
      "Station",
      "Archive",
      "Avenue",
      "Dispatch",
      "Theater",
      "Hotel",
      "Deadline",
      "Junction",
    ],
    genres: ["Mystery", "Drama", "Comedy"],
    age: 16,
    language: ["en", "ko", "tr"],
    countries: ["US", "KR", "TR"],
    color: "#4975a8",
  },
  anime: {
    adjectives: [
      "Astral",
      "Crystal",
      "Neon",
      "Lunar",
      "Scarlet",
      "Azure",
      "Celestial",
      "Dreaming",
      "Electric",
      "Infinite",
    ],
    nouns: [
      "Voyagers",
      "Academy",
      "Chronicle",
      "Guardians",
      "Circuit",
      "Fleet",
      "Odyssey",
      "Sanctuary",
      "Gate",
      "Rebellion",
    ],
    genres: ["Fantasy", "Adventure", "Sci-Fi"],
    age: 12,
    language: ["ja", "en"],
    countries: ["JP"],
    color: "#7655bc",
  },
  cartoons: {
    adjectives: [
      "Happy",
      "Tiny",
      "Bouncy",
      "Rainbow",
      "Curious",
      "Sunny",
      "Magic",
      "Little",
      "Jolly",
      "Sparkly",
    ],
    nouns: [
      "Meadow",
      "Explorers",
      "Workshop",
      "Treehouse",
      "Parade",
      "Pals",
      "Picnic",
      "Clubhouse",
      "Carnival",
      "Gardens",
    ],
    genres: ["Family", "Comedy", "Adventure"],
    age: 7,
    language: ["en", "ur", "hi"],
    countries: ["US", "PK", "IN"],
    color: "#42947d",
  },
  cricket: {
    adjectives: [
      "Boundary",
      "Willow",
      "Wicket",
      "Pavilion",
      "Crease",
      "Spin",
      "Seam",
      "Innings",
      "Outfield",
      "Pitch",
    ],
    nouns: [
      "Notebook",
      "Practice",
      "Stories",
      "Drills",
      "Footwork",
      "Sessions",
      "Tactics",
      "Lessons",
      "Warmups",
      "Review",
    ],
    genres: ["Training", "Documentary", "Sport"],
    age: 0,
    language: ["ur", "en", "hi"],
    countries: ["PK", "GB", "IN"],
    color: "#438956",
  },
  sports: {
    adjectives: [
      "Trackside",
      "Courtside",
      "Summit",
      "Trail",
      "Sprint",
      "Goalpost",
      "Poolside",
      "Racquet",
      "Cycling",
      "Arena",
    ],
    nouns: [
      "Notebook",
      "Practice",
      "Stories",
      "Drills",
      "Footwork",
      "Sessions",
      "Tactics",
      "Lessons",
      "Warmups",
      "Review",
    ],
    genres: ["Training", "Documentary", "Sport"],
    age: 0,
    language: ["en", "ur"],
    countries: ["US", "PK"],
    color: "#b27535",
  },
  videos: {
    adjectives: [
      "Everyday",
      "Urban",
      "Coastal",
      "Mountain",
      "Garden",
      "Creative",
      "Workshop",
      "Weekend",
      "Morning",
      "Nightfall",
    ],
    nouns: [
      "Journal",
      "Sketchbook",
      "Notes",
      "Guide",
      "Walks",
      "Projects",
      "Diaries",
      "Postcards",
      "Routines",
      "Ideas",
    ],
    genres: ["Travel", "Learning", "Lifestyle"],
    age: 0,
    language: ["en", "ur", "hi"],
    countries: ["US", "PK", "IN"],
    color: "#428c9f",
  },
};
function makeCatalog() {
  const titles = [],
    episodes = [];
  let position = 0;
  for (const [section, config] of Object.entries(sectionData)) {
    // Keep the original 30 titles and their IDs stable.
    const titleNames = [config.nouns.slice(0, 3), config.nouns.slice(3)].flatMap(
      (nouns) => config.adjectives.flatMap(
        (adjective) => nouns.map((noun) => `${adjective} ${noun}`),
      ),
    );
    for (const [i, title] of titleNames.entries()) {
      const id = `demo-${section}-${String(i + 1).padStart(2, "0")}`;
      const isSeries =
        ["drama", "tv"].includes(section) ||
        (["anime", "cartoons"].includes(section) && i % 2 === 0);
      const kind = isSeries
        ? "series"
        : ["cricket", "sports"].includes(section)
          ? i % 2
            ? "highlight"
            : "replay"
          : section === "videos"
            ? "video"
            : "movie";
      const data = {
        demo: true,
        title,
        section,
        kind,
        description: `Fictional ${sections[section].toLowerCase()} preview for testing Flixora. ${title} is a made-up catalog entry. No movie, recording, live event, score or playable media is attached.`,
        language: config.language[i % config.language.length],
        genres: [config.genres[i % config.genres.length]],
        countries: [config.countries[i % config.countries.length]],
        releaseDate: `${2018 + (i % 9)}-${String(1 + (i % 12)).padStart(2, "0")}-01`,
        ageRating: config.age,
        authorized: false,
        premium: false,
        color: config.color,
        variant: i % 6,
        sequence: ++position,
      };
      const item = {
        id,
        section,
        title,
        state: "demo",
        validated: 0,
        demo: true,
        data,
      };
      titles.push(item);
      if (isSeries)
        for (let episode = 1; episode <= 6; episode++) {
          const season = Math.ceil(episode / 3),
            number = 1 + ((episode - 1) % 3);
          const episodeTitle = `${title}: Chapter ${episode}`;
          episodes.push({
            ...item,
            id: `${id}-s${season}-e${number}`,
            title: episodeTitle,
            data: {
              ...data,
              title: episodeTitle,
              kind: "episode",
              parentId: id,
              season,
              episode: number,
              description: `Fictional season ${season}, episode ${number} for ${title}. Metadata preview only; there is no playable video.`,
            },
          });
        }
    }
  }
  return { titles, episodes };
}
const catalog = makeCatalog();
const adminTitles = catalog.titles.map(({ id, title, section, data }) => ({
  id,
  title,
  section,
  kind: data.kind,
  language: data.language,
  releaseDate: data.releaseDate,
}));
export function demoStatus(db) {
  const config = JSON.parse(
    db.prepare("SELECT value FROM settings WHERE key=?").get(settingKey)
      ?.value || "null",
  );
  return {
    enabled: config?.enabled === true,
    installed: Boolean(config),
    titleCount: config ? catalog.titles.length : 0,
    episodeCount: config ? catalog.episodes.length : 0,
    sections: config
      ? Object.fromEntries(
          Object.keys(sections).map((key) => [
            key,
            catalog.titles.filter((item) => item.section === key).length,
          ]),
        )
      : {},
  };
}
export function demoTitles(db) {
  return demoStatus(db).enabled ? catalog.titles : [];
}
export function demoItem(db, id) {
  if (!demoStatus(db).enabled) return null;
  return (
    [...catalog.titles, ...catalog.episodes].find((item) => item.id === id) ||
    null
  );
}
export function demoEpisodes(db, id) {
  return demoStatus(db).enabled
    ? catalog.episodes.filter((item) => item.data.parentId === id)
    : [];
}
export function configureDemo(db, action, actor = "local-cli") {
  if (!["seed", "show", "hide", "clear"].includes(action))
    throw Error("Unknown demo catalog action");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (action === "clear")
      db.prepare("DELETE FROM settings WHERE key=?").run(settingKey);
    else if (action === "seed" || action === "show") {
      db.prepare(
        "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(settingKey, JSON.stringify({ version: 1, enabled: true }));
    } else {
      const row = db
        .prepare("SELECT value FROM settings WHERE key=?")
        .get(settingKey);
      if (row)
        db.prepare("UPDATE settings SET value=? WHERE key=?").run(
          JSON.stringify({ ...JSON.parse(row.value), enabled: false }),
          settingKey,
        );
    }
    audit(db, actor, "demo." + action, settingKey);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return demoStatus(db);
}
export function registerDemo(app, { db, permit }) {
  app.get("/api/platform/admin/demo", permit("settings"), (_req, res) => {
    const status = demoStatus(db);
    res.json({ ...status, items: status.installed ? adminTitles : [] });
  });
  app.post("/api/platform/admin/demo", permit("settings"), (req, res) => {
    const { action } = z
      .object({ action: z.enum(["seed", "show", "hide", "clear"]) })
      .strict()
      .parse(req.body);
    res.json(configureDemo(db, action, req.user.id));
  });
  app.get("/api/platform/demo/:id", (req, res) => {
    const item = demoItem(db, req.params.id);
    if (!item || (req.profile && item.data.ageRating > req.profile.max_age))
      return res.status(404).json({ error: "Demo preview unavailable" });
    res.json({ item, episodes: demoEpisodes(db, item.id) });
  });
}
