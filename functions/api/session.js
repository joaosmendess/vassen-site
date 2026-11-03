import { configured, isAuthed, json } from "../../lib/auth.js";

export async function onRequestGet({ request, env }){
  if (!configured(env)) return json({ error: "O painel ainda não foi configurado no servidor." }, 503);
  return json({ ok: await isAuthed(request, env) });
}
