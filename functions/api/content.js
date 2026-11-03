import { isAuthed, sameOrigin, json } from "../../lib/auth.js";
import { validate } from "../../lib/content.js";

const KEEP_DAYS = 180;

// Salva todos os textos e guarda uma cópia como versão, para poder voltar depois
export async function onRequestPut({ request, env }){
  if (!(await isAuthed(request, env))) return json({ error: "Sua sessão expirou. Entre de novo." }, 401);
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const { values } = await request.json().catch(() => ({}));
  const problem = validate(values);
  if (problem) return json({ error: problem }, 400);
  const body = JSON.stringify(values), at = Date.now();
  await env.CONTENT.put("site", body);
  await env.CONTENT.put("v:" + at, body, { expirationTtl: KEEP_DAYS * 86400, metadata: { at } });
  return json({ ok: true, at });
}
