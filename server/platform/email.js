import nodemailer from "nodemailer";
import { z } from "zod";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { hashPassword, audit } from "./store.js";
export function emailConfigured(env = process.env) {
  return Boolean(
    env.SMTP_HOST &&
    env.SMTP_USER &&
    env.SMTP_PASSWORD &&
    env.SMTP_FROM &&
    env.PUBLIC_APP_URL,
  );
}
export function createMailer(env = process.env) {
  if (!emailConfigured(env)) return null;
  const port = Number(env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
  });
  return async ({ email, purpose, token }) => {
    const url = new URL(env.PUBLIC_APP_URL);
    url.searchParams.set("action", purpose);
    url.searchParams.set("token", token);
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject:
        purpose === "verify"
          ? "Verify your Flixora email"
          : "Reset your Flixora password",
      text: `Open this link to ${purpose === "verify" ? "verify your email" : "reset your password"}: ${url}. The link expires in 30 minutes. If you did not request it, ignore this email.`,
    });
  };
}
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function registerEmail(app, { db, mailer, limiter }) {
  const credentials = z
    .object({
      email: z
        .string()
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(12).max(1024),
    })
    .strict();
  const available = (req, res, next) =>
    mailer
      ? next()
      : res
          .status(503)
          .json({
            error:
              "Setup required: configure a TLS SMTP service and PUBLIC_APP_URL for verification and password reset.",
          });
  const issue = async (user, purpose) => {
    const token = randomBytes(32).toString("hex");
    db.prepare(
      "DELETE FROM email_tokens WHERE expires<? OR (user_id=? AND purpose=?)",
    ).run(Date.now(), user.id, purpose);
    db.prepare("INSERT INTO email_tokens VALUES(?,?,?,?)").run(
      digest(token),
      user.id,
      purpose,
      Date.now() + 1800000,
    );
    await mailer({ email: user.email, purpose, token });
  };
  app.post(
    "/api/platform/register",
    limiter,
    available,
    async (req, res, next) => {
      try {
        const v = credentials.parse(req.body);
        let user = db.prepare("SELECT * FROM users WHERE email=?").get(v.email);
        if (!user) {
          const id = randomUUID();
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare("INSERT INTO users VALUES(?,?,?,?,0,?)").run(
              id,
              v.email,
              hashPassword(v.password),
              "customer",
              new Date().toISOString(),
            );
            db.prepare("INSERT INTO account_verification VALUES(?,0)").run(id);
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
          user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
          await issue(user, "verify");
        }
        res
          .status(202)
          .json({
            message:
              "If eligible, verification instructions have been emailed. Verify before signing in.",
          });
      } catch (e) {
        next(e);
      }
    },
  );
  for (const [path, purpose] of [
    ["/password/request", "reset"],
    ["/verification/request", "verify"],
  ])
    app.post(
      "/api/platform" + path,
      limiter,
      available,
      async (req, res, next) => {
        try {
          const v = z
            .object({
              email: z
                .string()
                .email()
                .max(254)
                .transform((x) => x.toLowerCase()),
            })
            .strict()
            .parse(req.body);
          const user = db
            .prepare("SELECT * FROM users WHERE email=? AND suspended=0")
            .get(v.email);
          if (
            user &&
            (purpose !== "verify" ||
              db
                .prepare(
                  "SELECT user_id FROM account_verification WHERE user_id=? AND verified=0",
                )
                .get(user.id))
          )
            await issue(user, purpose);
          res
            .status(202)
            .json({
              message:
                "If the account is eligible, instructions have been emailed.",
            });
        } catch (e) {
          next(e);
        }
      },
    );
  app.post("/api/platform/email/verify", limiter, (req, res) => {
    const { token } = z
      .object({ token: z.string().length(64) })
      .strict()
      .parse(req.body);
    const record = db
      .prepare(
        "SELECT * FROM email_tokens WHERE token=? AND purpose='verify' AND expires>?",
      )
      .get(digest(token), Date.now());
    if (!record)
      return res
        .status(400)
        .json({ error: "Invalid, expired or already used verification link" });
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "UPDATE account_verification SET verified=1 WHERE user_id=?",
      ).run(record.user_id);
      db.prepare("DELETE FROM email_tokens WHERE token=?").run(record.token);
      audit(db, record.user_id, "email.verified", record.user_id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ message: "Email verified. You can now sign in." });
  });
  app.post("/api/platform/password/reset", limiter, (req, res) => {
    const v = z
      .object({
        token: z.string().length(64),
        password: z.string().min(12).max(1024),
      })
      .strict()
      .parse(req.body);
    const record = db
      .prepare(
        "SELECT * FROM email_tokens WHERE token=? AND purpose='reset' AND expires>?",
      )
      .get(digest(v.token), Date.now());
    if (!record)
      return res
        .status(400)
        .json({ error: "Invalid, expired or already used reset link" });
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE users SET password=? WHERE id=?").run(
        hashPassword(v.password),
        record.user_id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(record.user_id);
      db.prepare("DELETE FROM email_tokens WHERE user_id=?").run(
        record.user_id,
      );
      audit(db, record.user_id, "password.reset", record.user_id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ message: "Password changed. All sessions have been revoked." });
  });
}
