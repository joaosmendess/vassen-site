import { applyContent } from "../lib/content.js";
import { isAuthed } from "../lib/auth.js";
import { withSecurityHeaders } from "../lib/headers.js";

// Roda na página, na API e nas fotos (ver _routes.json): põe os cabeçalhos de segurança em tudo
// e encaixa os textos salvos no painel nas páginas HTML
export async function onRequest(ctx){
  return withSecurityHeaders(await withContent(ctx));
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
