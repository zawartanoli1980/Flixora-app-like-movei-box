import { resolve, relative, isAbsolute } from "node:path";
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { openStore } from "../server/platform/store.js";
const destination = process.argv[2];
if (!destination)
  throw Error(
    "Usage: node scripts/backup-platform.mjs /absolute/new-backup-directory (stop API first)",
  );
const { db, root } = openStore();
const output = resolve(destination),
  rel = relative(resolve(root), output);
if (!rel.startsWith("..") && !isAbsolute(rel))
  throw Error("Backup must be outside the data directory");
if (existsSync(output))
  throw Error("Destination already exists; refusing to overwrite");
mkdirSync(output, { recursive: true, mode: 0o700 });
try {
  db.prepare("VACUUM INTO ?").run(resolve(output, "platform.sqlite"));
  cpSync(resolve(root, "media"), resolve(output, "media"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  console.log(
    "Database and private media copied. Protect the backup as sensitive account data.",
  );
} finally {
  db.close();
}
