import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const { applyUpdate } = createRequire(import.meta.url)(
  "../scripts/apply-demo-update.cjs",
);
test("offline demo updater preserves local approvals, private media, credentials and owner DB", (t) => {
  const root = mkdtempSync(join(tmpdir(), "flixora-updater-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = join(root, "project"),
    bundle = join(root, "bundle");
  mkdirSync(join(target, "server", "platform"), { recursive: true });
  mkdirSync(join(target, ".flixora", "media"), { recursive: true });
  mkdirSync(join(bundle, "payload", "src"), { recursive: true });
  writeFileSync(
    join(target, "package.json"),
    JSON.stringify({
      name: "flixora",
      scripts: { api: "existing-command" },
      allowScripts: { "esbuild@0.28.2": true },
    }),
  );
  writeFileSync(
    join(target, "server", "platform", "index.js"),
    "existing server",
  );
  writeFileSync(join(target, ".env"), "PRIVATE_SETTING=local-only");
  writeFileSync(
    join(target, ".flixora", "platform.sqlite"),
    "existing owner database",
  );
  writeFileSync(
    join(target, ".flixora", "media", "owned.mp4"),
    "existing media",
  );
  mkdirSync(join(target, "src"));
  writeFileSync(join(target, "src", "Platform.jsx"), "old UI");
  writeFileSync(join(bundle, "payload", "src", "Platform.jsx"), "updated UI");
  const hash = createHash("sha256").update("updated UI").digest("hex");
  writeFileSync(
    join(bundle, "demo-update-manifest.json"),
    JSON.stringify({
      version: 1,
      files: [{ path: "src/Platform.jsx", sha256: hash }],
    }),
  );
  const result = applyUpdate(target, bundle);
  assert.equal(
    readFileSync(join(target, "src", "Platform.jsx"), "utf8"),
    "updated UI",
  );
  assert.equal(
    readFileSync(join(result.backup, "src", "Platform.jsx"), "utf8"),
    "old UI",
  );
  assert.equal(
    readFileSync(join(target, ".env"), "utf8"),
    "PRIVATE_SETTING=local-only",
  );
  assert.equal(
    readFileSync(join(target, ".flixora", "platform.sqlite"), "utf8"),
    "existing owner database",
  );
  assert.equal(
    readFileSync(join(target, ".flixora", "media", "owned.mp4"), "utf8"),
    "existing media",
  );
  const config = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
  assert.equal(config.allowScripts["esbuild@0.28.2"], true);
  assert.equal(config.scripts.api, "existing-command");
  assert.ok(config.scripts["demo:seed"]);
  writeFileSync(join(bundle, "payload", "src", "Platform.jsx"), "tampered");
  assert.throws(() => applyUpdate(target, bundle), /checksum failed/);
  assert.equal(
    readFileSync(join(target, "src", "Platform.jsx"), "utf8"),
    "updated UI",
  );
});
