/* Editor do site: abre o site real num iframe (com ?editar), deixa os textos marcados com data-edit
   editáveis no lugar, troca fotos (data-edit-img), mexe nas listas (data-list) e liga/desliga seções
   (data-section). Salva tudo de uma vez pela API. */
(function(){
  const $ = (s, r = document) => r.querySelector(s);
  const show = (id) => ["boot", "login", "setup", "app"].forEach((x) => { $("#" + x).hidden = x !== id; });

  async function api(path, opts = {}){
    const res = await fetch("/api/" + path, { credentials: "same-origin", headers: { "content-type": "application/json" }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Não foi possível falar com o servidor. Tente de novo."), { status: res.status });
    return data;
  }

  /* ---------- Entrada ---------- */
  async function start(){
    try {
      const { ok } = await api("session");
      if (ok) return openEditor();
      show("login"); $("#password").focus();
    } catch (e){ show(e.status === 503 || e.status === 404 ? "setup" : "login"); } // 404: hospedagem sem a API do editor
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button"), err = $("#login-error");
    btn.disabled = true; err.textContent = "";
    try { await api("login", { method: "POST", body: JSON.stringify({ password: $("#password").value }) }); openEditor(); }
    catch (x){ err.textContent = x.message; $("#password").select(); }
    finally { btn.disabled = false; }
  });

  /* ---------- Editor ---------- */
  const frame = $("#site"), statusEl = $("#status"), saveBtn = $("#btn-save"), toolbar = $("#toolbar");
  let doc = null, saved = {}, saving = false;

  const PLAIN = (() => { const d = document.createElement("div"); d.contentEditable = "plaintext-only"; return d.contentEditable === "plaintext-only"; })();
  const UI = "__ui"; // controles do editor colocados dentro do site; nunca entram no que é salvo
  const isRich = (el) => el.dataset.editType === "rich";
  const inPage = (el) => !el.closest("head, #dados");
  const norm = (t) => t.replace(/\s+/g, " ").trim();
  const textOf = (el) => [...el.childNodes].map((n) => n.nodeType === 3 ? n.textContent : n.nodeType === 1 && !n.classList.contains(UI) ? textOf(n) : "").join("");

  function cleanRich(el){
    const c = el.cloneNode(true);
    c.querySelectorAll("." + UI).forEach((n) => n.remove());
    return c.innerHTML.replace(/&nbsp;/g, " ").replace(/(<br\s*\/?>\s*)+$/i, "").replace(/\s+/g, " ").trim();
  }

  // Lê todos os valores direto do site aberto no iframe: o que aparece na tela é o que vai ser salvo
  function collect(){
    const v = {};
    doc.querySelectorAll("[data-edit]").forEach((el) => {
      const k = el.dataset.edit, attr = el.dataset.editAttr;
      v[k] = attr ? norm(el.getAttribute(attr) || "") : isRich(el) ? cleanRich(el) : norm(textOf(el));
    });
    doc.querySelectorAll("[data-edit-href]").forEach((el) => { v[el.dataset.editHref] = (el.getAttribute("href") || "").trim(); });
    doc.querySelectorAll("[data-edit-img]").forEach((el) => { v[el.dataset.editImg] = el.getAttribute("data-img-src") || ""; });
    doc.querySelectorAll("[data-list]:not(.__ui)").forEach((list) => { v["list." + list.dataset.list] = JSON.stringify(items(list).map((i) => i.dataset.item)); });
    doc.querySelectorAll("[data-section]").forEach((s) => { v["secao." + s.dataset.section] = s.hasAttribute("data-section-off") ? "nao" : "sim"; });
    return v;
  }
  const items = (list) => [...list.children].filter((c) => c.matches("[data-item]"));
  const changedKeys = () => { const now = collect(); return Object.keys({ ...now, ...saved }).filter((k) => now[k] !== saved[k]); };

  function setStatus(text, kind = ""){ statusEl.textContent = text; statusEl.className = "status " + kind; }
  function refresh(){
    if (!doc || saving) return;
    const n = changedKeys().length;
    saveBtn.disabled = n === 0;
    if (n) setStatus(n === 1 ? "1 alteração não salva" : n + " alterações não salvas", "dirty");
    else if (statusEl.classList.contains("dirty")) setStatus("Nenhuma alteração");
    document.querySelectorAll(".field").forEach((f) => f.classList.toggle("changed", f._get() !== saved[f.dataset.key]));
  }

  const EDIT_CSS = `
    [data-edit][contenteditable]{cursor:text;outline:1px dashed transparent;outline-offset:4px;border-radius:2px;transition:outline-color .15s}
    [data-edit][contenteditable]:hover{outline-color:rgba(47,111,224,.6)}
    [data-edit][contenteditable]:focus{outline:2px solid #2F6FE0;outline-offset:4px}
    [data-edit][contenteditable]:empty::before{content:"(vazio)";opacity:.4}
    .pin{height:auto!important;min-height:0!important}
    .q{display:block!important}.q + .q{margin-top:36px}
    .result{display:none!important}
    .nav{position:absolute}
    a,button,summary{cursor:default}
    .ba input,.ba .handle{pointer-events:none}
    .photo-slot{position:relative}
    .photo-slot.has-photo{color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.85);align-content:end}
    .__ui{font:600 12px/1 "Archivo",system-ui,sans-serif!important;letter-spacing:0!important;text-transform:none!important}
    .__ui button,button.__ui{cursor:pointer!important;border:0;border-radius:999px;background:#2F6FE0;color:#fff;padding:8px 11px;box-shadow:0 4px 14px rgba(0,0,0,.25)}
    .__ui button:hover,button.__ui:hover{background:#1F56B8}
    .__ui button.__muted{background:#13171C}
    .__img-box{position:absolute;top:10px;z-index:15;display:flex;gap:6px}
    .before > .__img-box{left:10px}.after > .__img-box{right:10px}
    .photo-slot > .__img-box{left:50%;transform:translateX(-50%);top:14px}
    [data-item]{position:relative}
    .__ctl{position:absolute;z-index:20;top:6px;right:6px;display:flex;gap:4px;opacity:0;transition:opacity .15s}
    [data-item]:hover > .__ctl,[data-item]:focus-within > .__ctl{opacity:1}
    .service > .__ctl{top:auto;bottom:-6px}
    details > .__ctl{top:auto;bottom:10px}
    .timeline > li > .__ctl{top:50%;transform:translateY(-50%)}
    button.__add{display:block;margin-top:20px;padding:11px 18px;font-size:13px}
    [data-section-off]{opacity:.4;position:relative}
    [data-section-off]::before{content:"Seção escondida no site";position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:30;
      background:#13171C;color:#fff;padding:7px 14px;border-radius:999px;font:600 12px "Archivo",system-ui,sans-serif}
  `;

  function makeEditable(root){
    const els = root.matches && root.matches("[data-edit]") ? [root, ...root.querySelectorAll("[data-edit]")] : root.querySelectorAll("[data-edit]");
    els.forEach((el) => {
      if (!inPage(el)) return;
      el.contentEditable = isRich(el) || !PLAIN ? "true" : "plaintext-only";
      el.spellcheck = true; el.lang = "pt-BR";
    });
  }

  function ui(tag, cls, html){
    const n = doc.createElement(tag); n.className = UI + " " + cls; n.contentEditable = "false";
    if (html) n.innerHTML = html;
    return n;
  }
  function decorateImage(el){
    el.querySelector(":scope > .__img-box")?.remove();
    const box = ui("div", "__img-box");
    const label = (el.dataset.imgLabel || "foto").toLowerCase();
    box.innerHTML = '<button type="button" data-act="img"></button>' + (el.getAttribute("data-img-src") ? '<button type="button" class="__muted" data-act="img-remove">Tirar</button>' : "");
    box.firstChild.textContent = (el.getAttribute("data-img-src") ? "Trocar " : "Colocar ") + label;
    el.append(box);
  }
  function decorateItem(item){
    if (item.querySelector(":scope > .__ctl")) return;
    item.append(ui("div", "__ctl",
      '<button type="button" data-act="up" title="Subir" aria-label="Subir">↑</button>' +
      '<button type="button" data-act="down" title="Descer" aria-label="Descer">↓</button>' +
      '<button type="button" class="__muted" data-act="remove">Remover</button>'));
  }
  function decorate(root){
    const all = (sel) => [...(root.matches && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];
    all("[data-edit-img]").forEach((el) => { if (inPage(el)) decorateImage(el); });
    all("[data-list] > [data-item]").forEach(decorateItem);
  }

  function prepare(){
    doc = frame.contentDocument;
    const style = doc.createElement("style"); style.textContent = EDIT_CSS; doc.head.appendChild(style);
    doc.querySelectorAll("details").forEach((d) => { d.open = true; });
    makeEditable(doc.body);
    decorate(doc.body);
    doc.querySelectorAll("[data-list]").forEach((list) => {
      const add = ui("button", "__add"); add.type = "button"; add.dataset.act = "add"; add.dataset.target = list.dataset.list; // não usar data-list: o botão seria lido como uma lista
      add.textContent = "+ Adicionar " + (list.dataset.listLabel || "item");
      const tpl = list.parentElement.querySelector('template[data-template="' + list.dataset.list + '"]');
      (tpl || list).after(add);
    });

    // Links e botões do site não navegam nem disparam nada enquanto se edita; os controles do editor sim
    doc.addEventListener("click", (e) => {
      const act = e.target.closest("." + UI + " [data-act], ." + UI + "[data-act]");
      if (act){ e.preventDefault(); e.stopPropagation(); return onAction(act); }
      if (e.target.closest("a, button, summary, label")){ e.preventDefault(); e.stopPropagation(); }
    }, true);
    doc.addEventListener("submit", (e) => e.preventDefault(), true);

    doc.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){ e.preventDefault(); save(); return; }
      const el = e.target.closest && e.target.closest("[data-edit][contenteditable]");
      if (!el) return;
      if (e.key === "Escape") el.blur();
      if (e.key === "Enter"){
        e.preventDefault();
        if (isRich(el) && e.shiftKey) doc.execCommand("insertLineBreak");
      }
    }, true);

    doc.addEventListener("beforeinput", (e) => {
      const el = e.target.closest && e.target.closest("[data-edit]");
      if (el && !isRich(el) && e.inputType.startsWith("format")) e.preventDefault();
      if (el && e.inputType === "insertParagraph") e.preventDefault();
    }, true);

    // Colar sempre como texto puro, para não trazer fontes e cores de outro lugar
    doc.addEventListener("paste", (e) => {
      const el = e.target.closest && e.target.closest("[data-edit][contenteditable]");
      if (!el) return;
      e.preventDefault();
      const text = (e.clipboardData.getData("text/plain") || "").replace(/\s*\n\s*/g, " ");
      doc.execCommand("insertText", false, text);
    });
    doc.addEventListener("drop", (e) => e.preventDefault(), true);

    doc.addEventListener("input", (e) => {
      const el = e.target.closest && e.target.closest("[data-edit]");
      if (el && !isRich(el)) el.classList.toggle("todo", /^\s*\[[^\]]*\]\s*$/.test(textOf(el))); // [entre colchetes] = a confirmar
      refresh();
    });
    doc.addEventListener("selectionchange", placeToolbar);
    doc.addEventListener("scroll", () => { toolbar.hidden = true; }, { passive: true });

    saved = collect();
    buildFields();
    buildSections();
    refresh();
  }

  /* ---------- Listas e fotos ---------- */
  async function onAction(btn){
    const act = btn.dataset.act, item = btn.closest("[data-item]");
    if (act === "up" || act === "down"){
      const sib = act === "up" ? item.previousElementSibling : item.nextElementSibling;
      if (sib && sib.matches("[data-item]")) act === "up" ? sib.before(item) : sib.after(item);
      item.scrollIntoView({ block: "nearest" });
    } else if (act === "remove"){
      if (!confirm("Remover este item? Ele só sai do site quando você salvar.")) return;
      item.remove();
    } else if (act === "add"){
      const name = btn.dataset.target, list = doc.querySelector('[data-list="' + name + '"]');
      const tpl = doc.querySelector('template[data-template="' + name + '"]');
      const id = "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
      const node = doc.createRange().createContextualFragment(tpl.innerHTML.replaceAll("{id}", id)).firstElementChild;
      list.append(node);
      if (node.matches("details")) node.open = true;
      makeEditable(node); decorate(node);
      node.scrollIntoView({ block: "center" });
      const first = node.querySelector("h3[data-edit], summary [data-edit], b[data-edit]") || node.querySelector("[data-edit][contenteditable]"); // começa pelo título, não pelas etiquetas da foto
      if (first){ first.focus(); doc.getSelection().selectAllChildren(first); }
    } else if (act === "img"){
      const el = btn.closest("[data-edit-img]");
      const url = await chooseAndUpload(el.matches(".photo-slot") ? SIZES.historia : SIZES.servico);
      if (url){ setImage(el, url); toast("Foto colocada. Clique em Salvar para publicar."); }
    } else if (act === "img-remove"){
      setImage(btn.closest("[data-edit-img]"), "");
    }
    refresh();
  }

  function setImage(el, url){
    el.setAttribute("data-img-src", url);
    if (el.dataset.editAttr){ el.setAttribute(el.dataset.editAttr, url ? location.origin + url : ""); return; }
    el.style.setProperty("--img", url ? 'url("' + url + '")' : "");
    el.style.setProperty("--img-s", url ? 'url("' + url.replace(/\.(\w+)$/, "-s.$1") + '")' : "");
    el.classList.toggle("has-photo", Boolean(url));
    el.classList.toggle("img-on", Boolean(url));
    decorateImage(el);
  }

  function pickFile(){
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/jpeg,image/png,image/webp,image/*";
      input.addEventListener("change", () => resolve(input.files[0] || null), { once: true });
      input.addEventListener("cancel", () => resolve(null), { once: true });
      input.click();
    });
  }
  /* Cada foto sai em duas versões: computador (telas > 720 px) e celular. "box" é a menor caixa, em pixels
     reais (já contando telas de alta densidade), que a foto precisa cobrir; "aspect" são as proporções
     (largura / altura) em que o site mostra a foto. O que fica fora de todas elas nunca aparece e é cortado. */
  const SIZES = {
    servico: {  // antes/depois, sempre 16:10
      full:  { box: [1400, 875], aspect: [1.6, 1.6] },
      small: { box: [1080, 675], aspect: [1.6, 1.6] },
    },
    historia: { // 4:5 no computador, 16:9 no tablet, 4:3 no celular
      full:  { box: [1200, 1500], aspect: [0.8, 16 / 9] },
      small: { box: [1080, 810],  aspect: [4 / 3, 16 / 9] },
    },
    compartilhar: { full: { box: [1200, 630], aspect: [1.9, 1.9] } }, // prévia do WhatsApp/Facebook
  };

  // Corta pelo centro (como o site mostra) e reduz em etapas de metade: de 6000 px direto para 1400 o
  // navegador serrilha detalhes finos (riscos, reflexos). Sai em WebP, sem os dados da câmera (GPS, modelo).
  async function shrink(bmp, { box: [bw, bh], aspect: [amin, amax] }){
    const cw = Math.min(bmp.width, bmp.height * amax), ch = Math.min(bmp.height, bmp.width / amin);
    const k = Math.min(1, Math.max(bw / cw, bh / ch));
    const w = Math.round(cw * k), h = Math.round(ch * k);
    let src = bmp, sx = (bmp.width - cw) / 2, sy = (bmp.height - ch) / 2, sw = cw, sh = ch;
    const draw = (cw2, ch2) => {
      const c = document.createElement("canvas"); c.width = cw2; c.height = ch2;
      const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, sx, sy, sw, sh, 0, 0, cw2, ch2);
      src = c; sx = sy = 0; sw = cw2; sh = ch2;
      return c;
    };
    while (sw / 2 >= w * 1.05) draw(Math.round(sw / 2), Math.round(sh / 2));
    const c = draw(w, h);
    const blob = (type, q) => new Promise((r) => c.toBlob(r, type, q));
    let out = await blob("image/webp", .84);
    if (!out || out.type !== "image/webp") out = await blob("image/jpeg", .86); // Safari antigo não gera WebP
    return out;
  }
  async function send(img, of){
    const res = await fetch("/api/media" + (of ? "?de=" + encodeURIComponent(of) : ""), { method: "POST", credentials: "same-origin", headers: { "content-type": img.type }, body: img });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Não foi possível enviar a foto.");
    return data.url;
  }
  async function chooseAndUpload(size){
    const file = await pickFile();
    if (!file) return null;
    const before = statusEl.textContent;
    setStatus("Preparando a foto…");
    try {
      let bmp, full, small;
      try {
        bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); // respeita foto tirada em pé
        full = await shrink(bmp, size.full);
        if (size.small) small = await shrink(bmp, size.small);
      } catch { throw new Error("Não deu para abrir essa foto. Tente uma em JPG ou PNG (fotos HEIC do iPhone: envie pelo próprio iPhone ou exporte em JPG)."); }
      finally { bmp?.close?.(); }
      setStatus("Enviando foto…");
      const url = await send(full);
      if (small) await send(small, url.split("/").pop());
      return url;
    } catch (e){
      toast(e.message); return null;
    } finally {
      setStatus(before); refresh();
    }
  }

  /* ---------- Barra de negrito/itálico/link ---------- */
  let savedRange = null;
  function richAtSelection(){
    const sel = doc && doc.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const node = sel.getRangeAt(0).commonAncestorContainer;
    const el = (node.nodeType === 1 ? node : node.parentElement)?.closest("[data-edit][contenteditable]");
    return el && isRich(el) ? { sel, el } : null;
  }
  function placeToolbar(){
    if (!$("#link-form").hidden) return;
    const hit = richAtSelection();
    const inLink = hit && hit.sel.anchorNode?.parentElement?.closest("a");
    if (!hit || (hit.sel.isCollapsed && !inLink)){ toolbar.hidden = true; return; }
    const r = hit.sel.getRangeAt(0).getBoundingClientRect(), f = frame.getBoundingClientRect();
    toolbar.hidden = false;
    const w = toolbar.offsetWidth;
    toolbar.style.left = Math.max(8, Math.min(innerWidth - w - 8, f.left + r.left + r.width / 2 - w / 2)) + "px";
    toolbar.style.top = Math.max(f.top + 8, f.top + r.top - toolbar.offsetHeight - 10) + "px";
  }
  toolbar.addEventListener("mousedown", (e) => { if (!e.target.closest("input")) e.preventDefault(); }); // mantém a seleção no site
  toolbar.querySelector(".tools").addEventListener("click", (e) => {
    const cmd = e.target.closest("button")?.dataset.cmd;
    if (!cmd) return;
    if (cmd === "link"){
      const sel = doc.getSelection();
      if (!sel.rangeCount || sel.isCollapsed){ toast("Selecione o trecho que vai virar link."); return; }
      savedRange = sel.getRangeAt(0).cloneRange();
      $("#link-form").hidden = false; toolbar.querySelector(".tools").hidden = true;
      $("#link-url").value = "https://"; $("#link-url").focus(); $("#link-url").select();
      return;
    }
    doc.execCommand(cmd); refresh(); placeToolbar();
  });
  $("#link-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const url = $("#link-url").value.trim();
    if (!/^(https?:\/\/\S+|mailto:\S+|tel:\S+)$/i.test(url)){ toast("Use um endereço completo, começando com https://"); return; }
    frame.contentWindow.focus();
    const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange);
    doc.execCommand("createLink", false, url);
    closeLinkForm(); refresh();
  });
  function closeLinkForm(){ $("#link-form").hidden = true; toolbar.querySelector(".tools").hidden = false; toolbar.hidden = true; }
  $("#link-url").addEventListener("keydown", (e) => { if (e.key === "Escape") closeLinkForm(); });

  /* ---------- Outros textos (o que não aparece na página) ---------- */
  function buildFields(){
    const box = $("#fields"); box.innerHTML = "";
    const groups = new Map();
    const add = (group, item) => { if (!groups.has(group)) groups.set(group, []); groups.get(group).push(item); };
    doc.querySelectorAll("[data-edit]").forEach((el) => {
      if (inPage(el)) return;
      const attr = el.dataset.editAttr;
      add(el.dataset.group || "Outros", {
        key: el.dataset.edit, label: el.dataset.label || el.dataset.edit,
        get: () => norm(attr ? el.getAttribute(attr) || "" : el.textContent),
        set: (v) => attr ? el.setAttribute(attr, v) : (el.textContent = v),
        tel: el.dataset.edit === "contato.whatsapp",
      });
    });
    doc.querySelectorAll("head [data-edit-img]").forEach((el) => add(el.dataset.group || "Outros", {
      key: el.dataset.editImg, label: el.dataset.label || "Imagem", image: el,
      get: () => el.getAttribute("data-img-src") || "",
    }));
    doc.querySelectorAll("[data-edit-href]").forEach((el) => add("Links", {
      key: el.dataset.editHref, label: el.dataset.hrefLabel || el.dataset.editHref, url: true,
      get: () => (el.getAttribute("href") || "").trim(), set: (v) => { el.setAttribute("href", v); el.classList.toggle("todo", !v || v === "#"); },
    }));
    let n = 0;
    groups.forEach((list, name) => {
      const g = document.createElement("section"); g.className = "group";
      g.innerHTML = "<h3></h3>"; g.firstChild.textContent = name;
      list.forEach((it) => {
        const id = "f" + n++, f = document.createElement("div");
        f.className = "field"; f.dataset.key = it.key; f._get = it.get;
        const label = document.createElement("label"); label.htmlFor = id; label.textContent = it.label;
        f.append(label);
        if (it.image) f.append(imageField(it, id));
        else {
          const value = it.get(), long = value.length > 70 && !it.url && !it.tel;
          const input = document.createElement(long ? "textarea" : "input");
          input.id = id; input.value = value;
          if (it.tel){ input.inputMode = "numeric"; input.placeholder = "5582999999999"; }
          if (it.url){ input.type = "url"; input.placeholder = "https://"; }
          if (long) input.rows = Math.min(6, Math.ceil(value.length / 48));
          input.addEventListener("input", () => { it.set(it.tel ? input.value.replace(/\D/g, "") : input.value); refresh(); });
          f.append(input);
          if (it.tel){ const note = document.createElement("p"); note.className = "note"; note.textContent = "Usado em todos os botões de WhatsApp do site."; f.append(note); }
        }
        g.append(f);
      });
      box.append(g);
    });
  }
  function imageField(it, id){
    const wrap = document.createElement("div"); wrap.className = "img-field";
    wrap.innerHTML = '<div class="thumb"></div><div class="row"><button type="button" class="ghost" data-pick></button><button type="button" class="ghost" data-clear>Tirar</button></div>';
    const paint = () => {
      const src = it.get();
      wrap.querySelector(".thumb").style.backgroundImage = src ? 'url("' + src + '")' : "";
      wrap.querySelector("[data-pick]").textContent = src ? "Trocar imagem" : "Escolher imagem";
      wrap.querySelector("[data-clear]").hidden = !src;
    };
    wrap.querySelector("[data-pick]").id = id;
    wrap.querySelector("[data-pick]").addEventListener("click", async () => {
      const url = await chooseAndUpload(SIZES.compartilhar);
      if (url){ setImage(it.image, url); paint(); refresh(); }
    });
    wrap.querySelector("[data-clear]").addEventListener("click", () => { setImage(it.image, ""); paint(); refresh(); });
    paint();
    return wrap;
  }

  /* ---------- Seções ---------- */
  function buildSections(){
    const box = $("#sections"); box.innerHTML = "";
    doc.querySelectorAll("[data-section]").forEach((sec, i) => {
      const li = document.createElement("li");
      li.innerHTML = '<label><input type="checkbox"><span></span></label><button type="button" class="ghost">Ver</button>';
      const cb = li.querySelector("input"), on = () => !sec.hasAttribute("data-section-off");
      li.querySelector("span").textContent = sec.dataset.sectionLabel || sec.dataset.section;
      cb.id = "sec" + i; cb.checked = on(); li.classList.toggle("off", !on());
      cb.addEventListener("change", () => { sec.toggleAttribute("data-section-off", !cb.checked); li.classList.toggle("off", !cb.checked); refresh(); });
      li.querySelector("button").addEventListener("click", () => sec.scrollIntoView({ behavior: "smooth", block: "start" }));
      box.append(li);
    });
  }

  /* ---------- Salvar ---------- */
  async function save(){
    if (saving || !doc || !changedKeys().length) return;
    const values = collect();
    const bad = Object.entries(values).find(([k, v]) => doc.querySelector('[data-edit-href="' + k + '"]') && v && v !== "#" && !/^(https?:\/\/|mailto:|tel:)/i.test(v));
    if (bad){ toast("Confira o link em Outros textos: ele precisa começar com https://"); openPanel("fields"); return; }
    saving = true; saveBtn.disabled = true; setStatus("Salvando…");
    try {
      await api("content", { method: "PUT", body: JSON.stringify({ values }) });
      saved = values; saving = false; refresh();
      setStatus("Salvo às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ". O site já mostra a nova versão.", "ok");
    } catch (e){
      saving = false; refresh(); setStatus(e.message, "err");
      if (e.status === 401) setTimeout(() => location.reload(), 1500);
    }
  }
  saveBtn.addEventListener("click", save);
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){ e.preventDefault(); save(); } });
  addEventListener("beforeunload", (e) => { if (doc && changedKeys().length){ e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Painéis ---------- */
  const PANELS = ["fields", "sections", "versions"];
  function openPanel(which){
    PANELS.forEach((p) => {
      const open = p === which && $("#" + p + "-panel").hidden;
      $("#" + p + "-panel").hidden = !open;
      $("#btn-" + p).setAttribute("aria-expanded", open);
    });
    if (which === "versions" && !$("#versions-panel").hidden) loadVersions();
  }
  PANELS.forEach((p) => $("#btn-" + p).addEventListener("click", () => openPanel(p)));
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => openPanel(null)));

  const fmt = (at) => new Date(at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  async function loadVersions(){
    const list = $("#versions"); list.innerHTML = '<li class="empty">Carregando…</li>';
    try {
      const { versions } = await api("versions");
      list.innerHTML = versions.length ? "" : '<li class="empty">Nenhuma versão salva ainda. A primeira aparece aqui quando você salvar.</li>';
      versions.forEach((v, i) => {
        const li = document.createElement("li");
        li.innerHTML = '<span class="when"></span>';
        li.firstChild.textContent = fmt(v.at);
        if (i === 0){ const s = document.createElement("small"); s.textContent = "Versão no ar agora"; li.firstChild.append(s); }
        else {
          const b = document.createElement("button"); b.type = "button"; b.className = "ghost"; b.textContent = "Voltar para esta";
          b.addEventListener("click", () => restore(v));
          li.append(b);
        }
        list.append(li);
      });
    } catch (e){ list.innerHTML = '<li class="empty"></li>'; list.firstChild.textContent = e.message; }
  }
  async function restore(v){
    const lose = changedKeys().length ? " As alterações não salvas agora serão perdidas." : "";
    if (!confirm("Voltar o site para a versão de " + fmt(v.at) + "?" + lose)) return;
    try {
      await api("versions", { method: "POST", body: JSON.stringify({ id: v.id }) });
      saved = {}; doc = null; reloadSite();
      toast("Pronto. O site voltou para a versão de " + fmt(v.at) + ".");
      loadVersions();
    } catch (e){ toast(e.message); }
  }

  /* ---------- Visualização, dica, saída ---------- */
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    $("#frame").classList.toggle("phone", b.dataset.view === "phone");
  }));
  try { $("#hint").hidden = localStorage.getItem("vassen-hint") === "ok2"; } catch { $("#hint").hidden = false; }
  $("#hint-ok").addEventListener("click", () => { $("#hint").hidden = true; try { localStorage.setItem("vassen-hint", "ok2"); } catch {} });
  $("#btn-logout").addEventListener("click", async () => {
    if (doc && changedKeys().length && !confirm("Sair sem salvar as alterações?")) return;
    doc = null;
    await api("logout", { method: "POST" }).catch(() => {});
    location.reload();
  });

  let toastTimer = 0;
  function toast(text){
    const t = $("#toast"); t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }

  function reloadSite(){
    setStatus("Abrindo o site…");
    frame.src = "/?editar&t=" + Date.now();
  }
  frame.addEventListener("load", () => { prepare(); setStatus("Nenhuma alteração"); });

  function openEditor(){ show("app"); reloadSite(); }
  start();
})();
