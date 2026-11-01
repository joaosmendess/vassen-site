/* ---------- Reflexo da lataria seguindo o mouse (só desktop) ---------- */
(function(){
  if (!window.matchMedia("(pointer: fine)").matches) return;
  const wrap = document.querySelector(".car-wrap"), glint = document.getElementById("glint");
  wrap.style.pointerEvents = "auto";
  wrap.addEventListener("mousemove", (e) => {
    const r = wrap.getBoundingClientRect();
    glint.style.setProperty("--gx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
  });
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

/* ---------- Seletor "Não sabe qual serviço escolher?" ---------- */
(function(){
  const WHATS = "https://wa.me/?text="; // trocar por https://wa.me/5582XXXXXXXXX?text=
  const quiz = document.getElementById("quiz");
  const qs = [...quiz.querySelectorAll(".q")];
  const res = document.getElementById("result");
  const answers = {};
  const label = { sujeira:"sujeira do dia a dia", riscos:"riscos e falta de brilho", interior:"interior sujo ou com cheiro", impacto:"proteção contra pedrisco", novo:"carro novo", usado:"carro usado", sim:"pego estrada com frequência", nao:"rodo mais na cidade" };

  function recommend(a){
    if (a.dor === "impacto"){
      if (a.carro === "novo") return ["PPF com vitrificação", "Com o carro ainda novo, a pintura está no melhor estado para receber o filme. A vitrificação por cima facilita a limpeza e aumenta o brilho."];
      if (a.estrada === "sim") return ["Polimento + PPF na frente do carro", "Quem pega estrada recebe a maior parte dos impactos no para-choque, capô e retrovisores. O polimento corrige o que já existe antes do filme entrar."];
      return ["Polimento + PPF", "O polimento recupera a pintura e o PPF protege as áreas que mais sofrem no dia a dia, como para-choque, portas e soleiras."];
    }
    if (a.dor === "riscos") return a.carro === "novo"
      ? ["Polimento + vitrificação", "Riscos em carro novo costumam ser marcas de lavagem. O polimento remove e a vitrificação ajuda a não voltarem tão cedo."]
      : ["Polimento técnico", "O polimento remove riscos finos e oxidação e devolve a profundidade da cor. Depois, vale pensar em vitrificação ou PPF para manter o resultado."];
    if (a.dor === "interior") return ["Higienização interna", "Limpeza profunda de bancos, carpetes, teto e saídas de ar, com remoção de manchas e odores."];
    return a.estrada === "sim"
      ? ["Lavagem detalhada + vitrificação", "A vitrificação facilita tirar a sujeira de estrada e a lavagem técnica mantém a pintura sem riscos."]
      : ["Lavagem detalhada", "A manutenção certa para manter a pintura limpa sem os riscos de uma lavagem comum."];
  }

  quiz.addEventListener("click", (e) => {
    const b = e.target.closest(".opts button"); if (!b) return;
    const q = b.closest(".q"); answers[q.dataset.key] = b.dataset.v;
    const i = qs.indexOf(q); q.classList.remove("on");
    if (i < qs.length - 1){ qs[i + 1].classList.add("on"); qs[i + 1].querySelector("button").focus(); return; }
    const [t, txt] = recommend(answers);
    document.getElementById("r-title").textContent = t;
    document.getElementById("r-text").textContent = txt;
    const msg = "Olá! Fiz o teste no site da Vassen e a recomendação foi " + t + ". Meu caso: " + label[answers.dor] + ", " + label[answers.carro] + ", " + label[answers.estrada] + ". Pode me passar um orçamento?";
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
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const title = document.getElementById("heroTitle");
  title.innerHTML = title.textContent.trim().split(/\s+/).map(w => '<span class="w"><span>' + w + '</span></span>').join(" ");

  const layers = gsap.utils.toArray("#stack .layer");
  gsap.set("#stack", { rotationX: 58, rotationZ: -36 });
  gsap.set(".duo .stone", { xPercent: -50, yPercent: -50 });

  if (reduce){
    gsap.set("#dirt,#haze,#swirls", { opacity: 0 });
    gsap.set("#gloss,#ppfTint", { opacity: 1 }); gsap.set("#beads", { opacity: 0 }); gsap.set(".hero-services .bar", { scaleX: 1 });
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
  /* Entrada: o carro chega dirigindo, as rodas giram de acordo com o deslocamento e a luz do estúdio acende */
  const mover = document.querySelector(".car-move"), wheelImgs = gsap.utils.toArray(".wheel img");
  let wheelD = 1, lastDeg = null;
  const measure = () => { const w = document.querySelector(".wheel"); wheelD = Math.max(1, w.offsetWidth * .94); };
  measure(); window.addEventListener("resize", measure);
  const spin = () => {
    const deg = (gsap.getProperty(mover, "x") / (Math.PI * wheelD) * 360) % 360;
    if (deg === lastDeg) return; lastDeg = deg;
    wheelImgs.forEach((w) => { w.style.transform = "rotate(" + deg + "deg)"; });
  };
  gsap.ticker.add(spin);
  gsap.set(".hero", { "--light": 0 });
  gsap.timeline({ delay: .3 })
    .fromTo(mover, { x: () => -window.innerWidth * 1.1 }, { x: 0, duration: 2.2, ease: "power3.out", onComplete: () => gsap.ticker.remove(spin) }) // carro parado: rodas não precisam mais de cálculo por quadro
    .to(".hero", { "--light": 1, duration: 1, ease: "power2.out" }, "-=.6");

  const mm = gsap.matchMedia();
  mm.add({ desktop: "(min-width: 821px)", mobile: "(max-width: 820px)" }, (ctx) => {
    const desk = ctx.conditions.desktop;
    const pinCfg = (el, len) => desk
      ? { trigger: el, start: "top top", end: "+=" + len, scrub: 1, pin: true, anticipatePin: 1 }
      : { trigger: el, start: "top 70%", end: "bottom 30%", scrub: 1 };

    /* Hero: cada trecho do scroll é um serviço sendo feito no carro.
       Fica fixado também no celular, porque é a história de abertura. */
    const pills = gsap.utils.toArray(".hero-services a");
    const heroTl = gsap.timeline({
      scrollTrigger: { trigger: "#hero", start: "top top", end: desk ? "+=380%" : "+=260%", scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true },
      onUpdate(){
        const t = heroTl.time();
        const idx = t < .05 ? -1 : Math.min(4, Math.floor(t));
        pills.forEach((p, i) => p.classList.toggle("on", i === idx));
      }
    });
    // Cada serviço passa pelo carro da esquerda para a direita, guiado pela linha de luz
    const W0 = "inset(0% 0% 0% 0%)", clearR = "inset(0% 0% 0% 100%)", hideR = "inset(0% 100% 0% 0%)";
    gsap.set("#gloss,#beads,#ppfTint", { clipPath: hideR });
    gsap.set("#gloss", { opacity: .9 }); gsap.set("#beads", { opacity: 1 }); gsap.set("#ppfTint", { opacity: 1 });
    // Linha e faixa andam com transform (só composição), em vez de left, que recalcula layout a cada quadro
    const carW = () => document.getElementById("wipe").offsetWidth;
    gsap.set("#sweep .band", { skewX: -14 });
    [0, 1, 2, 3].forEach((t) => heroTl.fromTo("#wipe .line", { x: 0, opacity: 1 }, { x: carW, duration: 1, ease: "none", immediateRender: false }, t));
    heroTl
      .fromTo("#dirt",   { clipPath: W0 },    { clipPath: clearR, duration: 1, ease: "none" }, 0) // lavagem
      .fromTo("#haze",   { clipPath: W0 },    { clipPath: clearR, duration: 1, ease: "none" }, 1) // higienização
      .fromTo("#swirls", { clipPath: W0 },    { clipPath: clearR, duration: 1, ease: "none" }, 2) // polimento
      .fromTo("#gloss",  { clipPath: hideR }, { clipPath: W0,     duration: 1, ease: "none" }, 2)
      .fromTo("#beads",  { clipPath: hideR }, { clipPath: W0,     duration: 1, ease: "none" }, 3) // vitrificação
      // PPF: a borda da película passa como um rodo, seca as gotas e deixa só um brilho limpo
      .fromTo("#sweep .band", { xPercent: 0 }, { xPercent: 1250, duration: 1, ease: "none" }, 4) // 125% do carro = 12,5 larguras da faixa
      .fromTo("#beads",   { clipPath: W0 },    { clipPath: clearR, duration: .8, ease: "none", immediateRender: false }, 4.08)
      .fromTo("#ppfTint", { clipPath: hideR }, { clipPath: W0,     duration: .8, ease: "none" }, 4.08)
      .to("#wipe .line", { opacity: 0, duration: .05 }, 4)
      .to({}, { duration: .6 })  // pausa no carro pronto antes de liberar a página
      .fromTo(".hero-services .bar", { scaleX: 0 }, { scaleX: 1, duration: 5, ease: "none" }, 0)

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
  if (window.matchMedia("(pointer: fine)").matches){
    btn.addEventListener("mousemove", (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      gsap.to(btn,   { x: dx * .35, y: dy * .45, duration: .4, ease: "power3.out", overwrite: "auto" });
      gsap.to(label, { x: dx * .15, y: dy * .2,  duration: .4, ease: "power3.out", overwrite: "auto" });
    });
    btn.addEventListener("mouseleave", () => gsap.to([btn, label], { x: 0, y: 0, duration: 1, ease: "elastic.out(1, .35)", overwrite: "auto" }));
  }
})();
