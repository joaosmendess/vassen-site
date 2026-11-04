import { isAuthed, sameOrigin, json } from "../../lib/auth.js";
import { purgePage } from "../../lib/page-cache.js";
import { validate } from "../../lib/content.js";
import { saveVersion } from "../../lib/versions.js";

// Salva todos os textos e guarda uma cópia como versão, para poder voltar depois
export async function onRequestPut({ request, env }){
  if (!(await isAuthed(request, env))) return json({ error: "Sua sessão expirou. Entre de novo." }, 401);
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const { values } = await request.json().catch(() => ({}));
  const problem = validate(values);
  if (problem) return json({ error: problem }, 400);
  const body = JSON.stringify(values), at = Date.now();
  await env.CONTENT.put("site", body);
  await saveVersion(env, body, at);
  await purgePage(request); // quem salvou já vê a mudança no site
  return json({ ok: true, at });
}
