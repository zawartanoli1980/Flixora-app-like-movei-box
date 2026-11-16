import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { hashPassword, audit } from "./store.js";
export function googleConfigured(env = process.env) {
  return Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI,
  );
}
export function registerGoogle(
  app,
  { db, session, secureCookies, env = process.env },
) {
  const jwks = createRemoteJWKSet(
    new URL("https://www.googleapis.com/oauth2/v3/certs"),
  );
  app.get("/api/platform/auth/google", (_req, res) => {
    if (!googleConfigured(env))
      return res
        .status(503)
        .json({
          error:
            "Setup required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI must be configured server-side.",
        });
    const state = randomBytes(32).toString("hex"),
      nonce = randomBytes(32).toString("hex"),
      verifier = randomBytes(48).toString("base64url");
    db.prepare("DELETE FROM oauth_states WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO oauth_states VALUES(?,?,?,?)").run(
      state,
      nonce,
      verifier,
      Date.now() + 600000,
    );
    res.cookie("flixora_oauth", state, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "lax",
      maxAge: 600000,
      path: "/api/platform/auth",
    });
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    });
    res.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params);
  });
  app.get("/api/platform/auth/google/callback", async (req, res, next) => {
    try {
      if (!googleConfigured(env))
        return res
          .status(503)
          .json({ error: "Google sign-in is not configured" });
      const state = String(req.query.state || "");
      const browserState = req.headers.cookie
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("flixora_oauth="))
        ?.slice(14);
      const pending = db
        .prepare("SELECT * FROM oauth_states WHERE state=? AND expires>?")
        .get(state, Date.now());
      if (
        !pending ||
        browserState !== state ||
        typeof req.query.code !== "string"
      )
        return res
          .status(400)
          .json({ error: "Invalid or expired Google sign-in session" });
      db.prepare("DELETE FROM oauth_states WHERE state=?").run(state);
      res.clearCookie("flixora_oauth", { path: "/api/platform/auth" });
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.GOOGLE_REDIRECT_URI,
          code: req.query.code,
          code_verifier: pending.verifier,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw Object.assign(Error("Google token exchange failed"), {
          status: 502,
        });
      const tokens = await response.json();
      const { payload } = await jwtVerify(tokens.id_token, jwks, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: env.GOOGLE_CLIENT_ID,
        algorithms: ["RS256"],
      });
      if (
        payload.nonce !== pending.nonce ||
        payload.email_verified !== true ||
        !payload.sub ||
        typeof payload.email !== "string"
      )
        throw Object.assign(Error("Google identity verification failed"), {
          status: 401,
        });
      let identity = db
          .prepare("SELECT user_id FROM identities WHERE subject=?")
          .get(payload.sub),
        user;
      if (identity)
        user = db
          .prepare("SELECT * FROM users WHERE id=?")
          .get(identity.user_id);
      else {
        if (
          db
            .prepare("SELECT id FROM users WHERE email=?")
            .get(payload.email.toLowerCase())
        )
          return res
            .status(409)
            .json({
              error:
                "An account with this email exists. Sign in with its existing method; automatic account linking is disabled.",
            });
        const id = randomUUID();
        db.exec("BEGIN IMMEDIATE");
        try {
          db.prepare("INSERT INTO users VALUES(?,?,?,?,0,?)").run(
            id,
            payload.email.toLowerCase(),
            hashPassword(randomBytes(48).toString("hex")),
            "customer",
            new Date().toISOString(),
          );
          db.prepare("INSERT INTO identities VALUES(?,?)").run(payload.sub, id);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
        user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
        audit(db, id, "google.registered", id);
      }
      if (!user || user.suspended)
        return res.status(403).json({ error: "Account unavailable" });
      session(user, res, "/");
    } catch (e) {
      next(e);
    }
  });
}
