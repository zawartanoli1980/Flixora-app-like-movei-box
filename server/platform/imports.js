import { z } from "zod";
import { resolve, relative, isAbsolute } from "node:path";
import { realpathSync, readFileSync, copyFileSync, statSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { audit, sections } from "./store.js";
export function safeStorageFile(root, path) {
  if (typeof path !== "string" || isAbsolute(path))
    throw Error("Only relative private storage paths are accepted");
  const base = realpathSync(root),
    file = realpathSync(resolve(base, path));
  const rel = relative(base, file);
  if (rel.startsWith("..") || isAbsolute(rel) || !statSync(file).isFile())
    throw Error("Storage path escapes approved root");
  return file;
}
export function registerImportRoutes(app, { db, permit, metadata }) {
  app.get("/api/platform/admin/sources", permit("content"), (_req, res) =>
    res.json({
      items: db
        .prepare("SELECT * FROM sources")
        .all()
        .map((source) => ({
          ...source,
          intervalMinutes: Number(
            db
              .prepare("SELECT value FROM settings WHERE key=?")
              .get("schedule:" + source.id)?.value || 0,
          ),
        })),
      configured: Boolean(process.env.AUTHORIZED_IMPORT_ROOT),
    }),
  );
  app.post("/api/platform/admin/sources", permit("content"), (req, res) => {
    if (!process.env.AUTHORIZED_IMPORT_ROOT)
      return res
        .status(503)
        .json({
          error:
            "Setup required: mount authorized media storage and set AUTHORIZED_IMPORT_ROOT. Include a catalog.json manifest.",
        });
    const v = z
      .object({
        name: z.string().trim().min(1).max(120),
        section: z.enum(Object.keys(sections)).nullable(),
        authorized: z.literal(true),
      })
      .parse(req.body);
    const id = randomUUID();
    db.prepare("INSERT INTO sources VALUES(?,?,?,?,?)").run(
      id,
      v.name,
      v.section,
      1,
      new Date().toISOString(),
    );
    audit(db, req.user.id, "source.connected", id);
    res.status(201).json({ id });
  });
  app.post(
    "/api/platform/admin/sources/:id/schedule",
    permit("content"),
    (req, res) => {
      const v = z
        .object({ intervalMinutes: z.number().int().min(0).max(10080) })
        .parse(req.body);
      if (v.intervalMinutes > 0 && v.intervalMinutes < 15)
        return res
          .status(400)
          .json({ error: "Minimum automatic interval is 15 minutes" });
      if (!db.prepare("SELECT id FROM sources WHERE id=?").get(req.params.id))
        return res.status(404).json({ error: "Source not found" });
      db.prepare(
        "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run("schedule:" + req.params.id, String(v.intervalMinutes));
      audit(db, req.user.id, "source.schedule", req.params.id);
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/platform/admin/sources/:id/import",
    permit("content"),
    (req, res) => {
      const source = db
        .prepare("SELECT * FROM sources WHERE id=? AND authorized=1")
        .get(req.params.id);
      if (!source)
        return res.status(404).json({ error: "Authorized source not found" });
      if (!process.env.AUTHORIZED_IMPORT_ROOT)
        return res
          .status(503)
          .json({ error: "Authorized storage is not configured" });
      if (
        db
          .prepare(
            "SELECT id FROM import_runs WHERE source_id=? AND state IN ('queued','running')",
          )
          .get(source.id)
      )
        return res.status(409).json({ error: "An import is already active" });
      const id = randomUUID();
      db.prepare(
        "INSERT INTO import_runs(id,source_id,state,created) VALUES(?,?,'queued',?)",
      ).run(id, source.id, new Date().toISOString());
      audit(db, req.user.id, "import.requested", id);
      res.status(202).json({ id });
    },
  );
  app.get("/api/platform/admin/imports", permit("content"), (_req, res) =>
    res.json({
      items: db
        .prepare("SELECT * FROM import_runs ORDER BY created DESC LIMIT 100")
        .all(),
      review: db
        .prepare("SELECT * FROM import_review")
        .all()
        .map((x) => ({ ...x, data: JSON.parse(x.data) })),
    }),
  );
  app.post("/api/platform/admin/imports/:id", permit("content"), (req, res) => {
    const { action } = z
      .object({ action: z.enum(["cancel", "resume"]) })
      .parse(req.body);
    const run = db
      .prepare("SELECT * FROM import_runs WHERE id=?")
      .get(req.params.id);
    if (!run) return res.status(404).json({ error: "Import not found" });
    if (!["failed", "canceled"].includes(run.state) && action === "resume")
      return res
        .status(409)
        .json({ error: "Only failed or canceled imports can resume" });
    if (!["running", "queued"].includes(run.state) && action === "cancel")
      return res.status(409).json({ error: "Import is not active" });
    db.prepare("UPDATE import_runs SET state=? WHERE id=?").run(
      action === "cancel" ? "canceled" : "queued",
      run.id,
    );
    audit(db, req.user.id, "import." + action, run.id);
    res.json({ ok: true });
  });
  app.post(
    "/api/platform/admin/import-review/:id",
    permit("content"),
    (req, res) => {
      const entry = db
        .prepare("SELECT * FROM import_review WHERE id=?")
        .get(req.params.id);
      if (!entry)
        return res.status(404).json({ error: "Review entry not found" });
      const { section } = z
        .object({ section: z.enum(Object.keys(sections)) })
        .parse(req.body);
      const raw = JSON.parse(entry.data);
      const parsed = metadata.parse({ ...raw.metadata, section });
      const id = randomUUID();
      db.prepare("INSERT INTO content VALUES(?,?,?,?,?,NULL,0,?)").run(
        id,
        section,
        parsed.title,
        JSON.stringify(parsed),
        "draft",
        new Date().toISOString(),
      );
      db.prepare("DELETE FROM import_review WHERE id=?").run(entry.id);
      audit(db, req.user.id, "import.classified", id);
      res
        .status(201)
        .json({
          id,
          note: "Metadata draft created. Upload and validate licensed media before publishing.",
        });
    },
  );
}
export function startImportWorker({ db, root }, metadata) {
  db.prepare(
    "UPDATE import_runs SET state='queued' WHERE state='running'",
  ).run();
  const tick = () => {
    for (const schedule of db
      .prepare("SELECT * FROM settings WHERE key LIKE 'schedule:%'")
      .all()) {
      const minutes = Number(schedule.value);
      if (!minutes) continue;
      const sourceId = schedule.key.slice(9);
      const last = db
        .prepare(
          "SELECT * FROM import_runs WHERE source_id=? ORDER BY created DESC LIMIT 1",
        )
        .get(sourceId);
      if (
        !last ||
        (!["queued", "running"].includes(last.state) &&
          Date.parse(last.created) + minutes * 60000 < Date.now())
      )
        db.prepare(
          "INSERT INTO import_runs(id,source_id,state,created) VALUES(?,?,'queued',?)",
        ).run(randomUUID(), sourceId, new Date().toISOString());
    }
    const run = db
      .prepare(
        "SELECT * FROM import_runs WHERE state IN ('queued','running') ORDER BY created LIMIT 1",
      )
      .get();
    if (!run) return;
    try {
      if (!process.env.AUTHORIZED_IMPORT_ROOT)
        throw Error("AUTHORIZED_IMPORT_ROOT is not configured");
      const source = db
        .prepare("SELECT * FROM sources WHERE id=?")
        .get(run.source_id);
      const manifestPath = safeStorageFile(
        process.env.AUTHORIZED_IMPORT_ROOT,
        "catalog.json",
      );
      if (statSync(manifestPath).size > 10 * 1024 ** 2)
        throw Error("Manifest exceeds 10 MiB limit");
      const manifestText = readFileSync(manifestPath, "utf8");
      const digest = createHash("sha256").update(manifestText).digest("hex");
      const saved = db
        .prepare("SELECT value FROM settings WHERE key=?")
        .get("manifest:" + run.id);
      if (saved && saved.value !== digest)
        throw Error(
          "Manifest changed during import. Start a new import to avoid skipping entries.",
        );
      if (!saved)
        db.prepare("INSERT INTO settings VALUES(?,?)").run(
          "manifest:" + run.id,
          digest,
        );
      const manifest = JSON.parse(manifestText);
      if (!Array.isArray(manifest) || manifest.length > 10000)
        throw Error("Manifest must be an array of at most 10000 entries");
      db.prepare("UPDATE import_runs SET state='running' WHERE id=?").run(
        run.id,
      );
      const entry = manifest[run.cursor];
      if (!entry) {
        db.prepare("UPDATE import_runs SET state='completed' WHERE id=?").run(
          run.id,
        );
        return;
      }
      const errors = JSON.parse(run.errors);
      let outcome = "imported";
      try {
        const input = { ...entry.metadata };
        if (source.section) input.section = source.section;
        if (!sections[input.section]) {
          db.prepare("INSERT INTO import_review VALUES(?,?,?,?)").run(
            randomUUID(),
            run.id,
            JSON.stringify(entry),
            "Ambiguous primary section: administrator classification required",
          );
          outcome = "review";
        } else {
          const v = metadata.parse(input);
          if (!v.providerId) throw Error("Imports require a stable providerId");
          v.providerId = source.id + ":" + v.providerId;
          if (
            db
              .prepare(
                "SELECT id FROM content WHERE json_extract(data,'$.providerId')=?",
              )
              .get(v.providerId)
          )
            outcome = "duplicates";
          else {
            const id = randomUUID();
            let file = null;
            if (entry.media) {
              const sourceFile = safeStorageFile(
                process.env.AUTHORIZED_IMPORT_ROOT,
                entry.media,
              );
              const ext = sourceFile.split(".").pop().toLowerCase();
              if (!["mp4", "webm"].includes(ext))
                throw Error("Only MP4 and WebM media imports supported");
              if (statSync(sourceFile).size > 20 * 1024 ** 3)
                throw Error("Media exceeds 20 GiB limit");
              file = randomUUID() + "." + ext;
              copyFileSync(sourceFile, resolve(root, "media", file));
            }
            db.prepare("INSERT INTO content VALUES(?,?,?,?,?,?,0,?)").run(
              id,
              v.section,
              v.title,
              JSON.stringify(v),
              file ? "processing" : "draft",
              file,
              new Date().toISOString(),
            );
            if (file)
              db.prepare("INSERT INTO jobs VALUES(?,?,'queued',0,NULL,?)").run(
                randomUUID(),
                id,
                new Date().toISOString(),
              );
            audit(db, "importer", "content.imported", id);
          }
        }
      } catch (e) {
        errors.push({
          index: run.cursor,
          error:
            e instanceof z.ZodError
              ? "Invalid metadata: " + e.issues.map((x) => x.message).join("; ")
              : e.message,
        });
        outcome = null;
      }
      const counters = {
        imported: run.imported,
        duplicates: run.duplicates,
        review: run.review,
      };
      if (outcome) counters[outcome]++;
      db.prepare(
        "UPDATE import_runs SET cursor=?,imported=?,duplicates=?,review=?,errors=? WHERE id=?",
      ).run(
        run.cursor + 1,
        counters.imported,
        counters.duplicates,
        counters.review,
        JSON.stringify(errors),
        run.id,
      );
    } catch (e) {
      db.prepare(
        "UPDATE import_runs SET state='failed',errors=? WHERE id=?",
      ).run(
        JSON.stringify([...JSON.parse(run.errors), { error: e.message }]),
        run.id,
      );
    }
  };
  const timer = setInterval(tick, 1000);
  timer.unref();
  return () => clearInterval(timer);
}
