# Vassen Car Care — landing page (protótipo)

Site estático em HTML, CSS e JavaScript, com animações de scroll feitas com GSAP + ScrollTrigger (carregados via CDN).

## Como rodar

Abra a pasta no VS Code e rode com a extensão **Live Server** (o VS Code vai sugerir a instalação ao abrir a pasta):
botão direito no `index.html` → **Open with Live Server**.

> Abrir o `index.html` direto pelo navegador (file://) não funciona direito: as máscaras do carro
> são imagens carregadas pelo CSS e os navegadores bloqueiam esse tipo de arquivo fora de um servidor.

Qualquer outro servidor local também serve, por exemplo: `npx serve .` ou `python -m http.server`.

## Estrutura

```
index.html              conteúdo da página, SEO e dados estruturados (schema.org)
assets/css/style.css    estilos, tokens de cor (claro/escuro) e responsividade
assets/js/main.js       animações (hero, aplicação, camadas, impacto), seletor de serviço,
                        sliders de antes/depois, self-healing e header
assets/img/
  car-side.webp         render lateral do carro (base do hero)
  mask-body.webp        máscara só da lataria  → recorta brilho, riscos, gotas e película
  mask-glass.webp       máscara só dos vidros  → recorta o embaçado da higienização
  mask-all.webp         silhueta inteira       → recorta a sujeira e a linha de passagem
  wheel-*.webp          rodas separadas (giram na entrada do carro) e suas máscaras
  fx-dirt.svg           respingos de barro (lavagem)
  fx-swirls.svg         marcas circulares (polimento)
  fx-beads.svg          gotas d'água (vitrificação)
```

## Como o hero funciona

O carro é uma imagem estática com camadas por cima. Cada camada (`#dirt`, `#haze`, `#swirls`,
`#gloss`, `#beads`, `#ppfTint`) é recortada pela máscara da peça certa, e o scroll remove ou revela
cada uma com `clip-path`, acompanhando a linha de luz (`#wipe`). A timeline fica em `main.js`,
procurando por `heroTl`.

Para trocar o carro, basta gerar novas imagens com os mesmos nomes e proporção
(1600 × 484 px para o carro e as máscaras) e ajustar a posição das rodas no `index.html`
(estilos `left/top/width/height` dos elementos `.wheel`).

## Pendências antes de publicar

- [ ] Trocar o modelo do carro por um sem marca (o atual é um Audi R8, só para testes).
- [ ] Número do WhatsApp: procure por `wa.me/?text=` no `index.html` e por `WHATS` no `main.js`.
- [ ] Domínio final: `canonical`, `og:url`, `og:image` e `url` nos dados estruturados.
- [ ] Imagem de compartilhamento (`og-vassen.jpg`, 1200 × 630 px).
- [ ] Links do Instagram e YouTube (rodapé e `sameAs` nos dados estruturados).
- [ ] Trechos tracejados em laranja (classe `.todo`): anos da linha do tempo, horário,
      garantia, prazos, modelos atendidos e confirmação do combo PPF + vitrificação.
- [ ] Fotos reais nos sliders de antes/depois e na seção da história.
