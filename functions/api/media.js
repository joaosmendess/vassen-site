import { isAuthed, sameOrigin, json } from "../../lib/auth.js";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

// Confere a assinatura do arquivo, não só o tipo informado pelo navegador
function looksLike(type, b){
  if (type === "image/webp") return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  return false;
}

async function exists(env, key){
  const s = await env.CONTENT.get(key, "stream");
  if (s) await s.cancel();
  return Boolean(s);
}

// Recebe uma foto (já reduzida pelo navegador do editor) e guarda no KV com um nome único
export async function onRequestPost({ request, env }){
  if (!(await isAuthed(request, env))) return json({ error: "Sua sessão expirou. Entre de novo." }, 401);
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  const ext = TYPES[type];
  if (!ext) return json({ error: "Use uma foto em JPG, PNG ou WebP." }, 415);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_BYTES) return json({ error: "A foto passou de 4 MB, mesmo depois de reduzida." }, 413);
  if (!looksLike(type, new Uint8Array(buf, 0, Math.min(12, buf.byteLength)))) return json({ error: "Esse arquivo não parece ser uma imagem." }, 415);
  // ?de=<nome> grava a versão de celular da foto <nome> como <nome>-s
  const of = new URL(request.url).searchParams.get("de");
  let name;
  if (of){
    const m = /^([a-z0-9]{4,20}-[a-f0-9]{10})\.(webp|jpg|png)$/.exec(of);
    if (!m || m[2] !== ext || !(await exists(env, "media:" + of))) return json({ error: "Foto original não encontrada." }, 400);
    name = m[1] + "-s." + ext;
  } else {
    const rand = [...crypto.getRandomValues(new Uint8Array(5))].map((x) => x.toString(16).padStart(2, "0")).join("");
    name = Date.now().toString(36) + "-" + rand + "." + ext;
  }
  await env.CONTENT.put("media:" + name, buf, { metadata: { type, size: buf.byteLength } });
  return json({ ok: true, url: "/media/" + name });
}
