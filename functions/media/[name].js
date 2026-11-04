// Entrega as fotos enviadas pelo editor. O nome muda a cada envio, então podem ficar em cache para sempre.
export async function onRequestGet({ request, params, env, waitUntil }){
  const name = String(params.name || "");
  if (!/^[a-z0-9-]{6,60}\.(webp|jpg|png)$/.test(name)) return new Response("Não encontrado", { status: 404 });
  // Chave do cache sem a query: "?x=1", "?x=2"... não furam o cache nem gastam leituras do KV
  const url = new URL(request.url);
  const key = new Request(url.origin + url.pathname);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;
  let { value, metadata } = await env.CONTENT.getWithMetadata("media:" + name, "arrayBuffer");
  let fallback = false;
  if (!value && /-s\.\w+$/.test(name)){
    ({ value, metadata } = await env.CONTENT.getWithMetadata("media:" + name.replace(/-s(\.\w+)$/, "$1"), "arrayBuffer"));
    fallback = Boolean(value);
  }
  if (!value){
    // Guarda o "não encontrado" por pouco tempo, para nomes inventados não custarem uma leitura cada
    const miss = new Response("Não encontrado", { status: 404, headers: { "cache-control": "public, max-age=60" } });
    waitUntil(cache.put(key, miss.clone()));
    return miss;
  }
  const res = new Response(value, {
    headers: {
      "content-type": metadata?.type || "image/webp",
      // A versão de celular pode chegar logo depois da original: enquanto isso, a original vai sem cache longo
      "cache-control": fallback ? "public, max-age=60" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
  if (!fallback) waitUntil(cache.put(key, res.clone()));
  return res;
}
