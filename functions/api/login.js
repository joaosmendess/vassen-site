import { configured, checkPassword, sessionCookie, sameOrigin, json, loginBlocked, loginFailed, loginOk } from "../../lib/auth.js";

export async function onRequestPost({ request, env }){
  if (!configured(env)) return json({ error: "O painel ainda não foi configurado no servidor." }, 503);
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (loginBlocked(ip)) return json({ error: "Muitas tentativas. Espere 15 minutos e tente de novo." }, 429, { "retry-after": "900" });
  const { password } = await request.json().catch(() => ({}));
  if (!(await checkPassword(env, password))){
    loginFailed(ip);
    await new Promise((r) => setTimeout(r, 800)); // freia tentativas em sequência
    return json({ error: "Senha incorreta." }, 401);
  }
  loginOk(ip);
  return json({ ok: true }, 200, { "set-cookie": await sessionCookie(env) });
}
