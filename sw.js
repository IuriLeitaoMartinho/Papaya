// Service worker: pré-cache de todos os assets para a app funcionar offline.
//
// IMPORTANTE: sempre que alterares conteúdo (.md), dados (.json) ou código,
// incrementa a VERSAO abaixo. É isso que faz os telemóveis que já têm a app
// instalada irem buscar a versão nova.
const VERSAO = 'papaya-v24';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './css/estilo.css',
  './js/app.js',
  './js/ui.js',
  './js/armazenamento.js',
  './js/conteudo.js',
  './js/pesquisa.js',
  './js/idade.js',
  './js/tarefas.js',
  './js/montessori.js',
  './js/calendario.js',
  './js/chama.js',
  './js/temporizador.js',
  './js/sono.js',
  './js/vendor/fuse.min.mjs',
  './dados/capitulos.json',
  './dados/faixas-etarias.json',
  './dados/montessori.json',
  './dados/chama.json',
  './conteudo/01-como-usar.md',
  './conteudo/02-emergencias.md',
  './conteudo/03-mala-maternidade.md',
  './conteudo/04-recem-nascido.md',
  './conteudo/05-alimentacao.md',
  './conteudo/06-sono.md',
  './conteudo/07-sintomas-az.md',
  './conteudo/08-desenvolvimento.md',
  './conteudo/09-vacinas-consultas.md',
  './conteudo/10-seguranca.md',
  './conteudo/11-ser-pai.md',
  './conteudo/12-montessori.md',
  './conteudo/13-licenca-parental.md',
  './conteudo/14-burocracia.md',
  './conteudo/15-esterilizacao.md',
  './conteudo/16-fontes.md'
];

// Os mesmos recursos como URLs completos, para comparar com o pedido.
const RECURSOS = new Set(ASSETS.map(a => new URL(a, self.location).href));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Apaga só as versões antigas da própria app; caches de outros (ex.: um SDK) ficam.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(chaves =>
      Promise.all(chaves.filter(k => k.startsWith('papaya-') && k !== VERSAO).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first com fallback ao cache: online recebe sempre a versão mais
// recente; offline serve o que está pré-armazenado.
// Só os pedidos da própria app passam por aqui: anúncios, consentimento e
// outros domínios seguem direto para a rede, sem tocar na cache. E só uma
// resposta 200 de um recurso da lista entra na cache — um 404 ou 500 do
// servidor nunca substitui a cópia boa; nesse caso serve-se a cópia.
self.addEventListener('fetch', e => {
  const pedido = e.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  url.search = '';
  url.hash = '';
  const daCache = () => caches.match(pedido, { ignoreSearch: true });
  e.respondWith((async () => {
    let res;
    try {
      res = await fetch(pedido);
    } catch {
      return (await daCache()) || Response.error();
    }
    if (res.status === 200 && !res.redirected && RECURSOS.has(url.href)) {
      const copia = res.clone();
      e.waitUntil(caches.open(VERSAO).then(c => c.put(url.href, copia)));
    } else if (!res.ok) {
      return (await daCache()) || res;
    }
    return res;
  })());
});
