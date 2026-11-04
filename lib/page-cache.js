/* Cache da página já montada (com os textos do KV), para não ler o KV a cada visita.
   Cada servidor da Cloudflare guarda a página por PAGE_TTL segundos: com qualquer volume de visitas, são no
   máximo ~1.440 leituras por dia por servidor. O próprio KV já leva até 60 s para espalhar uma mudança,
   então o atraso extra para o público é pequeno. Quem salva vê na hora: salvar apaga o cache daquele servidor. */

export const PAGE_TTL = 60;

// A página é a mesma para "/", "/index.html" e qualquer query (?utm_source=..., ?fbclid=...)
export const pageKey = (url) => new Request(new URL(url).origin + "/");

export function cacheablePage(request){
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return (url.pathname === "/" || url.pathname === "/index.html") && !url.searchParams.has("editar");
}

export async function purgePage(request){
  try { await caches.default.delete(pageKey(request.url)); } catch (e) { console.error("cache", e); }
}
