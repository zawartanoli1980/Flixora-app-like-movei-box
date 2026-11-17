import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { openStore, createOwner, eligible } from "./platform/store.js";
import { createPlatformApp, metadata } from "./platform/app.js";
import { startWorker } from "./platform/worker.js";
import { safeStorageFile, startImportWorker } from "./platform/imports.js";
const data = {
  title: "Authorized test asset",
  description: "Test-only upload; not seeded into the application",
  section: "movies",
  kind: "movie",
  language: "en",
  rightsStart: "2020-01-01T00:00:00.000Z",
  rightsEnd: "2099-01-01T00:00:00.000Z",
  license: "Test fixture authorization",
  authorized: true,
  premium: false,
};
async function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), "flixora-test-"));
  const store = openStore(root);
  createOwner(store.db, "owner@example.test", "test-password-long");
  const server = createPlatformApp({
    ...store,
    secureCookies: false,
    ...options,
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  let cookie = "";
  const call = async (path, body, options = {}) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/platform${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(cookie ? { cookie } : {}),
          ...options.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        ...options,
      },
    );
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const login = async (
    email = "owner@example.test",
    password = "test-password-long",
  ) => {
    const r = await call("/login", { email, password });
    cookie = r.cookie || "";
    return r;
  };
  t.after(
    () =>
      new Promise((r) =>
        server.close(() => {
          store.db.close();
          rmSync(root, { recursive: true, force: true });
          r();
        }),
      ),
  );
  return {
    ...store,
    call,
    login,
    base: "http://127.0.0.1:" + server.address().port,
    getCookie: () => cookie,
    setCookie: (x) => (cookie = x),
  };
}
test("platform starts with honest empty libraries and rejects fake payment events", async (t) => {
  const f = await fixture(t);
  assert.deepEqual((await f.call("/catalog")).data.items, []);
  assert.equal((await f.call("/admin/content")).status, 401);
  assert.equal((await f.call("/checkout", {})).status, 503);
  assert.equal(
    (await f.call("/webhooks/jazzcash", { status: "success" })).status,
    503,
  );
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM grants").get().n, 0);
  assert.equal((await f.call("/catalog?section=invalid")).status, 400);
});
test("public registration cannot create an administrator; owner is unique", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.call("/register", { email: "bad@example.test", role: "owner" }))
      .status,
    503,
  );
  assert.throws(() =>
    createOwner(f.db, "other@example.test", "long-password-123"),
  );
  await f.login();
  assert.equal(
    (
      await f.call("/admin/users", {
        email: "customer@example.test",
        password: "customer-password",
        role: "customer",
      })
    ).status,
    201,
  );
  await f.login("customer@example.test", "customer-password");
  assert.equal((await f.call("/admin/content")).status, 403);
  assert.equal(
    (
      await f.call("/admin/users", {
        email: "bad@example.test",
        password: "long-password-123",
        role: "administrator",
      })
    ).status,
    403,
  );
});
test("category isolation, duplicate detection and episode ownership", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.call("/admin/content", {
    ...data,
    section: "anime",
    providerId: "source:anime-1",
  });
  assert.equal(a.status, 201);
  assert.equal(
    (await f.call("/admin/content", { ...data, providerId: "source:anime-1" }))
      .status,
    409,
  );
  assert.equal(
    (await f.call("/admin/content", { ...data, section: "invented" })).status,
    400,
  );
  const series = await f.call("/admin/content", {
    ...data,
    section: "drama",
    kind: "series",
  });
  assert.equal(
    (
      await f.call("/admin/content", {
        ...data,
        section: "tv",
        kind: "episode",
        parentId: series.data.id,
        season: 1,
        episode: 1,
      })
    ).status,
    400,
  );
  f.db
    .prepare("UPDATE content SET state='published' WHERE id=?")
    .run(a.data.id);
  assert.equal((await f.call("/catalog?section=movies")).data.items.length, 0);
  assert.equal((await f.call("/catalog?section=anime")).data.items.length, 1);
});
test("publish gate blocks metadata-only titles and expired rights", async (t) => {
  const f = await fixture(t);
  await f.login();
  const c = await f.call("/admin/content", data);
  assert.equal(
    (
      await f.call("/admin/content/" + c.data.id + "/state", {
        state: "published",
      })
    ).status,
    409,
  );
  assert.equal((await f.call("/media/" + c.data.id)).status, 403);
});
test("resumable uploads validate offsets, process real media, publish, and stream with ranges", async (t) => {
  const f = await fixture(t);
  await f.login();
  const c = (await f.call("/admin/content", data)).data;
  const video = join(f.root, "fixture.mp4");
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=32x32:d=1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    video,
  ]);
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(video);
  const u = (
    await f.call("/admin/content/" + c.id + "/upload", {
      size: bytes.length,
      extension: "mp4",
    })
  ).data;
  assert.equal(
    (await f.call("/admin/uploads/" + u.id + "/complete", {})).status,
    409,
  );
  const send = async (offset, chunk) =>
    f.call("/admin/uploads/" + u.id, undefined, {
      method: "PUT",
      headers: {
        cookie: (await f.login()).cookie,
        "content-type": "application/octet-stream",
        "upload-offset": String(offset),
      },
      body: chunk,
    });
  assert.equal((await send(4, bytes.subarray(0, 100))).status, 409);
  assert.equal((await send(0, bytes.subarray(0, 100))).data.offset, 100);
  assert.equal((await f.call("/admin/uploads")).data.items[0].offset, 100);
  assert.equal(
    (await send(100, bytes.subarray(100))).data.offset,
    bytes.length,
  );
  assert.equal(
    (await f.call("/admin/uploads/" + u.id + "/complete", {})).status,
    202,
  );
  const stop = startWorker(f);
  t.after(stop);
  for (let i = 0; i < 50; i++) {
    if (
      f.db.prepare("SELECT validated FROM content WHERE id=?").get(c.id)
        .validated
    )
      break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(
    f.db.prepare("SELECT state FROM content WHERE id=?").get(c.id).state,
    "review",
  );
  assert.equal(
    (await f.call("/admin/content/" + c.id + "/state", { state: "published" }))
      .status,
    200,
  );
  assert.equal((await f.call("/catalog?section=movies")).data.items.length, 1);
  const stream = await fetch(f.base + "/api/platform/media/" + c.id, {
    headers: { cookie: f.getCookie(), range: "bytes=0-99" },
  });
  assert.equal(stream.status, 206);
  assert.equal((await stream.arrayBuffer()).byteLength, 100);
  assert.match(stream.headers.get("content-range"), /^bytes 0-99\//);
});
test("premium access expires, revokes immediately, and is region restricted", async (t) => {
  const f = await fixture(t);
  await f.login();
  const user = f.db.prepare("SELECT id FROM users WHERE role='owner'").get();
  const c = (
    await f.call("/admin/content", { ...data, premium: true, regions: ["PK"] })
  ).data;
  f.db
    .prepare(
      "UPDATE content SET state='published',validated=1,file='test.mp4' WHERE id=?",
    )
    .run(c.id);
  const item = f.db.prepare("SELECT * FROM content WHERE id=?").get(c.id);
  assert.equal(eligible(item, user, f.db, "PK"), false);
  const grant = (
    await f.call("/admin/grants", {
      userId: user.id,
      expires: new Date(Date.now() + 60000).toISOString(),
    })
  ).data;
  assert.equal(eligible(item, user, f.db, "PK"), true);
  assert.equal(eligible(item, user, f.db, "US"), false);
  await f.call("/admin/grants/" + grant.id + "/revoke", {});
  assert.equal(eligible(item, user, f.db, "PK"), false);
  f.db.prepare("UPDATE grants SET revoked=0,expires=?").run(Date.now() - 1);
  assert.equal(eligible(item, user, f.db, "PK"), false);
});
test("suspending a customer revokes their session", async (t) => {
  const f = await fixture(t);
  await f.login();
  const u = (
    await f.call("/admin/users", {
      email: "viewer@example.test",
      password: "viewer-password-123",
      role: "customer",
    })
  ).data;
  const viewer = await f.login("viewer@example.test", "viewer-password-123");
  await f.login();
  await f.call("/admin/users/" + u.id + "/suspend", {});
  f.setCookie(viewer.cookie);
  assert.equal((await f.call("/library")).status, 401);
});
test("storage imports reject remote URLs, traversal, and symlink escapes", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "flixora-storage-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "media"));
  writeFileSync(join(root, "secret"), "x");
  symlinkSync(join(root, "secret"), join(root, "media", "escape"));
  assert.throws(() => safeStorageFile(join(root, "media"), "../secret"));
  assert.throws(() => safeStorageFile(join(root, "media"), "escape"));
  assert.throws(() =>
    safeStorageFile(join(root, "media"), "https://example.com/video.mp4"),
  );
});
test("authorized metadata imports checkpoint, detect duplicates and queue ambiguous categories", async (t) => {
  const f = await fixture(t);
  const prev = process.env.AUTHORIZED_IMPORT_ROOT;
  process.env.AUTHORIZED_IMPORT_ROOT = f.root;
  t.after(() => {
    if (prev) process.env.AUTHORIZED_IMPORT_ROOT = prev;
    else delete process.env.AUTHORIZED_IMPORT_ROOT;
  });
  writeFileSync(
    join(f.root, "catalog.json"),
    JSON.stringify([
      { metadata: { ...data, providerId: "one" } },
      { metadata: { ...data, providerId: "one" } },
      { metadata: { ...data, section: undefined, providerId: "two" } },
    ]),
  );
  await f.login();
  const source = (
    await f.call("/admin/sources", {
      name: "Authorized test storage",
      section: null,
      authorized: true,
    })
  ).data;
  await f.call("/admin/sources/" + source.id + "/import", {});
  const stop = startImportWorker(f, metadata);
  t.after(stop);
  for (let i = 0; i < 60; i++) {
    if (
      f.db.prepare("SELECT state FROM import_runs").get()?.state === "completed"
    )
      break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const run = f.db.prepare("SELECT * FROM import_runs").get();
  assert.equal(run.state, "completed");
  assert.equal(run.imported, 1);
  assert.equal(run.duplicates, 1);
  assert.equal(run.review, 1);
  assert.equal((await f.call("/catalog")).data.items.length, 0);
});
test("Google sign-in fails closed without required credentials", async (t) => {
  const f = await fixture(t);
  if (!process.env.GOOGLE_CLIENT_ID)
    assert.equal((await f.call("/auth/google")).status, 503);
  assert.equal(
    (await f.call("/auth/google/callback?code=forged&state=invalid")).status,
    process.env.GOOGLE_CLIENT_ID ? 400 : 503,
  );
});
test("kids profiles isolate history and enforce maturity on direct playback requests", async (t) => {
  const f = await fixture(t);
  await f.login();
  const adult = (await f.call("/profiles")).data.active;
  const item = (await f.call("/admin/content", data)).data;
  await f.call("/library/" + item.id, { listed: true, position: 25 });
  const kid = (
    await f.call("/profiles", {
      name: "Kids",
      kids: true,
      maxAge: 12,
      password: "test-password-long",
    })
  ).data;
  assert.ok(kid.id);
  await f.call("/profiles/" + kid.id + "/select", {});
  assert.equal((await f.call("/library")).data.watchlist.length, 0);
  assert.equal(
    (await f.call("/library/" + item.id, { position: 10 })).status,
    403,
  );
  assert.equal((await f.call("/media/" + item.id)).status, 403);
  await f.call("/profiles/" + adult.id + "/select", {});
  assert.equal((await f.call("/library")).data.progress[0].position, 25);
  assert.equal(
    (
      await f.call("/profiles", {
        name: "Invalid kids",
        kids: true,
        maxAge: 18,
        password: "test-password-long",
      })
    ).status,
    400,
  );
});
test("PIN switching locks after repeated failed attempts and cannot expose password hashes", async (t) => {
  const f = await fixture(t);
  await f.login();
  const profile = (await f.call("/profiles")).data.active;
  await f.call("/profiles/" + profile.id + "/pin", {
    password: "test-password-long",
    pin: "7492",
  });
  const list = (await f.call("/profiles")).data;
  assert.equal(list.items[0].pin, undefined);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await f.call("/profiles/" + profile.id + "/select", { pin: "0000" }))
        .status,
      403,
    );
  assert.equal(
    (await f.call("/profiles/" + profile.id + "/select", { pin: "7492" }))
      .status,
    429,
  );
});
test("platform modes, maintenance, and immutable prepaid definitions persist", async (t) => {
  const f = await fixture(t);
  await f.login();
  const settings = (await f.call("/settings")).data;
  assert.equal(
    (await f.call("/admin/settings", { ...settings, mode: "free" })).status,
    200,
  );
  assert.equal((await f.call("/settings")).data.mode, "free");
  assert.equal(
    (
      await f.call("/admin/plans", {
        name: "Prepaid",
        amountMinor: 999,
        currency: "PKR",
        days: 30,
        quality: "source",
        devices: 1,
        streams: 1,
        enabled: true,
      })
    ).status,
    201,
  );
  const plan = (await f.call("/plans")).data;
  assert.equal(plan.checkoutAvailable, false);
  assert.equal(plan.items[0].billing, "prepaid");
  assert.equal(
    (await f.call("/checkout", { planId: plan.items[0].id })).status,
    503,
  );
  await f.call("/admin/settings", { ...settings, maintenance: true });
  assert.equal((await f.call("/catalog")).status, 503);
});
test("email verification and single-use reset enforce customer roles and revoke sessions", async (t) => {
  const messages = [];
  const f = await fixture(t, {
    mailer: async (message) => messages.push(message),
  });
  assert.equal(
    (
      await f.call("/register", {
        email: "new@example.test",
        password: "new-password-long",
        role: "owner",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call("/register", {
        email: "new@example.test",
        password: "new-password-long",
      })
    ).status,
    202,
  );
  assert.equal(
    (await f.login("new@example.test", "new-password-long")).status,
    401,
  );
  const token = messages[0].token;
  assert.equal((await f.call("/email/verify", { token })).status, 200);
  assert.equal((await f.call("/email/verify", { token })).status, 400);
  assert.equal(
    (await f.login("new@example.test", "new-password-long")).data.user.role,
    "customer",
  );
  await f.call("/password/request", { email: "new@example.test" });
  const reset = messages.at(-1).token;
  assert.equal(
    (
      await f.call("/password/reset", {
        token: reset,
        password: "replacement-password",
      })
    ).status,
    200,
  );
  assert.equal((await f.call("/library")).status, 401);
  assert.equal(
    (
      await f.call("/password/reset", {
        token: reset,
        password: "replacement-password",
      })
    ).status,
    400,
  );
  assert.equal(
    (await f.login("new@example.test", "replacement-password")).status,
    200,
  );
});

test("series are metadata containers; episodes stay nested and inherit parent publication", async (t) => {
  const f = await fixture(t);
  await f.login();
  const parent = (
    await f.call("/admin/content", {
      ...data,
      section: "drama",
      kind: "series",
    })
  ).data;
  assert.equal(
    (
      await f.call("/admin/content/" + parent.id + "/state", {
        state: "published",
      })
    ).status,
    200,
  );
  assert.equal((await f.call("/media/" + parent.id)).status, 409);
  const episode = (
    await f.call("/admin/content", {
      ...data,
      section: "drama",
      kind: "episode",
      parentId: parent.id,
      season: 1,
      episode: 1,
    })
  ).data;
  f.db
    .prepare(
      "UPDATE content SET validated=1,state='published',file='fixture.mp4' WHERE id=?",
    )
    .run(episode.id);
  assert.equal((await f.call("/catalog?section=drama")).data.items.length, 1);
  assert.equal(
    (await f.call("/series/" + parent.id + "/episodes")).data.items[0].id,
    episode.id,
  );
  assert.equal(
    (
      await f.call(
        "/admin/content/" + parent.id,
        { ...data, section: "anime", kind: "series" },
        {
          method: "PUT",
          headers: {
            cookie: f.getCookie(),
            "content-type": "application/json",
          },
          body: JSON.stringify({ ...data, section: "anime", kind: "series" }),
        },
      )
    ).status,
    200,
  );
  const child = f.db
    .prepare("SELECT * FROM content WHERE id=?")
    .get(episode.id);
  assert.equal(child.section, "anime");
  assert.equal(child.state, "review");
  assert.equal(JSON.parse(child.data).section, "anime");
});

test("backup helper preserves users and schema migrations in an isolated restore", async (t) => {
  const parent = mkdtempSync(join(tmpdir(), "flixora-backup-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const source = join(parent, "source");
  const s = openStore(source);
  createOwner(s.db, "restore@example.test", "restore-password-123");
  s.db.close();
  const destination = join(parent, "snapshot");
  execFileSync(process.execPath, ["scripts/backup-platform.mjs", destination], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PLATFORM_DATA_DIR: source },
  });
  const restored = openStore(destination);
  assert.equal(
    restored.db.prepare("SELECT email FROM users").get().email,
    "restore@example.test",
  );
  assert.equal(
    restored.db.prepare("SELECT COUNT(*) n FROM schema_migrations").get().n,
    1,
  );
  restored.db.close();
});

test("demo catalog is opt-in, idempotent and isolated from real records", async (t) => {
  const f = await fixture(t);
  await f.login();
  const original = (await f.call("/admin/content", data)).data;
  const userCount = f.db.prepare("SELECT COUNT(*) n FROM users").get().n;
  assert.equal((await f.call("/admin/demo")).data.installed, false);
  const first = await f.call("/admin/demo", { action: "seed" });
  assert.equal(first.status, 200);
  assert.equal(first.data.titleCount, 800);
  assert.equal(first.data.episodeCount, 1800);
  const catalog = (await f.call("/catalog")).data;
  assert.equal(catalog.items.length, 800);
  assert.equal(new Set(catalog.items.map((i) => i.id)).size, 800);
  assert.ok(
    catalog.items.every(
      (i) =>
        i.demo &&
        i.state === "demo" &&
        !i.validated &&
        i.data.authorized === false &&
        !i.file,
    ),
  );
  await f.call("/admin/demo", { action: "seed" });
  assert.deepEqual(
    (await f.call("/catalog")).data.items.map((i) => i.id),
    catalog.items.map((i) => i.id),
  );
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM content").get().n, 1);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM users").get().n, userCount);
  assert.equal((await f.call("/admin/overview")).data.coverage.length, 0);
  await f.call("/admin/demo", { action: "hide" });
  assert.equal((await f.call("/catalog")).data.items.length, 0);
  assert.equal((await f.call("/admin/demo")).data.titleCount, 800);
  await f.call("/admin/demo", { action: "show" });
  assert.equal((await f.call("/catalog")).data.items.length, 800);
  await f.call("/admin/demo", { action: "clear" });
  assert.equal((await f.call("/catalog")).data.items.length, 0);
  assert.equal(
    f.db.prepare("SELECT title FROM content WHERE id=?").get(original.id).title,
    data.title,
  );
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM grants").get().n, 0);
});

test("only owner settings permission can create or remove demo previews", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("/admin/demo", { action: "seed" })).status, 401);
  await f.login();
  await f.call("/admin/users", {
    email: "demo-manager@example.test",
    password: "manager-password-123",
    role: "content_manager",
  });
  await f.login("demo-manager@example.test", "manager-password-123");
  assert.equal((await f.call("/admin/demo")).status, 403);
  assert.equal((await f.call("/admin/demo", { action: "seed" })).status, 403);
  await f.login();
  assert.equal(
    (await f.call("/admin/demo", { action: "invalid" })).status,
    400,
  );
});

test("demo sections, real search filters and nested sample episodes stay consistent", async (t) => {
  const f = await fixture(t);
  await f.login();
  await f.call("/admin/demo", { action: "seed" });
  for (const section of [
    "movies",
    "drama",
    "tv",
    "anime",
    "cartoons",
    "cricket",
    "sports",
    "videos",
  ]) {
    const items = (await f.call("/catalog?section=" + section)).data.items;
    assert.equal(items.length, 100);
    assert.equal(new Set(items.map((item) => item.title)).size, 100);
    assert.ok(
      items.every(
        (item) => item.section === section && item.data.section === section,
      ),
    );
  }
  const filtered = (
    await f.call(
      "/catalog?section=movies&q=Amber%20Horizon&language=en&year=2018&country=US&genre=Adventure",
    )
  ).data.items;
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "demo-movies-01");
  const preview = (await f.call("/demo/demo-drama-01")).data;
  assert.equal(preview.episodes.length, 6);
  assert.deepEqual(
    [...new Set(preview.episodes.map((e) => e.data.season))],
    [1, 2],
  );
  assert.ok(
    preview.episodes.every(
      (e) =>
        e.section === "drama" && e.data.parentId === preview.item.id && e.demo,
    ),
  );
});

test("demo metadata never becomes a playable video or real viewing history", async (t) => {
  const f = await fixture(t);
  await f.login();
  await f.call("/admin/demo", { action: "seed" });
  assert.equal((await f.call("/media/demo-movies-01")).status, 409);
  assert.equal((await f.call("/media/demo-drama-01-s1-e1")).status, 409);
  assert.equal(
    (await f.call("/library/demo-movies-01", { listed: true })).status,
    409,
  );
  assert.equal(
    (
      await f.call("/admin/content/demo-movies-01/state", {
        state: "published",
      })
    ).status,
    404,
  );
  assert.equal((await f.call("/library")).data.progress.length, 0);
  assert.equal(
    (await f.call("/checkout", { demoId: "demo-movies-01" })).status,
    503,
  );
});

test("Kids maturity restrictions also apply to demo previews and direct preview requests", async (t) => {
  const f = await fixture(t);
  await f.login();
  await f.call("/admin/demo", { action: "seed" });
  const kid = (
    await f.call("/profiles", {
      name: "Demo Kids",
      kids: true,
      maxAge: 7,
      password: "test-password-long",
    })
  ).data;
  await f.call("/profiles/" + kid.id + "/select", {});
  assert.ok(
    (await f.call("/catalog")).data.items.every((i) => i.data.ageRating <= 7),
  );
  assert.equal((await f.call("/catalog?section=drama")).data.items.length, 0);
  assert.equal((await f.call("/demo/demo-drama-01")).status, 404);
  assert.equal((await f.call("/demo/demo-cartoons-01")).status, 200);
});
