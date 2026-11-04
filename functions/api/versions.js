import { isAuthed, sameOrigin, json } from "../../lib/auth.js";
import { purgePage } from "../../lib/page-cache.js";
import { versionKey, saveVersion, latestVersions } from "../../lib/versions.js";

// Lista as últimas versões salvas (mais recente primeiro): uma única operação de list
export async function onRequestGet({ request, env }){
  if (!(await isAuthed(request, env))) return json({ error: "Faça login." }, 401);
  return json({ versions: await latestVersions(env) });
}

// Volta o site para uma versão anterior (e registra isso como uma nova versão)
export async function onRequestPost({ request, env }){
  if (!(await isAuthed(request, env))) return json({ error: "Sua sessão expirou. Entre de novo." }, 401);
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const { id } = await request.json().catch(() => ({}));
  if (!/^\d{13}$/.test(String(id))) return json({ error: "Versão inválida." }, 400);
  const body = await env.CONTENT.get(versionKey(Number(id)));
  if (!body) return json({ error: "Essa versão não existe mais." }, 404);
  const at = Date.now();
  await env.CONTENT.put("site", body);
  await saveVersion(env, body, at, { restoredFrom: Number(id) });
  await purgePage(request); // quem salvou já vê a mudança no site
  return json({ ok: true, at });
}
