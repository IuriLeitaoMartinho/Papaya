// Service worker: pré-cache de todos os assets para a app funcionar offline.
//
// IMPORTANTE: sempre que alterares conteúdo (.md), dados (.json) ou código,
// incrementa a VERSAO abaixo. É isso que faz os telemóveis que já têm a app
// instalada irem buscar a versão nova.
const VERSAO = 'papaya-v7';

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
  './js/temporizador.js',
  './js/vendor/fuse.min.mjs',
  './dados/capitulos.json',
  './dados/faixas-etarias.json',
  './dados/montessori.json',
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
  './conteudo/14-fontes.md'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(chaves =>
      Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first com fallback ao cache: online recebe sempre a versão mais
// recente; offline serve o que está pré-armazenado.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copia = res.clone();
        caches.open(VERSAO).then(c => c.put(e.request, copia));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
