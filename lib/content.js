/* Conteúdo editável do site.
   Os textos ficam no KV como um objeto { "chave": "valor" }. Antes de a página sair do servidor:
   1. listas (data-list) são remontadas na ordem salva, a partir do <template data-template> de cada uma;
   2. cada elemento com data-edit="chave" recebe o valor salvo, imagens (data-edit-img) recebem a foto enviada
      e seções desligadas (data-section) saem da página.
   Sem valor salvo, fica o que está no HTML. */

export const KEY_RE = /^[a-z0-9][a-z0-9._-]{0,80}$/i;
export const MAX_VALUE = 5000;
export const MEDIA_RE = /^\/media\/[a-z0-9-]{6,60}\.(webp|jpg|png)$/;
// Cada foto da página tem uma versão menor para celular, com o mesmo nome terminado em -s
export const smallSrc = (src) => src.replace(/\.(webp|jpg|png)$/, "-s.$1");
const ITEM_RE = /^[a-z0-9-]{1,40}$/i;

// Formatação permitida nos textos com data-edit-type="rich": negrito, itálico, link e quebra de linha.
// O span.todo é a marcação tracejada de "trecho a confirmar".
const ALLOWED = { b: [], strong: [], i: [], em: [], br: [], a: ["href"], span: ["class"] };

export function safeHref(v){
  v = String(v || "").trim();
  return /^(https?:\/\/|mailto:|tel:|#)/i.test(v) ? v : "";
}

const escAttr = (v) => v.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function sanitize(html){
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|template|svg|math|textarea|noscript)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (m, close, tag, attrs) => {
      tag = tag.toLowerCase();
      if (!(tag in ALLOWED)) return "";
      if (close) return tag === "br" ? "" : "</" + tag + ">";
      let out = "";
      for (const name of ALLOWED[tag]){
        const found = attrs.match(new RegExp("\\s" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
        if (!found) continue;
        let v = found[2] ?? found[3] ?? found[4] ?? "";
        if (name === "href" && !(v = safeHref(v))) continue;
        if (name === "class" && v !== "todo") continue;
        out += " " + name + '="' + escAttr(v) + '"';
      }
      if (tag === "a" && /^ href="(https?:|mailto:|tel:)/.test(out)) out += ' target="_blank" rel="noopener"';
      return "<" + tag + out + ">";
    })
    .replace(/<(?![a-z/!])/gi, "&lt;");
}

const stripTags = (h) => String(h).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const isPlaceholder = (v) => /^\s*\[[^\]]*\]\s*$/.test(stripTags(v));

export function listIds(values, name){
  try {
    const ids = JSON.parse(values["list." + name]);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && ITEM_RE.test(id)) : null;
  } catch { return null; }
}

// Dados estruturados do FAQ (aparecem no Google) acompanham as perguntas editadas, na mesma ordem
function faqSchema(values){
  const ids = listIds(values, "faq") ||
    Object.keys(values).map((k) => (k.match(/^faq\.([^.]+)\.pergunta$/) || [])[1]).filter(Boolean);
  const items = [];
  for (const id of ids){
    const q = stripTags(values["faq." + id + ".pergunta"] || ""), a = values["faq." + id + ".resposta"] || "";
    if (q && stripTags(a) && !isPlaceholder(a)) items.push({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: stripTags(a) } });
  }
  if (!items.length) return null;
  return JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items }, null, 2).replace(/</g, "\\u003c");
}

// Texto entre colchetes é "a confirmar" e ganha o tracejado; texto preenchido perde
function markTodo(el, v){
  const cls = (el.getAttribute("class") || "").replace(/\btodo\b/, "").replace(/\s+/g, " ").trim();
  const next = isPlaceholder(v) && el.getAttribute("data-edit-type") !== "rich" ? (cls + " todo").trim() : cls;
  next ? el.setAttribute("class", next) : el.removeAttribute("class");
}

function addClass(el, c){
  const cls = el.getAttribute("class") || "";
  if (!new RegExp("\\b" + c + "\\b").test(cls)) el.setAttribute("class", (cls + " " + c).trim());
}

export async function applyContent(response, values, { editing = false, origin = "" } = {}){
  const has = (k) => Object.prototype.hasOwnProperty.call(values, k) && typeof values[k] === "string";
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("cache-control", "no-cache");

  // 1ª passada: listas na ordem salva, cada item montado a partir do molde
  const templates = {};
  for (const m of html.matchAll(/<template data-template="([\w-]+)">([\s\S]*?)<\/template>/g)) templates[m[1]] = m[2];
  const lists = new HTMLRewriter().on("[data-list]", {
    element(el){
      const name = el.getAttribute("data-list"), ids = listIds(values, name), tpl = templates[name];
      if (ids && tpl) el.setInnerContent(ids.map((id) => tpl.replaceAll("{id}", id)).join("\n"), { html: true });
    },
  });

  // 2ª passada: textos, links, fotos e seções
  const off = (name) => values["secao." + name] === "nao";
  let rw = new HTMLRewriter()
    .on("[data-edit]", {
      element(el){
        const key = el.getAttribute("data-edit");
        if (!has(key)) return;
        const v = values[key], attr = el.getAttribute("data-edit-attr");
        if (attr) return el.setAttribute(attr, v);
        if (el.getAttribute("data-edit-type") === "rich") el.setInnerContent(sanitize(v), { html: true });
        else el.setInnerContent(v);
        if (!el.getAttribute("data-edit-href")) markTodo(el, v); // em links, o tracejado depende do endereço
      },
    })
    .on("[data-edit-href]", {
      element(el){
        const key = el.getAttribute("data-edit-href"), href = has(key) && safeHref(values[key]);
        if (href){ el.setAttribute("href", href); if (href !== "#") markTodo(el, ""); }
      },
    })
    .on("[data-edit-img]", {
      element(el){
        const key = el.getAttribute("data-edit-img"), src = has(key) && MEDIA_RE.test(values[key]) ? values[key] : "";
        if (!src) return;
        el.setAttribute("data-img-src", src);
        if (el.getAttribute("data-edit-attr")) return el.setAttribute(el.getAttribute("data-edit-attr"), origin + src);
        // --img (computador) e --img-s (celular); o main.js só liga a foto quando ela chega perto da tela
        el.setAttribute("style", '--img:url("' + src + '");--img-s:url("' + smallSrc(src) + '")');
        addClass(el, "has-photo");
        const alt = el.getAttribute("data-img-alt");
        if (alt){ el.setAttribute("role", "img"); el.setAttribute("aria-label", stripTags(has(alt) ? values[alt] : "Foto da Vassen")); }
      },
    })
    .on("[data-section]", {
      element(el){
        if (!off(el.getAttribute("data-section"))) return;
        editing ? el.setAttribute("data-section-off", "") : el.remove();
      },
    })
    .on("[data-section-link]", { element(el){ if (!editing && off(el.getAttribute("data-section-link"))) el.remove(); } });

  if (has("contato.whatsapp")){
    const num = values["contato.whatsapp"].replace(/\D/g, "");
    rw = rw.on('a[href^="https://wa.me/"]', {
      element(el){ el.setAttribute("href", el.getAttribute("href").replace(/^https:\/\/wa\.me\/\d*/, "https://wa.me/" + num)); },
    });
  }
  const faq = faqSchema(values);
  rw = rw.on("script#faq-schema", {
    element(el){
      if (off("duvidas") && !editing) el.remove();
      else if (faq) el.setInnerContent(faq, { html: true });
    },
  });

  const out = rw.transform(lists.transform(new Response(html, { status: response.status, headers })));
  return new Response(out.body, { status: out.status, headers });
}

export function validate(values){
  if (!values || typeof values !== "object" || Array.isArray(values)) return "Formato inválido.";
  const keys = Object.keys(values);
  if (keys.length > 1000) return "Campos demais.";
  for (const k of keys){
    if (!KEY_RE.test(k)) return "Campo inválido: " + k;
    if (typeof values[k] !== "string") return "Valor inválido em " + k;
    if (values[k].length > MAX_VALUE) return "Texto longo demais em " + k;
  }
  return null;
}
