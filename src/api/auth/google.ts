import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function setCookie(res: VercelResponse, cookie: string) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", cookie);
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, cookie]);
  else res.setHeader("Set-Cookie", [prev as string, cookie]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const APP_URL = getEnv("APP_URL");
    const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID");

    const redirectUri = `${APP_URL.replace(/\/$/, "")}/api/auth/callback`;

    const state = crypto.randomBytes(16).toString("hex");

    const secure = APP_URL.startsWith("https://");
    setCookie(
      res,
      [
        `oauth_state=${state}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        secure ? "Secure" : "",
        "Max-Age=600",
      ]
        .filter(Boolean)
        .join("; ")
    );

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.status(302).setHeader("Location", authUrl).end();
  } catch (e: any) {
    res.status(500).send(e?.message ?? "Auth init error");
  }
}
