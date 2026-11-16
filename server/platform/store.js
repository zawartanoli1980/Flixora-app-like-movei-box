import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
export const sections = {
  movies: "Movies",
  drama: "Drama series",
  tv: "Other TV series",
  anime: "Anime",
  cartoons: "Cartoons",
  cricket: "Cricket",
  sports: "Other sports",
  videos: "Other videos",
};
export function openStore(
  root = process.env.PLATFORM_DATA_DIR || resolve(".flixora"),
) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  mkdirSync(resolve(root, "media"), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolve(root, "platform.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL)",
  );
  const directory = new URL("../../db/migrations/", import.meta.url);
  for (const name of readdirSync(directory)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort()) {
    const sql = readFileSync(new URL(name, directory), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = db
      .prepare("SELECT checksum FROM schema_migrations WHERE name=?")
      .get(name);
    if (applied) {
      if (applied.checksum !== checksum)
        throw Error("Applied migration was modified: " + name);
      continue;
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(
        name,
        checksum,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  return { db, root };
}
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function checkPassword(password, hash) {
  const [salt, value] = hash.split(":");
  const actual = scryptSync(password, salt, 64);
  return (
    value?.length === 128 && timingSafeEqual(actual, Buffer.from(value, "hex"))
  );
}
export function createOwner(db, email, password) {
  if (
    typeof email !== "string" ||
    !email.includes("@") ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 1024
  )
    throw Error("Valid email and password of at least 12 characters required");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (db.prepare("SELECT id FROM users WHERE role='owner'").get())
      throw Error("Owner already exists");
    const id = randomUUID();
    db.prepare("INSERT INTO users VALUES(?,?,?,?,0,?)").run(
      id,
      email.toLowerCase(),
      hashPassword(password),
      "owner",
      new Date().toISOString(),
    );
    audit(db, id, "owner.bootstrapped", id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function audit(db, actor, action, target) {
  db.prepare(
    "INSERT INTO audit(actor,action,target,created) VALUES(?,?,?,?)",
  ).run(actor, action, target, new Date().toISOString());
}
export function eligible(item, user, db, country) {
  const config = JSON.parse(
    db.prepare("SELECT value FROM settings WHERE key='platform'").get()
      ?.value || "{}",
  );
  if (config.maintenance) return false;
  const d = typeof item.data === "string" ? JSON.parse(item.data) : item.data;
  const now = Date.now();
  if (
    item.state !== "published" ||
    (d.kind !== "series" && (!item.validated || !item.file))
  )
    return false;
  if (
    !d.authorized ||
    Date.parse(d.rightsStart) > now ||
    Date.parse(d.rightsEnd) <= now
  )
    return false;
  if (d.regions?.length && (!country || !d.regions.includes(country)))
    return false;
  if (
    (config.mode === "premium" || (config.mode !== "free" && d.premium)) &&
    !db
      .prepare(
        "SELECT id FROM grants WHERE user_id=? AND revoked=0 AND expires>?",
      )
      .get(user?.id || "", now)
  )
    return false;
  return true;
}
