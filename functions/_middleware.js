import { applyContent } from "../lib/content.js";
import { isAuthed } from "../lib/auth.js";
import { withSecurityHeaders } from "../lib/headers.js";
import { PAGE_TTL, pageKey, cacheablePage } from "../lib/page-cache.js";

// Roda na página, na API e nas fotos (ver _routes.json): põe os cabeçalhos de segurança em tudo
// e encaixa os textos salvos no painel nas páginas HTML
export async function onRequest(ctx){
  return withSecurityHeaders(cacheablePage(ctx.request) ? await cachedPage(ctx) : await withContent(ctx));
}

// Página pública: sai do cache da Cloudflare quando dá; só lê o KV quando o cache expira
async function cachedPage(ctx){
  const cache = caches.default, key = pageKey(ctx.request.url);
  const hit = await cache.match(key).catch(() => null);
  if (hit) return forBrowser(hit, "hit");
  const res = await withContent(ctx);
  if (res.status !== 200 || !(res.headers.get("content-type") || "").includes("text/html")) return res;
  const stored = new Response(res.body, res);
  stored.headers.set("cache-control", `public, max-age=${PAGE_TTL}`);
  stored.headers.delete("set-cookie");
  ctx.waitUntil(cache.put(key, stored.clone()));
  return forBrowser(stored, "miss");
}

// O navegador sempre revalida, para quem acabou de salvar não ver a versão anterior
function forBrowser(res, status){
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "no-cache");
  out.headers.set("x-page-cache", status);
  return out;
}

async function withContent(ctx){
  const res = await ctx.next();
  if (!(res.headers.get("content-type") || "").includes("text/html") || !ctx.env.CONTENT) return res;
  let values = null;
  try { values = await ctx.env.CONTENT.get("site", "json"); } catch (e) { console.error("KV indisponível", e); }
  if (!values) return res;
  const url = new URL(ctx.request.url);
  // No editor, seções escondidas continuam na página (marcadas) para poderem ser religadas
  const editing = url.searchParams.has("editar") && (await isAuthed(ctx.request, ctx.env));
  return applyContent(res, values, { editing, origin: url.origin });
}
