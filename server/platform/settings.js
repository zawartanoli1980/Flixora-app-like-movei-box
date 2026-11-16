import { z } from "zod";
import { randomUUID } from "node:crypto";
import { audit } from "./store.js";
const defaults = {
  name: "Flixora",
  mode: "mixed",
  maintenance: false,
  announcement: "",
  contact: "",
  privacy: "Privacy policy has not been configured.",
  terms: "Terms have not been configured.",
};
export function platformSettings(db) {
  const row = db
    .prepare("SELECT value FROM settings WHERE key='platform'")
    .get();
  return row ? { ...defaults, ...JSON.parse(row.value) } : defaults;
}
export function registerSettings(app, { db, permit }) {
  app.get("/api/platform/settings", (_req, res) =>
    res.json(platformSettings(db)),
  );
  app.get("/api/platform/plans", (_req, res) =>
    res.json({
      items: db
        .prepare("SELECT value FROM settings WHERE key LIKE 'plan:%'")
        .all()
        .map((r) => JSON.parse(r.value))
        .filter((p) => p.enabled),
      checkoutAvailable: false,
    }),
  );
  app.get("/api/platform/admin/settings", permit("settings"), (_req, res) =>
    res.json({
      settings: platformSettings(db),
      plans: db
        .prepare("SELECT value FROM settings WHERE key LIKE 'plan:%'")
        .all()
        .map((r) => JSON.parse(r.value)),
    }),
  );
  app.post("/api/platform/admin/settings", permit("settings"), (req, res) => {
    const v = z
      .object({
        name: z.string().trim().min(1).max(40),
        mode: z.enum(["free", "mixed", "premium"]),
        maintenance: z.boolean(),
        announcement: z.string().max(500),
        contact: z.string().max(200),
        privacy: z.string().max(10000),
        terms: z.string().max(10000),
      })
      .strict()
      .parse(req.body);
    db.prepare(
      "INSERT INTO settings VALUES('platform',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ).run(JSON.stringify(v));
    audit(db, req.user.id, "settings.updated", "platform");
    res.json({ ok: true });
  });
  app.post("/api/platform/admin/plans", permit("settings"), (req, res) => {
    const v = z
      .object({
        name: z.string().trim().min(1).max(80),
        amountMinor: z.number().int().min(0).max(100000000),
        currency: z.string().regex(/^[A-Z]{3}$/),
        days: z.number().int().min(1).max(366),
        quality: z.enum(["source", "720p", "1080p", "4k"]),
        devices: z.number().int().min(1).max(20),
        streams: z.number().int().min(1).max(10),
        enabled: z.boolean(),
      })
      .strict()
      .parse(req.body);
    const id = randomUUID();
    const plan = {
      id,
      ...v,
      billing: "prepaid",
      created: new Date().toISOString(),
    };
    db.prepare("INSERT INTO settings VALUES(?,?)").run(
      "plan:" + id,
      JSON.stringify(plan),
    );
    audit(db, req.user.id, "plan.created", id);
    res.status(201).json(plan);
  });
  app.post(
    "/api/platform/admin/plans/:id/disable",
    permit("settings"),
    (req, res) => {
      const row = db
        .prepare("SELECT value FROM settings WHERE key=?")
        .get("plan:" + req.params.id);
      if (!row) return res.status(404).json({ error: "Plan not found" });
      const plan = JSON.parse(row.value);
      plan.enabled = false;
      db.prepare("UPDATE settings SET value=? WHERE key=?").run(
        JSON.stringify(plan),
        "plan:" + plan.id,
      );
      audit(db, req.user.id, "plan.disabled", plan.id);
      res.json({ ok: true });
    },
  );
}
