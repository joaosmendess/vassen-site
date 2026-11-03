/* Modo de edição: o painel /admin abre o site com ?editar. Sem animações de scroll, tudo parado e visível. */
const EDITING = new URLSearchParams(location.search).has("editar");

/* ---------- Fotos enviadas pelo editor: só baixam quando estão chegando na tela ---------- */
(function(){
  const photos = document.querySelectorAll(".has-photo");
  const on = (el) => el.classList.add("img-on");
  if (EDITING || !("IntersectionObserver" in window)){ photos.forEach(on); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting){ on(e.target); io.unobserve(e.target); }
  }), { rootMargin: "100% 0px" });
  photos.forEach((el) => io.observe(el));
})();

/* ---------- Self-healing: riscos somem onde a película é aquecida ---------- */
(function(){
  const panel = document.getElementById("heal"); if (!panel) return;
  const cv = panel.querySelector("canvas"), ctx = cv.getContext("2d", { willReadFrequently: true }), heat = panel.querySelector(".heat");
  const status = document.getElementById("heal-status"), autoBtn = document.getElementById("heal-auto"), resetBtn = document.getElementById("heal-reset");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, base = 1, healed = false, timer = 0, running = false;

  function size(){
    const r = panel.getBoundingClientRect(); if (!r.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); scratch();
  }
  function scratch(){
    let s = 13; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, W, H); ctx.lineCap = "round";
    for (let i = 0; i < 30; i++){                       // riscos de unha e de uso
      const x = rnd() * W, y = rnd() * H, len = 40 + rnd() * W * .35, a = (rnd() - .5) * .9 + (rnd() < .3 ? Math.PI / 2 : 0);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + ex) / 2 + (rnd() - .5) * 40, (y + ey) / 2 + (rnd() - .5) * 40, ex, ey);
      ctx.strokeStyle = "rgba(255,255,255," + (.3 + rnd() * .45).toFixed(2) + ")"; ctx.lineWidth = .6 + rnd() * 1.2; ctx.stroke();
    }
    for (let i = 0; i < 14; i++){                       // marcas circulares de lavagem
      const x = rnd() * W, y = rnd() * H, r = 14 + rnd() * 40, st = rnd() * 6.28;
      ctx.beginPath(); ctx.arc(x, y, r, st, st + 1 + rnd() * 2);
      ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = .8; ctx.stroke();
    }
    cv.style.opacity = 1; healed = false; base = coverage() || 1;
    status.textContent = ""; resetBtn.hidden = true; autoBtn.hidden = false;
  }
  function coverage(){
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let sum = 0;
    for (let i = 3; i < d.length; i += 64) sum += d[i];
    return sum;
  }
  function heatAt(x, y, rad = 48, power = .2){
    ctx.globalCompositeOperation = "destination-out";
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(0,0,0," + power + ")"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    heat.style.transform = "translate(" + x + "px," + y + "px)"; heat.style.opacity = 1;
    clearTimeout(timer); timer = setTimeout(check, 200);
  }
  function check(){
    if (healed || coverage() > base * .14) return;
    healed = true; cv.style.opacity = 0; heat.style.opacity = 0;
    status.textContent = "Pronto: a película se regenerou.";
    autoBtn.hidden = true; resetBtn.hidden = false;
  }
  function local(e){ const r = panel.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  panel.addEventListener("pointermove", (e) => {
    if (healed || running) return;
    if (e.pointerType !== "mouse" && !e.buttons) return;
    heatAt(...local(e));
  });
  panel.addEventListener("pointerdown", (e) => { if (!healed && !running) heatAt(...local(e)); });
  panel.addEventListener("pointerleave", () => { heat.style.opacity = 0; });

  autoBtn.addEventListener("click", () => {
    if (reduce){ ctx.clearRect(0, 0, W, H); check(); return; }
    running = true; const t0 = performance.now(), dur = 2400;
    (function step(now){
      const t = Math.min(1, (now - t0) / dur);
      for (let k = 0; k < 4; k++){                       // varredura em zigue-zague, como um soprador térmico
        const tt = Math.min(1, t + k * .004), row = tt * 5, y = (Math.floor(row) + .5) / 5 * H, f = row % 1;
        const x = (Math.floor(row) % 2 ? 1 - f : f) * W;
        heatAt(x, y, 80, .35);
      }
      if (t < 1) requestAnimationFrame(step);
      else { running = false; ctx.clearRect(0, 0, W, H); check(); }
    })(t0);
  });
  resetBtn.addEventListener("click", () => { scratch(); autoBtn.focus(); });
  new ResizeObserver(size).observe(panel); size();
})();

/* ---------- Links do topo: se o cliente removeu um serviço no editor, o link leva à lista de serviços ---------- */
document.querySelectorAll('.hero-services a[href^="#servico-"]').forEach((a) => {
  if (!document.getElementById(a.hash.slice(1))) a.href = "#servicos";
});

/* ---------- Header que reage ao scroll ---------- */
(function(){
  const nav = document.querySelector(".nav");
  let last = window.scrollY;
  const update = () => {
    const y = window.scrollY;
    nav.classList.toggle("solid", y > 40);
    nav.classList.toggle("hide", y > last && y > 240);
    last = y;
  };
  window.addEventListener("scroll", update, { passive: true });
  nav.addEventListener("focusin", () => nav.classList.remove("hide"));
  update();
})();

/* ---------- Antes/depois (funciona mesmo sem GSAP) ---------- */
document.querySelectorAll(".ba").forEach((ba) => {
  const input = ba.querySelector("input");
  const set = () => ba.style.setProperty("--pos", input.value + "%");
  input.addEventListener("input", set); set();
});

/* ---------- Link do topo para um serviço: ao chegar, o divisor desliza mostrando o antes e o depois ---------- */
(function(){
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const demo = (ba) => {
    const input = ba.querySelector("input"); if (!input || reduce) return;
    const keys = [50, 18, 82, 50], dur = 1800, t0 = performance.now();
    let stop = false; const cancel = () => { stop = true; };
    ba.addEventListener("pointerdown", cancel, { once: true }); // a pessoa mexeu: para a demonstração
    const ease = (x) => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
    (function step(now){
      if (stop) return;
      const t = Math.min(1, (now - t0) / dur), seg = Math.min(2, Math.floor(t * 3)), k = ease(t * 3 - seg);
      input.value = keys[seg] + (keys[seg + 1] - keys[seg]) * k;
      ba.style.setProperty("--pos", input.value + "%");
      if (t < 1) requestAnimationFrame(step);
    })(t0);
  };
  document.querySelectorAll(".hero-services a").forEach((a) => a.addEventListener("click", () => {
    const card = document.getElementById(a.hash.slice(1));
    if (!card || !card.matches(".service")) return;
    let done = false;
    const arrive = () => {
      if (done) return; done = true;
      card.classList.add("arrive"); setTimeout(() => card.classList.remove("arrive"), 2400);
      const ba = card.querySelector(".ba"); if (ba) demo(ba);
    };
    window.addEventListener("scrollend", arrive, { once: true }); // fim da rolagem suave
    setTimeout(arrive, 1100); // navegadores sem scrollend
  }));
})();

/* ---------- Seletor "Não sabe qual serviço escolher?" ---------- */
(function(){
  // Número e recomendações vêm do bloco #dados do HTML, que o cliente edita no painel /admin
  const num = (document.querySelector('[data-edit="contato.whatsapp"]')?.textContent || "").replace(/\D/g, "");
  const WHATS = "https://wa.me/" + num + "?text=";
  const quiz = document.getElementById("quiz");
  if (!quiz) return; // seção escondida pelo painel
  const qs = [...quiz.querySelectorAll(".q")];
  const res = document.getElementById("result");
  const answers = {};
  const label = {};

  function recommend(a){
    if (a.dor === "impacto") return a.carro === "novo" ? "ppf-vitri" : a.estrada === "sim" ? "pol-ppf-frente" : "pol-ppf";
    if (a.dor === "riscos") return a.carro === "novo" ? "pol-vitri" : "polimento";
    if (a.dor === "interior") return "higienizacao";
    return a.estrada === "sim" ? "lav-vitri" : "lavagem";
  }
  const rec = (id) => [...document.querySelector('[data-rec="' + id + '"]').children].map((el) => el.textContent.trim());

  quiz.addEventListener("click", (e) => {
    const b = e.target.closest(".opts button"); if (!b) return;
    const q = b.closest(".q"); answers[q.dataset.key] = b.dataset.v;
    label[q.dataset.key] = b.textContent.trim().toLowerCase();
    const i = qs.indexOf(q); q.classList.remove("on");
    if (i < qs.length - 1){ qs[i + 1].classList.add("on"); qs[i + 1].querySelector("button").focus(); return; }
    const [t, txt] = rec(recommend(answers));
    document.getElementById("r-title").textContent = t;
    document.getElementById("r-text").textContent = txt;
    const msg = "Olá! Fiz o teste no site da Vassen e a recomendação foi " + t + ". Meu caso: " + label.dor + ", " + label.carro + ", " + label.estrada + ". Pode me passar um orçamento?";
    document.getElementById("r-link").href = WHATS + encodeURIComponent(msg);
    res.classList.add("on"); document.getElementById("r-link").focus();
  });
  document.getElementById("r-reset").addEventListener("click", () => {
    res.classList.remove("on"); qs[0].classList.add("on"); qs[0].querySelector("button").focus();
  });
})();

/* ---------- Animações de scroll ---------- */
(function(){
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  // Na edição o site fica no estado final, sem scroll animado, e o título não é quebrado em palavras
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || EDITING;

  const title = document.getElementById("heroTitle");
  // Monta as palavras como elementos (não como HTML), já que o título vem do painel de edição
  if (!EDITING) title.replaceChildren(...title.textContent.trim().split(/\s+/).flatMap((w, i) => {
    const outer = document.createElement("span"), inner = document.createElement("span");
    outer.className = "w"; inner.textContent = w; outer.append(inner);
    return i ? [" ", outer] : [outer];
  }));

  const layers = gsap.utils.toArray("#stack .layer");
  gsap.set("#stack", { rotationX: 58, rotationZ: -36 });
  gsap.set(".duo .stone", { xPercent: -50, yPercent: -50 });

  if (reduce){
    gsap.set(".scratches", { opacity: 0 });
    gsap.set(".film", { clipPath: "inset(0% 0% 0% 0%)" });
    gsap.set(".squeegee,.gloss", { opacity: 0 });
    gsap.set(".steps li", { opacity: 1 });
    layers.forEach((l, i) => gsap.set(l, { z: i * 46 }));
    gsap.set(".duo .stone", { opacity: 0 });
    gsap.set(".crack", { opacity: 1 });
    return;
  }

  gsap.from("#heroTitle .w > span", { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: .06, delay: .15 });
  gsap.from(".h1-kicker, .hero .lead, .hero-services", { opacity: 0, y: 16, duration: .9, ease: "power3.out", delay: .55, stagger: .1 });

  const mm = gsap.matchMedia();
  mm.add({ desktop: "(min-width: 821px)", mobile: "(max-width: 820px)" }, (ctx) => {
    const desk = ctx.conditions.desktop;
    const pinCfg = (el, len) => desk
      ? { trigger: el, start: "top top", end: "+=" + len, scrub: 1, pin: true, anticipatePin: 1 }
      : { trigger: el, start: "top 70%", end: "bottom 30%", scrub: 1 };

    // No celular as etapas ficam todas visíveis; o destaque por etapa só faz sentido com a seção fixada
    const steps = desk ? gsap.utils.toArray(".steps li") : [{}, {}, {}];
    gsap.timeline({ scrollTrigger: pinCfg("#aplicacao", "260%") })
      .to(steps[0], { opacity: 1, duration: .3 })
      .to(".scratches", { opacity: 0, duration: 1 })
      .to(steps[0], { opacity: .3, duration: .3 })
      .to(steps[1], { opacity: 1, duration: .3 }, "<")
      .to(".film", { clipPath: "inset(0% 0% 0% 0%)", duration: 2, ease: "none" })
      .to(".squeegee", { left: "100%", duration: 2, ease: "none" }, "<")
      .to(".squeegee", { opacity: 0, duration: .2 })
      .to(steps[1], { opacity: .3, duration: .3 })
      .to(steps[2], { opacity: 1, duration: .3 }, "<")
      .fromTo(".gloss", { xPercent: -150 }, { xPercent: 450, duration: 1.5, ease: "none" });

    const gap = desk ? 56 : 34;
    const tl3 = gsap.timeline({ scrollTrigger: pinCfg("#camadas", "220%") });
    layers.forEach((l, i) => tl3.fromTo(l, { z: 0 }, { z: i * gap, duration: 2, ease: "power2.inOut" }, 0));
    tl3.to("#stack", { rotationZ: -28, duration: 2, ease: "none" }, 0);
    if (desk) tl3.from(".layer-labels li", { opacity: 0, x: 24, stagger: .3, duration: .6 }, .4);

    gsap.timeline({ scrollTrigger: pinCfg("#impacto", "180%") })
      .fromTo(".duo .stone", { x: desk ? -160 : -90, y: desk ? -200 : -110, rotation: 0, opacity: 1 }, { x: 0, y: 0, rotation: 220, duration: 1, ease: "none" })
      .addLabel("hit")
      .fromTo(".crack", { scale: .2, opacity: 0 }, { scale: 1, opacity: 1, duration: .25 }, "hit")
      .to(".duo figure:first-child .stone", { y: 60, opacity: 0, duration: .6 }, "hit")
      .fromTo(".ripple", { scale: .2, opacity: 1 }, { scale: 2.6, opacity: 0, duration: .8 }, "hit")
      .to(".duo figure:last-child .stone", { x: -140, y: -180, rotation: 360, opacity: 0, duration: .8 }, "hit");
  });

  const btn = document.getElementById("magnetic");
  const label = btn.querySelector(".label");
  if (!EDITING && window.matchMedia("(pointer: fine)").matches){
    btn.addEventListener("mousemove", (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      gsap.to(btn,   { x: dx * .35, y: dy * .45, duration: .4, ease: "power3.out", overwrite: "auto" });
      gsap.to(label, { x: dx * .15, y: dy * .2,  duration: .4, ease: "power3.out", overwrite: "auto" });
    });
    btn.addEventListener("mouseleave", () => gsap.to([btn, label], { x: 0, y: 0, duration: 1, ease: "elastic.out(1, .35)", overwrite: "auto" }));
  }
})();
