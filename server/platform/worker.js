import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { audit } from "./store.js";
function run(command, args) {
  return new Promise((yes, no) => {
    const p = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    p.stdout.on("data", (x) => {
      if (output.length < 65536) output += x;
    });
    p.stderr.on("data", () => {});
    const timer = setTimeout(() => p.kill("SIGKILL"), 120000);
    p.on("error", no);
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? yes(output)
        : no(Error(`${command} validation failed (${code})`));
    });
  });
}
export function startWorker({ db, root }) {
  db.prepare("UPDATE jobs SET state='queued' WHERE state='running'").run();
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      // Rights enforcement also happens on every playback request.
      for (const row of db
        .prepare("SELECT * FROM content WHERE state='published'")
        .all())
        if (
          Date.parse(JSON.parse(row.data).rightsEnd) <= Date.now() ||
          (JSON.parse(row.data).kind !== "series" &&
            (!row.file || !existsSync(resolve(root, "media", row.file))))
        ) {
          db.prepare("UPDATE content SET state='archived' WHERE id=?").run(
            row.id,
          );
          audit(db, "worker", "availability.unpublished", row.id);
        }
      for (const row of db
        .prepare(
          "SELECT id FROM content WHERE state='published' AND file IS NOT NULL",
        )
        .all()) {
        const last = Number(
          db
            .prepare("SELECT value FROM settings WHERE key=?")
            .get("validated:" + row.id)?.value || 0,
        );
        if (last + 86400000 < Date.now()) {
          db.prepare(
            "UPDATE content SET state='processing',validated=0 WHERE id=?",
          ).run(row.id);
          db.prepare("INSERT INTO jobs VALUES(?,?,'queued',0,NULL,?)").run(
            randomUUID(),
            row.id,
            new Date().toISOString(),
          );
          audit(db, "worker", "availability.recheck", row.id);
        }
      }
      const job = db
        .prepare(
          "SELECT * FROM jobs WHERE state='queued' AND attempts<3 ORDER BY created LIMIT 1",
        )
        .get();
      if (!job) return;
      db.prepare(
        "UPDATE jobs SET state='running',attempts=attempts+1 WHERE id=?",
      ).run(job.id);
      try {
        const item = db
          .prepare("SELECT * FROM content WHERE id=?")
          .get(job.content_id);
        const file = resolve(root, "media", item.file);
        const info = JSON.parse(
          await run("ffprobe", [
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            file,
          ]),
        );
        if (
          !info.streams.some(
            (s) =>
              s.codec_type === "video" &&
              ["h264", "vp8", "vp9", "av1"].includes(s.codec_name),
          ) ||
          Number(info.format.duration) <= 0
        )
          throw Error(
            "A supported video track and positive duration are required",
          );
        await run("ffmpeg", [
          "-v",
          "error",
          "-i",
          file,
          "-t",
          "1",
          "-f",
          "null",
          "-",
        ]);
        await run("ffmpeg", [
          "-v",
          "error",
          "-y",
          "-i",
          file,
          "-frames:v",
          "1",
          "-vf",
          "scale=640:-2",
          file + ".jpg",
        ]);
        if (
          db.prepare("SELECT state FROM jobs WHERE id=?").get(job.id).state ===
          "canceled"
        )
          return;
        db.prepare(
          "UPDATE content SET state='review',validated=1 WHERE id=?",
        ).run(item.id);
        db.prepare(
          "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        ).run("validated:" + item.id, String(Date.now()));
        db.prepare(
          "UPDATE jobs SET state='completed',error=NULL WHERE id=?",
        ).run(job.id);
        audit(db, "worker", "media.validated", item.id);
      } catch (e) {
        db.prepare(
          "UPDATE jobs SET state='failed',error=? WHERE id=? AND state!='canceled'",
        ).run(e.message, job.id);
        db.prepare(
          "UPDATE content SET state='failed',validated=0 WHERE id=? AND state='processing'",
        ).run(job.content_id);
      }
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, 2000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
