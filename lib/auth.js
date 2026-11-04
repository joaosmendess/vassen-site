/* Login do painel: uma senha (ADMIN_PASSWORD) e um cookie assinado com SESSION_SECRET.
   As duas ficam nas variáveis secretas do projeto na Cloudflare, nunca no código. */

const COOKIE = "__Host-vassen_admin"; // __Host-: só vale com Secure, Path=/ e sem Domain (nada de subdomínio)
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

// A assinatura cobre a senha atual: trocar ADMIN_PASSWORD (ou SESSION_SECRET) derruba todas as sessões abertas
const sign = (env, exp) => hmac(env.SESSION_SECRET, exp + "." + env.ADMIN_PASSWORD);

export async function sessionCookie(env){
  const exp = String(Date.now() + DAYS * 864e5);
  return `${COOKIE}=${exp}.${await sign(env, exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAYS * 86400}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAuthed(request, env){
  if (!configured(env)) return false;
  const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=(\\d+)\\.([\\w-]+)"));
  if (!m || Number(m[1]) < Date.now()) return false;
  return sameString(m[2], await sign(env, m[1]));
}

// Pedidos que mudam algo só valem vindos do próprio site. Navegadores atuais sempre mandam Origin ou
// Sec-Fetch-Site nesses pedidos; sem nenhum dos dois (curl, scripts) vale só o cookie SameSite=Strict.
export function sameOrigin(request){
  const origin = request.headers.get("origin");
  if (origin) return origin === new URL(request.url).origin;
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}

// Limite de tentativas de login por IP. Fica na memória de cada servidor da Cloudflare (sem gastar
// escritas do KV), então é um freio, não uma garantia: a proteção principal é uma senha longa e aleatória.
const MAX_FAILS = 5, WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();

export function loginBlocked(ip){
  const f = fails.get(ip);
  if (f && f.until < Date.now()) fails.delete(ip);
  return Boolean(f && f.until >= Date.now() && f.count >= MAX_FAILS);
}

export function loginFailed(ip){
  const now = Date.now();
  if (fails.size > 5000) for (const [k, v] of fails) if (v.until < now) fails.delete(k);
  const f = fails.get(ip);
  if (f && f.until >= now) f.count++;
  else fails.set(ip, { count: 1, until: now + WINDOW_MS });
}

export const loginOk = (ip) => fails.delete(ip);

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
