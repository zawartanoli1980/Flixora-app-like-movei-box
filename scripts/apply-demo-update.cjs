// Offline update helper: preserves local accounts, uploads, .env and npm approvals.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const readline = require("node:readline/promises");
const { spawnSync } = require("node:child_process");
function isProject(root) {
  return (
    fs.existsSync(path.join(root, "package.json")) &&
    fs.existsSync(path.join(root, "server", "platform", "index.js"))
  );
}
function discoverProjects(home = os.homedir()) {
  const results = [];
  for (const entry of fs.readdirSync(home, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/flixora/i.test(entry.name)) continue;
    const first = path.join(home, entry.name);
    if (isProject(first)) results.push(first);
    for (const child of fs.readdirSync(first, { withFileTypes: true })) {
      if (child.isDirectory() && isProject(path.join(first, child.name)))
        results.push(path.join(first, child.name));
    }
  }
  return [...new Set(results)].sort();
}
function applyUpdate(target, packageRoot) {
  target = fs.realpathSync(target);
  if (!isProject(target))
    throw Error(
      "Select the existing Flixora project folder containing package.json and server/platform/index.js.",
    );
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(packageRoot, "demo-update-manifest.json"),
      "utf8",
    ),
  );
  if (
    manifest.version !== 1 ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length
  )
    throw Error("Invalid update package");
  const allowed = [
    "server/platform/",
    "src/",
    "scripts/demo-catalog.mjs",
    "START-FLIXORA.cmd",
    "ADD-DEMO.cmd",
    "README.md",
    "docs/",
  ];
  for (const entry of manifest.files) {
    const name = entry.path;
    if (
      typeof name !== "string" ||
      name.includes("..") ||
      name.includes("\\") ||
      path.isAbsolute(name) ||
      !allowed.some(
        (prefix) =>
          name === prefix || (prefix.endsWith("/") && name.startsWith(prefix)),
      )
    )
      throw Error("Unexpected update path");
    const source = path.join(packageRoot, "payload", name);
    const bytes = fs.readFileSync(source);
    if (
      crypto.createHash("sha256").update(bytes).digest("hex") !== entry.sha256
    )
      throw Error("Update checksum failed: " + name);
    let directory = path.dirname(path.join(target, name));
    while (directory !== target) {
      if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink())
        throw Error("Update target contains a symlink: " + name);
      directory = path.dirname(directory);
    }
    if (
      fs.existsSync(path.join(target, name)) &&
      fs.lstatSync(path.join(target, name)).isSymbolicLink()
    )
      throw Error("Update file is a symlink: " + name);
  }
  const backup = path.join(
    target,
    ".flixora",
    "update-backups",
    crypto.randomUUID(),
  );
  fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
  for (const entry of manifest.files) {
    const destination = path.join(target, entry.path);
    if (fs.existsSync(destination)) {
      const saved = path.join(backup, entry.path);
      fs.mkdirSync(path.dirname(saved), { recursive: true });
      fs.copyFileSync(destination, saved);
    }
  }
  const packageFile = path.join(target, "package.json");
  fs.copyFileSync(packageFile, path.join(backup, "package.json"));
  for (const entry of manifest.files) {
    const destination = path.join(target, entry.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(packageRoot, "payload", entry.path), destination);
  }
  const config = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  config.scripts = {
    ...config.scripts,
    "demo:seed": "node --env-file-if-exists=.env scripts/demo-catalog.mjs seed",
    "demo:clear":
      "node --env-file-if-exists=.env scripts/demo-catalog.mjs clear",
    "demo:hide": "node --env-file-if-exists=.env scripts/demo-catalog.mjs hide",
  };
  fs.writeFileSync(packageFile, JSON.stringify(config, null, 2) + "\n");
  return { target, backup, files: manifest.files.length };
}
async function main() {
  const args = process.argv.slice(2);
  const packageRoot = __dirname;
  const specified = args.indexOf("--target");
  let target = specified >= 0 ? args[specified + 1] : null;
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    if (!target) {
      const candidates = discoverProjects();
      if (candidates.length === 1) target = candidates[0];
      else if (candidates.length > 1) {
        candidates.forEach((value, index) =>
          console.log(`${index + 1}. ${value}`),
        );
        const number = Number(
          await prompt.question("Existing Flixora project number: "),
        );
        target = candidates[number - 1];
        if (!target) throw Error("Invalid project selection");
      } else
        target = (
          await prompt.question("Existing Flixora project folder path: ")
        )
          .trim()
          .replace(/^"|"$/g, "");
      console.log("Updating: " + target);
      await prompt.question(
        "Close the old API and Vite server windows, then press Enter here. ",
      );
    }
  } finally {
    prompt.close();
  }
  const result = applyUpdate(target, packageRoot);
  console.log(
    `Updated ${result.files} code files. Previous files backed up to ${result.backup}`,
  );
  const seed = spawnSync(
    process.execPath,
    ["--env-file-if-exists=.env", "scripts/demo-catalog.mjs", "seed"],
    { cwd: result.target, stdio: "inherit" },
  );
  if (seed.status !== 0)
    throw Error("Demo seed did not complete. The update backup is retained.");
  console.log(
    "Your account database, private media and secret configuration were not replaced.",
  );
  if (!args.includes("--no-start") && process.platform === "win32") {
    const start = spawnSync("cmd.exe", ["/d", "/c", "START-FLIXORA.cmd"], {
      cwd: result.target,
      stdio: "inherit",
    });
    if (start.status !== 0)
      throw Error(
        "Open START-FLIXORA.cmd after closing any old server windows.",
      );
  }
}
module.exports = { applyUpdate, discoverProjects };
if (require.main === module)
  main().catch((error) => {
    console.error("Update failed: " + error.message);
    process.exitCode = 1;
  });
