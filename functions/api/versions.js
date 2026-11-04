import { isAuthed, sameOrigin, json } from "../../lib/auth.js";
import { purgePage } from "../../lib/page-cache.js";

// Lista as últimas versões salvas (mais recente primeiro)
export async function onRequestGet({ request, env }){
  if (!(await isAuthed(request, env))) return json({ error: "Faça login." }, 401);
  const keys = [];
  let cursor;
  do {
    const page = await env.CONTENT.list({ prefix: "v:", cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  const versions = keys.map((k) => ({ id: k.name.slice(2), at: Number(k.name.slice(2)) })).sort((a, b) => b.at - a.at).slice(0, 30);
  return json({ versions });
}

// Volta o site para uma versão anterior (e registra isso como uma nova versão)
export async function onRequestPost({ request, env }){
  if (!(await isAuthed(request, env))) return json({ error: "Sua sessão expirou. Entre de novo." }, 401);
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const { id } = await request.json().catch(() => ({}));
  if (!/^\d{13}$/.test(String(id))) return json({ error: "Versão inválida." }, 400);
  const body = await env.CONTENT.get("v:" + id);
  if (!body) return json({ error: "Essa versão não existe mais." }, 404);
  const at = Date.now();
  await env.CONTENT.put("site", body);
  await env.CONTENT.put("v:" + at, body, { expirationTtl: 180 * 86400, metadata: { at, restoredFrom: Number(id) } });
  await purgePage(request); // quem salvou já vê a mudança no site
  return json({ ok: true, at });
}
