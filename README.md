# Vassen Car Care — landing page (protótipo)

Site estático em HTML, CSS e JavaScript, com animações de scroll feitas com GSAP + ScrollTrigger (carregados via CDN),
e um **editor de textos** em `/admin` para o cliente atualizar o conteúdo sem mexer no código.

Hospedagem prevista: **Cloudflare Pages** (site, API do editor e armazenamento dos textos no mesmo lugar, no plano gratuito).

## Como rodar

Precisa do Node.js 20 ou mais novo.

```
npm install
cp .dev.vars.example .dev.vars   # e troque a senha e o segredo
npm run dev
```

- Site: http://127.0.0.1:8788
- Editor: http://127.0.0.1:8788/admin/ (senha = `ADMIN_PASSWORD` do `.dev.vars`)

O `npm run dev` usa o Wrangler, que roda o site, a API e um banco local igual ao da Cloudflare.
Os textos salvos localmente ficam em `.wrangler/` (fora do Git).

> Abrir o `index.html` direto pelo navegador (file://) não funciona direito: as máscaras do carro
> são imagens carregadas pelo CSS e os navegadores bloqueiam esse tipo de arquivo fora de um servidor.

## Estrutura

```
public/                    tudo que é publicado
  index.html               conteúdo da página, SEO e dados estruturados (schema.org)
  assets/css/style.css     estilos, tokens de cor (claro/escuro) e responsividade
  assets/js/main.js        animações (abertura, aplicação, camadas, impacto), seletor de serviço,
                           sliders de antes/depois, self-healing e header
  assets/fonts/            Archivo variável recortada (largura 100–125%, peso 400–800, latim)
  admin/                   editor de textos (página, estilos e script)
  _routes.json             em quais caminhos as funções rodam (só na página e na API)
  _headers                 /admin fora do Google e sem cache
functions/
  _middleware.js           encaixa os textos salvos na página antes de ela sair do servidor
  api/login.js, logout.js, session.js
  api/content.js           salva os textos (PUT)
  api/versions.js          lista versões (GET) e volta para uma (POST)
lib/
  content.js               aplica os textos no HTML, limpa a formatação permitida, FAQ do Google
  auth.js                  senha e cookie de sessão assinado
wrangler.toml              configuração da Cloudflare (nome do projeto e banco de textos)
```

## Como o editor funciona

1. Cada texto editável tem uma chave no HTML: `data-edit="hero.titulo"`.
   Parágrafos que aceitam negrito, itálico e link levam também `data-edit-type="rich"`.
   Links editáveis usam `data-edit-href="links.instagram"`.
2. O cliente entra em `/admin`, que abre o site real com `?editar` (sem animações de scroll) e deixa os textos
   editáveis no lugar. Número do WhatsApp, links, textos do Google e as recomendações do seletor ficam no painel
   **Outros textos** (vêm do `<head>` e do bloco escondido `#dados` no fim do `index.html`).
3. **Salvar** grava todos os valores no Cloudflare KV (`site`) e uma cópia como versão (`v:<data>`, guardada por 6 meses).
4. Em cada visita, o `_middleware.js` lê os valores e troca o conteúdo dos elementos marcados antes de entregar a página.
   O Google e a prévia do WhatsApp recebem o texto novo. Sem nada salvo, vale o texto que está no HTML.

Segurança: só textos marcados podem mudar; títulos são sempre texto puro; parágrafos aceitam só negrito, itálico,
link (http, https, mailto, tel) e quebra de linha, limpos no servidor a cada visita.

**Para adicionar um texto editável novo:** coloque `data-edit="secao.nome"` no elemento. Ele aparece no editor
automaticamente. Para algo que não aparece na página, crie um elemento dentro de `#dados` com `data-label`
(nome do campo) e `data-group` (grupo no painel).

**Cuidado ao mudar uma chave existente:** o texto salvo para a chave antiga deixa de ser usado.

### Fotos

Elementos com `data-edit-img="chave"` ganham o botão **Colocar/Trocar foto** no editor (hoje: os antes/depois de cada
serviço, a foto da história e a imagem de compartilhamento, em Outros textos). A foto pode vir direto da câmera, em qualquer
tamanho: o navegador do editor prepara tudo antes de enviar (`SIZES` e `shrink` em `admin.js`):

- corta pelo centro o que o site nunca mostra (ex.: foto em pé num antes/depois deitado, 16:10);
- reduz em etapas, para não serrilhar detalhes finos, até o tamanho que cada lugar precisa em telas de alta densidade;
- gera **duas versões** em WebP: computador (`<nome>.webp`) e celular (`<nome>-s.webp`, ~40–60% menor);
- respeita a rotação da câmera e descarta os dados da foto (GPS, modelo do celular).

`POST /api/media` confere o tipo pelo conteúdo do arquivo e guarda no KV como `media:<nome>` (a versão de celular vai com
`?de=<nome>`). As fotos são servidas em `/media/<nome>` com cache permanente (o nome muda a cada envio). No site, o
`main.js` só liga cada foto quando ela está a cerca de uma tela de distância (sem JavaScript, aparecem normalmente), e
telas de até 720 px recebem a versão de celular. Fotos antigas não são apagadas, porque versões anteriores do site podem usá-las.

### Listas

Serviços, perguntas do FAQ e marcos da linha do tempo são listas: o contêiner tem `data-list="nome"`, cada item
`data-item="id"` e, logo depois, um `<template data-template="nome">` com o molde de um item novo (`{id}` vira o id).
O editor mostra ↑ ↓ Remover em cada item e **+ Adicionar** no fim. A ordem fica salva em `list.<nome>` e o servidor
remonta a lista a partir do molde. Se mudar a estrutura de um item, mude também o molde.

Passos da aplicação, camadas e opções do seletor **não** são listas de propósito: estão ligados às animações e à lógica
das recomendações em `main.js`.

### Seções

`data-section="nome"` (com `data-section-label`) pode ser desligada no painel **Seções**. Desligada, ela some do site
junto com o link do menu (`data-section-link`) e, no caso do FAQ, com os dados do FAQ para o Google. No editor ela
continua visível, mais clara, para poder ser religada.

### Limites do plano gratuito do KV

1.000 salvamentos por dia, 100.000 leituras por dia e 1 GB guardado. Cada visita lê os textos uma vez; as fotos
ficam no cache da Cloudflare depois da primeira visita. Para um site deste tamanho, sobra muito.

## Publicar na Cloudflare Pages

Uma vez só:

```
npx wrangler login
npx wrangler kv namespace create CONTENT     # copie o id mostrado para o wrangler.toml
npx wrangler pages project create vassen-site
npx wrangler pages secret put ADMIN_PASSWORD --project-name vassen-site
npx wrangler pages secret put SESSION_SECRET --project-name vassen-site   # texto aleatório longo
```

Depois, a cada mudança no código: `npm run deploy`. Ou conecte o repositório do GitHub no painel da
Cloudflare Pages (pasta de saída `public`, sem comando de build) para publicar a cada push.

Os textos editados pelo cliente **não** dependem de publicar de novo: aparecem no site em segundos
(até 1 minuto para chegar a todos os servidores da Cloudflare).

## Pendências antes de publicar

- [ ] Número do WhatsApp, links do Instagram/YouTube e do curso: pelo editor, em **Outros textos**.
- [ ] Domínio final: `canonical`, `og:url`, `og:image` e `url` nos dados estruturados.
- [ ] Imagem de compartilhamento (`og-vassen.jpg`, 1200 × 630 px).
- [ ] `sameAs` (redes sociais) nos dados estruturados do negócio.
- [ ] Trechos tracejados em laranja (classe `.todo`): o cliente preenche pelo editor e o tracejado some.
- [ ] Fotos reais nos sliders de antes/depois e na seção da história.
