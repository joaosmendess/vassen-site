/* Login do painel: uma senha (ADMIN_PASSWORD) e um cookie assinado com SESSION_SECRET.
   As duas ficam nas variáveis secretas do projeto na Cloudflare, nunca no código. */

const COOKIE = "vassen_admin";
const DAYS = 7;
const enc = new TextEncoder();

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret, msg){
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

function sameString(a, b){
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function configured(env){
  return Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET && env.CONTENT);
}

export async function checkPassword(env, password){
  const [a, b] = await Promise.all([String(password || ""), env.ADMIN_PASSWORD].map((v) => crypto.subtle.digest("SHA-256", enc.encode(v))));
  return sameString(b64url(a), b64url(b));
}

export async function sessionCookie(env){
  const exp = String(Date.now() + DAYS * 864e5);
  return `${COOKIE}=${exp}.${await hmac(env.SESSION_SECRET, exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAYS * 86400}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAuthed(request, env){
  if (!configured(env)) return false;
  const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=(\\d+)\\.([\\w-]+)"));
  if (!m || Number(m[1]) < Date.now()) return false;
  return sameString(m[2], await hmac(env.SESSION_SECRET, m[1]));
}

// Pedidos que mudam algo só valem vindos do próprio site
export function sameOrigin(request){
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
