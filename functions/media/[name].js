// Entrega as fotos enviadas pelo editor. O nome muda a cada envio, então podem ficar em cache para sempre.
export async function onRequestGet({ request, params, env, waitUntil }){
  const name = String(params.name || "");
  if (!/^[a-z0-9-]{6,60}\.(webp|jpg|png)$/.test(name)) return new Response("Não encontrado", { status: 404 });
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  let { value, metadata } = await env.CONTENT.getWithMetadata("media:" + name, "arrayBuffer");
  if (!value && /-s\.\w+$/.test(name)) ({ value, metadata } = await env.CONTENT.getWithMetadata("media:" + name.replace(/-s(\.\w+)$/, "$1"), "arrayBuffer"));
  if (!value) return new Response("Não encontrado", { status: 404 });
  const res = new Response(value, {
    headers: {
      "content-type": metadata?.type || "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
  waitUntil(cache.put(request, res.clone()));
  return res;
}
