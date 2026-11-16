import { registerDemo, demoTitles, demoStatus } from "./demo-catalog.js";
import express from "express";
import { createMailer, emailConfigured, registerEmail } from "./email.js";
import { initializeProfile, registerProfiles } from "./profiles.js";
import { registerSettings, platformSettings } from "./settings.js";
import { registerImportRoutes } from "./imports.js";
import { registerGoogle, googleConfigured } from "./google.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { openSync, writeSync, closeSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  sections,
  hashPassword,
  checkPassword,
  audit,
  eligible,
} from "./store.js";
const hash = (x) => createHash("sha256").update(x).digest("hex");
const email = z
  .string()
  .email()
  .max(254)
  .transform((x) => x.toLowerCase());
export const metadata = z
  .object({
    title: z.string().trim().min(1).max(200),
    section: z.enum(Object.keys(sections)),
    description: z.string().trim().min(1).max(5000),
    kind: z.enum([
      "movie",
      "series",
      "episode",
      "live-event",
      "highlight",
      "replay",
      "video",
    ]),
    language: z.string().min(2).max(50),
    genres: z.array(z.string().max(50)).max(20).default([]),
    regions: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .max(100)
      .default([]),
    rightsStart: z.string().datetime(),
    rightsEnd: z.string().datetime(),
    license: z.string().trim().min(5).max(2000),
    authorized: z.literal(true),
    premium: z.boolean().default(false),
    providerId: z.string().max(200).optional(),
    parentId: z.string().uuid().optional(),
    season: z.number().int().positive().optional(),
    episode: z.number().int().positive().optional(),
    releaseDate: z.string().date().optional(),
    cast: z.array(z.string().max(100)).max(100).default([]),
    directors: z.array(z.string().max(100)).max(20).default([]),
    countries: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .max(100)
      .default([]),
    ageRating: z.number().int().min(0).max(18).default(18),
  })
  .strict()
  .refine(
    (d) => Date.parse(d.rightsEnd) > Date.parse(d.rightsStart),
    "Rights end must follow start",
  )
  .refine(
    (d) => d.kind !== "episode" || Boolean(d.parentId && d.season && d.episode),
    "Episode requires series, season and episode number",
  )
  .refine(
    (d) => d.kind === "episode" || !d.parentId,
    "Only episodes may reference a parent series",
  );
const roles = {
  owner: ["content", "users", "finance", "settings", "support"],
  administrator: ["content", "users", "support"],
  content_manager: ["content"],
  finance: ["finance"],
  support: ["support"],
};
export function createPlatformApp({
  db,
  root,
  secureCookies = process.env.NODE_ENV === "production",
  region = process.env.PLATFORM_REGION,
  mailer = createMailer(),
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60000, limit: 300 }));
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !req.is("application/json") &&
      !req.is("application/octet-stream")
    )
      return res
        .status(415)
        .json({ error: "JSON or binary content type required" });
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("flixora_session="))
      ?.slice(16);
    if (token) {
      req.sessionKey = hash(token);
      req.user = db
        .prepare(
          "SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.suspended=0",
        )
        .get(hash(token), Date.now());
      if (req.user)
        req.profile = db
          .prepare(
            "SELECT p.* FROM profiles p JOIN session_profiles sp ON p.id=sp.profile_id WHERE sp.token=? AND p.user_id=?",
          )
          .get(req.sessionKey, req.user.id);
    }
    next();
  });
  const auth = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: "Sign in required" });
  const permit = (cap) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });
    if (!roles[req.user.role]?.includes(cap))
      return res.status(403).json({ error: "Permission denied" });
    next();
  };
  const record = (id) => {
    const row = db.prepare("SELECT * FROM content WHERE id=?").get(id);
    if (!row) throw Object.assign(Error("Content not found"), { status: 404 });
    return row;
  };
  const unpack = (row) => ({
    ...row,
    data: JSON.parse(row.data),
    file: undefined,
  });
  const session = (user, res, redirect) => {
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(token),
      user.id,
      Date.now() + 7 * 86400000,
    );
    initializeProfile(db, user.id, hash(token));
    res.cookie("flixora_session", token, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "strict",
      maxAge: 7 * 86400000,
      path: "/",
    });
    if (redirect) res.redirect(redirect);
    else
      res.json({ user: { id: user.id, email: user.email, role: user.role } });
  };
  registerGoogle(app, { db, session, secureCookies });
  registerSettings(app, { db, permit });
  registerDemo(app, { db, permit });
  registerProfiles(app, { db, auth });
  const loginLimiter = rateLimit({ windowMs: 15 * 60000, limit: 20 });
  registerEmail(app, { db, mailer, limiter: loginLimiter });
  app.get("/api/platform/health", (_req, res) =>
    res.json({
      status: "ok",
      database: db.prepare("SELECT 1 AS ok").get().ok === 1,
    }),
  );
  app.get("/api/platform/status", (_req, res) =>
    res.json({
      sections,
      features: { demoCatalog: true },
      integrations: {
        google: {
          status: googleConfigured()
            ? "Configured; live verification required"
            : "Setup required",
          detail: googleConfigured()
            ? "Google OIDC authorization-code sign-in configured. Validate the live redirect before launch."
            : "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in server environment settings.",
        },
        email: {
          status: emailConfigured()
            ? "Configured; delivery verification required"
            : "Setup required",
          detail:
            "Registration, verification and reset require SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM and PUBLIC_APP_URL. TLS is required.",
        },
        cards: {
          status: "Setup required",
          detail:
            "Hosted checkout adapter, merchant approval, signed webhooks and reconciliation must be configured.",
        },
        easypaisa: {
          status: "Setup required",
          detail:
            "Approved merchant account and verified official integration required.",
        },
        jazzcash: {
          status: "Setup required",
          detail:
            "Approved merchant account and verified official integration required.",
        },
        sources: {
          status: "Authorized source required",
          detail:
            "No licensed distributor adapter connected. Metadata alone never enables playback.",
        },
        storage: {
          status: "Local private storage",
          detail:
            "Resumable direct uploads enabled. Configure durable volume and backups before production.",
        },
      },
    }),
  );
  app.get("/api/platform/me", (req, res) =>
    res.json({ user: req.user || null }),
  );
  app.post("/api/platform/login", loginLimiter, (req, res) => {
    const v = z
      .object({ email, password: z.string().min(1).max(1024) })
      .parse(req.body);
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(v.email);
    const valid = checkPassword(
      v.password,
      user?.password || hashPassword("timing-padding"),
    );
    if (
      !user ||
      !valid ||
      user.suspended ||
      db
        .prepare(
          "SELECT user_id FROM account_verification WHERE user_id=? AND verified=0",
        )
        .get(user?.id || "")
    )
      return res.status(401).json({ error: "Invalid email or password" });
    session(user, res);
  });
  app.post("/api/platform/logout", auth, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.user.id);
    res.clearCookie("flixora_session", { path: "/" }).json({ ok: true });
  });
  app.get("/api/platform/catalog", (req, res) => {
    if (platformSettings(db).maintenance)
      return res
        .status(503)
        .json({ error: "Maintenance in progress. Please try again later." });
    const section = req.query.section;
    if (section && !sections[section])
      return res.status(400).json({ error: "Unknown primary section" });
    let items = db
      .prepare(
        "SELECT * FROM content WHERE state='published' ORDER BY created DESC",
      )
      .all()
      .filter((r) => {
        const d = JSON.parse(r.data);
        return (
          d.kind !== "episode" &&
          (!section || r.section === section) &&
          (!req.profile || d.ageRating <= req.profile.max_age) &&
          Date.parse(d.rightsStart) <= Date.now() &&
          Date.parse(d.rightsEnd) > Date.now() &&
          (!d.regions.length || d.regions.includes(region))
        );
      });
    items = items.map(unpack);
    items.push(
      ...demoTitles(db).filter(
        (item) =>
          (!section || item.section === section) &&
          (!req.profile || item.data.ageRating <= req.profile.max_age),
      ),
    );
    const q = String(req.query.q || "").toLowerCase();
    items = items.filter((r) => {
      const d = r.data;
      return (
        (!req.query.language || d.language === req.query.language) &&
        (!req.query.year ||
          d.releaseDate?.startsWith(String(req.query.year))) &&
        (!req.query.country || d.countries?.includes(req.query.country)) &&
        (!req.query.genre || d.genres?.includes(req.query.genre))
      );
    });
    items = items.filter((r) =>
      (r.title + " " + r.data.description).toLowerCase().includes(q),
    );
    res.json({ items, total: items.length, demo: demoStatus(db) });
  });
  app.get("/api/platform/series/:id/episodes", (req, res) => {
    const parent = record(req.params.id);
    const d = JSON.parse(parent.data);
    if (
      d.kind !== "series" ||
      parent.state !== "published" ||
      Date.parse(d.rightsStart) > Date.now() ||
      Date.parse(d.rightsEnd) <= Date.now()
    )
      return res.status(404).json({ error: "Published series unavailable" });
    const items = db
      .prepare(
        "SELECT * FROM content WHERE state='published' AND json_extract(data,'$.parentId')=?",
      )
      .all(parent.id)
      .filter((row) => {
        const data = JSON.parse(row.data);
        return (
          row.section === parent.section &&
          data.kind === "episode" &&
          Date.parse(data.rightsStart) <= Date.now() &&
          Date.parse(data.rightsEnd) > Date.now() &&
          (!req.profile || data.ageRating <= req.profile.max_age)
        );
      })
      .sort((a, b) => {
        const x = JSON.parse(a.data),
          y = JSON.parse(b.data);
        return x.season - y.season || x.episode - y.episode;
      });
    res.json({ items: items.map(unpack) });
  });
  app.get("/api/platform/artwork/:id", (req, res) => {
    const item = record(req.params.id);
    const d = JSON.parse(item.data);
    const file = item.file && resolve(root, "media", item.file + ".jpg");
    if (
      item.state !== "published" ||
      Date.parse(d.rightsStart) > Date.now() ||
      Date.parse(d.rightsEnd) <= Date.now() ||
      !file ||
      !existsSync(file)
    )
      return res.status(404).end();
    res.sendFile(file);
  });
  app.get("/api/platform/media/:id", (req, res) => {
    if (req.params.id.startsWith("demo-"))
      return res
        .status(409)
        .json({
          error: "Demo metadata preview only. No playable video is attached.",
        });
    const item = record(req.params.id);
    const details = JSON.parse(item.data);
    if (details.kind === "series")
      return res.status(409).json({
        error: "Series metadata is not a playable video; choose an episode",
      });
    if (details.kind === "episode") {
      const parent = record(details.parentId);
      if (
        !eligible(parent, req.user, db, region) ||
        parent.section !== item.section ||
        (req.profile && JSON.parse(parent.data).ageRating > req.profile.max_age)
      )
        return res.status(403).json({
          error: "Parent series rights or access requirements are not met",
        });
    }
    if (req.user && !req.profile)
      return res
        .status(409)
        .json({ error: "Select and unlock a profile before playback" });
    if (!req.user && JSON.parse(item.data).ageRating > 12)
      return res
        .status(401)
        .json({ error: "Sign in and select an age-appropriate profile" });
    if (req.profile && JSON.parse(item.data).ageRating > req.profile.max_age)
      return res.status(403).json({
        error: "This title exceeds the active profile maturity limit",
      });
    if (!eligible(item, req.user, db, region))
      return res.status(403).json({
        error:
          "Playback unavailable: publication, rights, region or premium access requirements are not met",
      });
    const file = resolve(root, "media", item.file);
    if (!existsSync(file))
      return res.status(410).json({
        error: "Media unavailable. Administrator must revalidate the file.",
      });
    res.set("Cache-Control", "private, no-store");
    res.type(item.file.endsWith(".webm") ? "video/webm" : "video/mp4");
    res.sendFile(file);
  });
  const selected = (req, res, next) =>
    req.profile
      ? next()
      : res.status(409).json({ error: "Select a profile first" });
  app.get("/api/platform/library", auth, selected, (req, res) =>
    res.json({
      watchlist: db
        .prepare("SELECT content_id FROM profile_watchlist WHERE profile_id=?")
        .all(req.profile.id),
      progress: db
        .prepare(
          "SELECT content_id,position FROM profile_progress WHERE profile_id=?",
        )
        .all(req.profile.id),
    }),
  );
  app.post("/api/platform/library/:id", auth, selected, (req, res) => {
    if (req.params.id.startsWith("demo-"))
      return res
        .status(409)
        .json({
          error: "Demo previews cannot be saved as real viewing activity.",
        });
    const item = record(req.params.id);
    if (JSON.parse(item.data).ageRating > req.profile.max_age)
      return res.status(403).json({ error: "Profile maturity restriction" });
    const v = z
      .object({
        listed: z.boolean().optional(),
        position: z.number().finite().min(0).max(604800).optional(),
      })
      .strict()
      .parse(req.body);
    if (v.listed === true)
      db.prepare("INSERT OR IGNORE INTO profile_watchlist VALUES(?,?)").run(
        req.profile.id,
        req.params.id,
      );
    if (v.listed === false)
      db.prepare(
        "DELETE FROM profile_watchlist WHERE profile_id=? AND content_id=?",
      ).run(req.profile.id, req.params.id);
    if (v.position !== undefined)
      db.prepare(
        "INSERT INTO profile_progress VALUES(?,?,?) ON CONFLICT(profile_id,content_id) DO UPDATE SET position=excluded.position",
      ).run(req.profile.id, req.params.id, v.position);
    res.json({ ok: true });
  });
  registerImportRoutes(app, { db, permit, metadata });
  app.get("/api/platform/admin/overview", permit("content"), (_req, res) =>
    res.json({
      content: db
        .prepare("SELECT state,COUNT(*) AS count FROM content GROUP BY state")
        .all(),
      users: db.prepare("SELECT COUNT(*) AS count FROM users").get().count,
      jobs: db
        .prepare("SELECT state,COUNT(*) AS count FROM jobs GROUP BY state")
        .all(),
      coverage: db
        .prepare(
          "SELECT section,COUNT(*) AS count FROM content WHERE state='published' GROUP BY section",
        )
        .all(),
    }),
  );
  app.get("/api/platform/admin/content", permit("content"), (_req, res) =>
    res.json({
      items: db
        .prepare("SELECT * FROM content ORDER BY created DESC")
        .all()
        .map(unpack),
    }),
  );
  app.post("/api/platform/admin/content", permit("content"), (req, res) => {
    const v = metadata.parse(req.body);
    if (v.parentId) {
      const parent = record(v.parentId);
      if (
        parent.section !== v.section ||
        JSON.parse(parent.data).kind !== "series"
      )
        return res.status(400).json({
          error:
            "Episodes must use the same primary section as their parent series",
        });
    }
    if (
      v.providerId &&
      db
        .prepare(
          "SELECT id FROM content WHERE json_extract(data,'$.providerId')=?",
        )
        .get(v.providerId)
    )
      return res
        .status(409)
        .json({ error: "Duplicate provider ID; review the existing title" });
    const id = randomUUID();
    db.prepare("INSERT INTO content VALUES(?,?,?,?,?,NULL,0,?)").run(
      id,
      v.section,
      v.title,
      JSON.stringify(v),
      "draft",
      new Date().toISOString(),
    );
    audit(db, req.user.id, "content.created", id);
    res.status(201).json({ id });
  });
  app.put("/api/platform/admin/content/:id", permit("content"), (req, res) => {
    const item = record(req.params.id);
    if (item.state === "processing")
      return res
        .status(409)
        .json({ error: "Wait for processing before editing" });
    const v = metadata.parse(req.body);
    if (v.parentId) {
      const parent = record(v.parentId);
      if (
        parent.section !== v.section ||
        JSON.parse(parent.data).kind !== "series"
      )
        return res
          .status(400)
          .json({ error: "Episode category must match its series" });
    }
    if (
      v.providerId &&
      db
        .prepare(
          "SELECT id FROM content WHERE json_extract(data,'$.providerId')=? AND id!=?",
        )
        .get(v.providerId, item.id)
    )
      return res.status(409).json({ error: "Duplicate provider ID" });
    const children = db
      .prepare("SELECT * FROM content WHERE json_extract(data,'$.parentId')=?")
      .all(item.id);
    if (children.length && v.kind !== "series")
      return res.status(409).json({
        error: "A series with episodes cannot become another content type",
      });
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const child of children) {
        const childData = JSON.parse(child.data);
        childData.section = v.section;
        db.prepare(
          "UPDATE content SET section=?,data=?,state=? WHERE id=?",
        ).run(
          v.section,
          JSON.stringify(childData),
          child.validated ? "review" : "draft",
          child.id,
        );
      }
      db.prepare(
        "UPDATE content SET title=?,section=?,data=?,state=? WHERE id=?",
      ).run(
        v.title,
        v.section,
        JSON.stringify(v),
        item.validated ? "review" : "draft",
        item.id,
      );
      audit(db, req.user.id, "content.updated", item.id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ ok: true });
  });
  app.post(
    "/api/platform/admin/content/:id/state",
    permit("content"),
    (req, res) => {
      const { state } = z
        .object({ state: z.enum(["published", "archived", "review"]) })
        .parse(req.body);
      const item = record(req.params.id);
      const d = JSON.parse(item.data);
      if (
        state === "published" &&
        (d.kind === "live-event" ||
          (d.kind !== "series" &&
            (!item.validated ||
              !item.file ||
              !existsSync(resolve(root, "media", item.file)))) ||
          !d.authorized ||
          Date.parse(d.rightsStart) > Date.now() ||
          Date.parse(d.rightsEnd) <= Date.now())
      )
        return res.status(409).json({
          error:
            "Publish blocked: successful media processing and current licensed rights are required",
        });
      if (state === "published" && d.kind === "episode") {
        const parent = record(d.parentId);
        if (parent.state !== "published" || parent.section !== item.section)
          return res.status(409).json({
            error:
              "Publish the parent series first, in the same primary section",
          });
      }
      db.prepare("UPDATE content SET state=? WHERE id=?").run(state, item.id);
      audit(db, req.user.id, "content." + state, item.id);
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/platform/admin/content/:id/upload",
    permit("content"),
    (req, res) => {
      const item = record(req.params.id);
      if (["published", "processing"].includes(item.state))
        return res.status(409).json({
          error:
            "Archive the content and wait for processing before replacing media",
        });
      if (["series", "live-event"].includes(JSON.parse(item.data).kind))
        return res.status(409).json({
          error:
            "Series containers and live events do not accept a recording as their playable media",
        });
      const v = z
        .object({
          size: z
            .number()
            .int()
            .positive()
            .max(20 * 1024 ** 3),
          extension: z.enum(["mp4", "webm"]),
        })
        .parse(req.body);
      if (
        db
          .prepare(
            "SELECT id FROM uploads WHERE content_id=? AND state='uploading'",
          )
          .get(item.id)
      )
        return res.status(409).json({
          error: "Resume the active upload rather than creating another",
        });
      const id = randomUUID();
      const name = id + "." + v.extension;
      const fd = openSync(resolve(root, "media", name), "wx", 0o600);
      closeSync(fd);
      db.prepare("INSERT INTO uploads VALUES(?,?,?,0,?)").run(
        id,
        item.id,
        v.size,
        "uploading",
      );
      db.prepare(
        "UPDATE content SET file=?,validated=0,state='draft' WHERE id=?",
      ).run(name, item.id);
      audit(db, req.user.id, "upload.created", item.id);
      res.status(201).json({ id, offset: 0 });
    },
  );
  app.get("/api/platform/admin/uploads", permit("content"), (_req, res) =>
    res.json({
      items: db.prepare("SELECT * FROM uploads WHERE state='uploading'").all(),
    }),
  );
  app.put(
    "/api/platform/admin/uploads/:id",
    permit("content"),
    express.raw({ type: "application/octet-stream", limit: "8mb" }),
    (req, res) => {
      const upload = db
        .prepare("SELECT * FROM uploads WHERE id=?")
        .get(req.params.id);
      if (!upload || upload.state !== "uploading")
        return res.status(404).json({ error: "Active upload not found" });
      const offset = Number(req.headers["upload-offset"]);
      if (!Number.isSafeInteger(offset) || offset !== upload.offset)
        return res
          .status(409)
          .json({ error: "Offset mismatch", offset: upload.offset });
      if (
        !Buffer.isBuffer(req.body) ||
        !req.body.length ||
        offset + req.body.length > upload.size
      )
        return res.status(400).json({ error: "Invalid chunk length" });
      const item = record(upload.content_id);
      const fd = openSync(resolve(root, "media", item.file), "r+");
      try {
        writeSync(fd, req.body, 0, req.body.length, offset);
      } finally {
        closeSync(fd);
      }
      const end = offset + req.body.length;
      db.prepare("UPDATE uploads SET offset=? WHERE id=?").run(end, upload.id);
      res.json({ offset: end });
    },
  );
  app.post(
    "/api/platform/admin/uploads/:id/complete",
    permit("content"),
    (req, res) => {
      const u = db
        .prepare("SELECT * FROM uploads WHERE id=?")
        .get(req.params.id);
      if (!u || u.state !== "uploading" || u.offset !== u.size)
        return res
          .status(409)
          .json({ error: "Upload incomplete or already submitted" });
      const item = record(u.content_id);
      if (statSync(resolve(root, "media", item.file)).size !== u.size)
        return res.status(409).json({ error: "File size mismatch" });
      db.prepare("UPDATE uploads SET state='complete' WHERE id=?").run(u.id);
      db.prepare("UPDATE content SET state='processing' WHERE id=?").run(
        item.id,
      );
      const id = randomUUID();
      db.prepare("INSERT INTO jobs VALUES(?,?,'queued',0,NULL,?)").run(
        id,
        item.id,
        new Date().toISOString(),
      );
      res.status(202).json({ id });
    },
  );
  app.get("/api/platform/admin/jobs", permit("content"), (_req, res) =>
    res.json({
      items: db
        .prepare("SELECT * FROM jobs ORDER BY created DESC LIMIT 200")
        .all(),
    }),
  );
  app.post("/api/platform/admin/jobs/:id", permit("content"), (req, res) => {
    const { action } = z
      .object({ action: z.enum(["retry", "cancel"]) })
      .parse(req.body);
    const job = db.prepare("SELECT * FROM jobs WHERE id=?").get(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (action === "retry" && job.state !== "failed")
      return res.status(409).json({ error: "Only failed jobs can retry" });
    if (action === "cancel" && !["queued", "running"].includes(job.state))
      return res.status(409).json({ error: "Job is not active" });
    db.prepare("UPDATE jobs SET state=?,attempts=0 WHERE id=?").run(
      action === "retry" ? "queued" : "canceled",
      job.id,
    );
    db.prepare("UPDATE content SET state=?,validated=0 WHERE id=?").run(
      action === "retry" ? "processing" : "draft",
      job.content_id,
    );
    audit(db, req.user.id, "job." + action, job.id);
    res.json({ ok: true });
  });
  app.get("/api/platform/admin/users", permit("users"), (_req, res) =>
    res.json({
      items: db
        .prepare("SELECT id,email,role,suspended,created FROM users")
        .all(),
    }),
  );
  app.post("/api/platform/admin/users", permit("users"), (req, res) => {
    if (req.user.role !== "owner")
      return res
        .status(403)
        .json({ error: "Only the owner can provision accounts" });
    const v = z
      .object({
        email,
        password: z.string().min(12).max(1024),
        role: z.enum([
          "customer",
          "administrator",
          "content_manager",
          "finance",
          "support",
        ]),
      })
      .strict()
      .parse(req.body);
    const id = randomUUID();
    db.prepare("INSERT INTO users VALUES(?,?,?,?,0,?)").run(
      id,
      v.email,
      hashPassword(v.password),
      v.role,
      new Date().toISOString(),
    );
    audit(db, req.user.id, "user.provisioned", id);
    res.status(201).json({ id });
  });
  app.post(
    "/api/platform/admin/users/:id/suspend",
    permit("users"),
    (req, res) => {
      const user = db
        .prepare("SELECT role FROM users WHERE id=?")
        .get(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.role === "owner")
        return res.status(403).json({ error: "Owner cannot be suspended" });
      db.prepare("UPDATE users SET suspended=1 WHERE id=?").run(req.params.id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.params.id);
      audit(db, req.user.id, "user.suspended", req.params.id);
      res.json({ ok: true });
    },
  );
  app.post("/api/platform/admin/grants", permit("finance"), (req, res) => {
    const v = z
      .object({ userId: z.string().uuid(), expires: z.string().datetime() })
      .parse(req.body);
    if (Date.parse(v.expires) <= Date.now())
      return res
        .status(400)
        .json({ error: "Expiration must be in the future" });
    const id = randomUUID();
    db.prepare("INSERT INTO grants VALUES(?,?,?,0)").run(
      id,
      v.userId,
      Date.parse(v.expires),
    );
    audit(db, req.user.id, "complimentary.granted", id);
    res.status(201).json({ id });
  });
  app.get("/api/platform/admin/grants", permit("finance"), (_req, res) =>
    res.json({
      items: db
        .prepare(
          "SELECT g.*,u.email FROM grants g JOIN users u ON g.user_id=u.id",
        )
        .all(),
    }),
  );
  app.post(
    "/api/platform/admin/grants/:id/revoke",
    permit("finance"),
    (req, res) => {
      db.prepare("UPDATE grants SET revoked=1 WHERE id=?").run(req.params.id);
      audit(db, req.user.id, "complimentary.revoked", req.params.id);
      res.json({ ok: true });
    },
  );
  app.get("/api/platform/admin/audit", permit("settings"), (_req, res) =>
    res.json({
      items: db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 200").all(),
    }),
  );
  app.post("/api/platform/checkout", (_req, res) =>
    res.status(503).json({
      error:
        "Setup required: no verified payment provider is connected. No charge or subscription has been created.",
    }),
  );
  app.post("/api/platform/webhooks/:provider", (_req, res) =>
    res.status(503).json({
      error: "Provider adapter unavailable; payment events are not accepted.",
    }),
  );
  app.use("/api", (_req, res) =>
    res
      .status(404)
      .json({ error: "Endpoint unavailable in the real-content platform" }),
  );
  app.use((err, _req, res, _next) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: err.issues.map((x) => x.message).join("; ") });
    if (
      err.code?.includes("SQLITE_CONSTRAINT") ||
      (Number(err.errcode) & 255) === 19
    )
      return res
        .status(409)
        .json({ error: "Conflicting record or invalid relationship" });
    res.status(err.status || 500).json({
      error: err.status
        ? err.message
        : "Request failed; check server configuration",
    });
  });
  return app;
}
