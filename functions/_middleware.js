import { applyContent } from "../lib/content.js";
import { isAuthed } from "../lib/auth.js";

// Encaixa os textos salvos no painel em toda página HTML do site (o _routes.json limita a quais caminhos isso roda)
export async function onRequest(ctx){
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
