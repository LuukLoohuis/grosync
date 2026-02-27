import type { VercelRequest, VercelResponse } from "@vercel/node";
import { OAuth2Client } from "google-auth-library";
import { SignJWT } from "jose";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie || "";
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function setCookie(res: VercelResponse, cookie: string) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", cookie);
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, cookie]);
  else res.setHeader("Set-Cookie", [prev as string, cookie]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const APP_URL = getEnv("APP_URL").replace(/\/$/, "");
    const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = getEnv("GOOGLE_CLIENT_SECRET");
    const SESSION_SECRET = getEnv("SESSION_SECRET");

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    if (!code || !state) return res.status(400).send("Missing code/state");

    const cookies = parseCookies(req);
    if (!cookies.oauth_state || cookies.oauth_state !== state) {
      return res.status(400).send("Invalid state");
    }

    const secure = APP_URL.startsWith("https://");
    setCookie(
      res,
      [
        "oauth_state=",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        secure ? "Secure" : "",
        "Max-Age=0",
      ]
        .filter(Boolean)
        .join("; ")
    );

    const redirectUri = `${APP_URL}/api/auth/callback`;

    const oauth = new OAuth2Client({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      redirectUri,
    });

    const { tokens } = await oauth.getToken(code);
    if (!tokens.id_token) return res.status(400).send("No id_token from Google");

    const ticket = await oauth.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(400).send("Invalid token payload");

    const user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    const secretKey = new TextEncoder().encode(SESSION_SECRET);
    const jwt = await new SignJWT({ user })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secretKey);

    setCookie(
      res,
      [
        `session=${encodeURIComponent(jwt)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        secure ? "Secure" : "",
        "Max-Age=604800",
      ]
        .filter(Boolean)
        .join("; ")
    );

    res.status(302).setHeader("Location", `${APP_URL}/`).end();
  } catch (e: any) {
    res.status(500).send(e?.message ?? "Auth callback error");
  }
}
