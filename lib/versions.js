/* Versões salvas: chave "r:<9999999999999 - data>". Com a data invertida, a lista do KV (sempre em ordem
   crescente) já vem da mais nova para a mais velha, e um único list({ limit }) traz as últimas, por mais
   versões que existam. Isso importa: o plano gratuito só tem 1.000 operações de list por dia. */

export const KEEP_DAYS = 180;
export const SHOW = 30;
const MAX = 9999999999999;

export const versionKey = (at) => "r:" + String(MAX - at).padStart(13, "0");

export async function saveVersion(env, body, at, extra = {}){
  await env.CONTENT.put(versionKey(at), body, { expirationTtl: KEEP_DAYS * 86400, metadata: { at, ...extra } });
}

export async function latestVersions(env){
  const page = await env.CONTENT.list({ prefix: "r:", limit: SHOW });
  return page.keys.map((k) => ({ id: String(k.metadata?.at ?? MAX - Number(k.name.slice(2))), at: k.metadata?.at ?? MAX - Number(k.name.slice(2)) }));
}
