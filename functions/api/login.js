import { configured, checkPassword, sessionCookie, sameOrigin, json } from "../../lib/auth.js";

export async function onRequestPost({ request, env }){
  if (!configured(env)) return json({ error: "O painel ainda não foi configurado no servidor." }, 503);
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const { password } = await request.json().catch(() => ({}));
  if (!(await checkPassword(env, password))){
    await new Promise((r) => setTimeout(r, 800)); // freia tentativas em sequência
    return json({ error: "Senha incorreta." }, 401);
  }
  return json({ ok: true }, 200, { "set-cookie": await sessionCookie(env) });
}
