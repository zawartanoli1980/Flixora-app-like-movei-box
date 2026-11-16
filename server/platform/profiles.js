import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hashPassword, checkPassword, audit } from "./store.js";
export function safeProfile(profile) {
  if (!profile) return null;
  const { pin, attempts, locked_until, ...safe } = profile;
  return { ...safe, protected: Boolean(pin) };
}
export function initializeProfile(db, userId, sessionKey) {
  let profile = db
    .prepare("SELECT * FROM profiles WHERE user_id=? ORDER BY rowid LIMIT 1")
    .get(userId);
  if (!profile) {
    const id = randomUUID();
    db.prepare("INSERT INTO profiles(id,user_id,name) VALUES(?,?,?)").run(
      id,
      userId,
      "My profile",
    );
    profile = db.prepare("SELECT * FROM profiles WHERE id=?").get(id);
  }
  if (!profile.pin)
    db.prepare("INSERT OR REPLACE INTO session_profiles VALUES(?,?)").run(
      sessionKey,
      profile.id,
    );
}
export function registerProfiles(app, { db, auth }) {
  app.get("/api/platform/profiles", auth, (req, res) =>
    res.json({
      items: db
        .prepare("SELECT * FROM profiles WHERE user_id=?")
        .all(req.user.id)
        .map(safeProfile),
      active: safeProfile(req.profile),
    }),
  );
  app.post("/api/platform/profiles", auth, (req, res) => {
    const v = z
      .object({
        name: z.string().trim().min(1).max(40),
        kids: z.boolean(),
        maxAge: z.number().int().min(0).max(18),
        pin: z
          .string()
          .regex(/^\d{4,8}$/)
          .optional(),
        password: z.string().max(1024),
      })
      .strict()
      .parse(req.body);
    const owner = db
      .prepare("SELECT password FROM users WHERE id=?")
      .get(req.user.id);
    if (!checkPassword(v.password, owner.password))
      return res
        .status(403)
        .json({
          error:
            "Account password required to create or change parental controls",
        });
    if (
      db
        .prepare("SELECT COUNT(*) n FROM profiles WHERE user_id=?")
        .get(req.user.id).n >= 5
    )
      return res
        .status(409)
        .json({ error: "Maximum five profiles per account" });
    if (v.kids && v.maxAge > 12)
      return res
        .status(400)
        .json({ error: "Kids profiles cannot exceed age 12" });
    const id = randomUUID();
    db.prepare(
      "INSERT INTO profiles(id,user_id,name,kids,max_age,pin) VALUES(?,?,?,?,?,?)",
    ).run(
      id,
      req.user.id,
      v.name,
      v.kids ? 1 : 0,
      v.maxAge,
      v.pin ? hashPassword(v.pin) : null,
    );
    audit(db, req.user.id, "profile.created", id);
    res.status(201).json({ id });
  });
  app.post("/api/platform/profiles/:id/select", auth, (req, res) => {
    const v = z
      .object({ pin: z.string().max(8).optional() })
      .strict()
      .parse(req.body);
    const profile = db
      .prepare("SELECT * FROM profiles WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (profile.locked_until > Date.now())
      return res
        .status(429)
        .json({ error: "PIN locked for 15 minutes after repeated failures" });
    if (profile.pin && !checkPassword(v.pin || "", profile.pin)) {
      const attempts = profile.attempts + 1;
      db.prepare(
        "UPDATE profiles SET attempts=?,locked_until=? WHERE id=?",
      ).run(attempts, attempts >= 5 ? Date.now() + 900000 : 0, profile.id);
      return res.status(403).json({ error: "Incorrect profile PIN" });
    }
    db.prepare("UPDATE profiles SET attempts=0,locked_until=0 WHERE id=?").run(
      profile.id,
    );
    db.prepare("INSERT OR REPLACE INTO session_profiles VALUES(?,?)").run(
      req.sessionKey,
      profile.id,
    );
    res.json({ ok: true });
  });
  app.post("/api/platform/profiles/:id/pin", auth, (req, res) => {
    const v = z
      .object({
        pin: z.string().regex(/^\d{4,8}$/),
        password: z.string().max(1024),
      })
      .strict()
      .parse(req.body);
    const owner = db
      .prepare("SELECT password FROM users WHERE id=?")
      .get(req.user.id);
    if (!checkPassword(v.password, owner.password))
      return res.status(403).json({ error: "Account password required" });
    const p = db
      .prepare("SELECT id FROM profiles WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!p) return res.status(404).json({ error: "Profile not found" });
    db.prepare(
      "UPDATE profiles SET pin=?,attempts=0,locked_until=0 WHERE id=?",
    ).run(hashPassword(v.pin), p.id);
    audit(db, req.user.id, "profile.pin.changed", p.id);
    res.json({ ok: true });
  });
  app.get("/api/platform/sessions", auth, (req, res) =>
    res.json({
      items: db
        .prepare("SELECT token,expires FROM sessions WHERE user_id=?")
        .all(req.user.id)
        .map((s) => ({
          id: s.token,
          expires: s.expires,
          current: s.token === req.sessionKey,
        })),
    }),
  );
  app.post("/api/platform/sessions/:id/revoke", auth, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=? AND user_id=?").run(
      req.params.id,
      req.user.id,
    );
    res.json({ ok: true });
  });
  app.post("/api/platform/account/delete", auth, (req, res) => {
    const v = z.object({ password: z.string().max(1024) }).parse(req.body);
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
    if (user.role === "owner")
      return res
        .status(409)
        .json({
          error:
            "Owner deletion requires a documented ownership transfer before removal",
        });
    if (!checkPassword(v.password, user.password))
      return res.status(403).json({ error: "Account password required" });
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("DELETE FROM grants WHERE user_id=?").run(user.id);
      db.prepare("DELETE FROM watchlist WHERE user_id=?").run(user.id);
      db.prepare("DELETE FROM progress WHERE user_id=?").run(user.id);
      db.prepare("DELETE FROM users WHERE id=?").run(user.id);
      audit(db, "deleted-user", "account.deleted", null);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.clearCookie("flixora_session", { path: "/" }).json({ ok: true });
  });
}
