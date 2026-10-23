// Sem dependências: node tests/validar-sw.mjs
// Corre o sw.js real com rede e caches simuladas: um erro do servidor nunca
// pode estragar a cópia offline, e pedidos de fora da app não entram na cache.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BASE = 'https://exemplo.test/Papaya/';
const ouvintes = {};
globalThis.self = {
  location: new URL('sw.js', BASE),
  addEventListener: (tipo, fn) => { ouvintes[tipo] = fn; },
  skipWaiting() {},
  clients: { claim() {} }
};

// Caches em memória: nome -> Map(url sem query -> Response)
const lojas = new Map();
const semQuery = u => { const x = new URL(typeof u === 'string' ? u : u.url, BASE); x.search = ''; return x.href; };
const loja = nome => {
  if (!lojas.has(nome)) lojas.set(nome, new Map());
  const m = lojas.get(nome);
  return {
    put: async (pedido, res) => { m.set(typeof pedido === 'string' ? pedido : pedido.url, res); },
    addAll: async lista => {
      for (const a of lista) {
        const res = await fetch(new Request(new URL(a, self.location).href));
        if (!res.ok) throw new TypeError('addAll: ' + a);
        m.set(new URL(a, self.location).href, res);
      }
    }
  };
};
globalThis.caches = {
  open: async nome => loja(nome),
  keys: async () => [...lojas.keys()],
  delete: async nome => lojas.delete(nome),
  match: async (pedido, { ignoreSearch } = {}) => {
    for (const m of lojas.values()) {
      for (const [k, res] of m) {
        if (k === pedido.url || (ignoreSearch && semQuery(k) === semQuery(pedido))) return res.clone();
      }
    }
  }
};

// Rede simulada: cada teste diz o que o servidor responde.
let servidor = url => new Response('original:' + url, { status: 200 });
globalThis.fetch = async pedido => servidor(typeof pedido === 'string' ? pedido : pedido.url);

new Function(await readFile(new URL('../sw.js', import.meta.url), 'utf8'))();
const VERSAO = [...(await readFile(new URL('../sw.js', import.meta.url), 'utf8'))
  .matchAll(/const VERSAO = '([^']+)'/g)][0][1];

const espera = [];
const evento = (tipo, extra = {}) => ({ waitUntil: p => espera.push(p), ...extra });
const pedir = async (url, metodo = 'GET') => {
  let resposta;
  ouvintes.fetch(evento('fetch', { request: new Request(url, { method: metodo }), respondWith: p => { resposta = p; } }));
  const res = resposta && await resposta;
  await Promise.all(espera.splice(0));
  return res;
};
const guardado = async url => { const r = lojas.get(VERSAO).get(url); return r && r.clone().text(); };

// Instalação e ativação: só as versões antigas da app são apagadas.
lojas.set('papaya-v1', new Map());
lojas.set('outra-biblioteca', new Map());
ouvintes.install(evento('install'));
await Promise.all(espera.splice(0));
ouvintes.activate(evento('activate'));
await Promise.all(espera.splice(0));
assert.deepEqual([...lojas.keys()].sort(), ['outra-biblioteca', VERSAO].sort());
assert.equal(lojas.get(VERSAO).size, 39);

const APP = BASE + 'js/app.js';
const original = await guardado(APP);

// Erro do servidor: serve-se a cópia boa e a cache não muda.
for (const status of [404, 500, 503]) {
  servidor = () => new Response('erro', { status });
  const res = await pedir(APP);
  assert.equal(res.status, 200, `Com ${status} devia servir a cópia`);
  assert.equal(await res.text(), original);
  assert.equal(await guardado(APP), original, `Um ${status} estragou a cópia`);
}

// Sem rede: serve-se a cópia; sem cópia, falha como a rede.
servidor = () => { throw new TypeError('Failed to fetch'); };
assert.equal(await (await pedir(APP)).text(), original);
assert.equal((await pedir(BASE + 'nao-existe.html')).type, 'error');

// Resposta boa: atualiza a cópia, guardada sem a query string.
servidor = () => new Response('nova versão', { status: 200 });
assert.equal(await (await pedir(APP + '?v=2')).text(), 'nova versão');
assert.equal(await guardado(APP), 'nova versão');
assert(![...lojas.get(VERSAO).keys()].some(k => k.includes('?')), 'Guardou uma entrada com query string');

// Um recurso da app que não está na lista não entra na cache.
const antes = lojas.get(VERSAO).size;
await pedir(BASE + 'privacidade.html');
assert.equal(lojas.get(VERSAO).size, antes);

// Erro de um recurso sem cópia passa tal como veio.
servidor = () => new Response('não há', { status: 404 });
assert.equal((await pedir(BASE + 'outra.html')).status, 404);

// Outros domínios (anúncios, consentimento) e pedidos que não são GET não passam pelo SW.
servidor = () => new Response('anúncio', { status: 200 });
assert.equal(await pedir('https://googleads.g.doubleclick.net/pagead/ads?x=1'), undefined);
assert.equal(await pedir('https://fundingchoicesmessages.google.com/i/pub'), undefined);
assert.equal(await pedir(APP, 'POST'), undefined);
assert.equal(lojas.get(VERSAO).size, antes);

console.log(`OK: ${VERSAO} com 39 recursos; 404/500/503 e rede em baixo servem a cópia boa; ` +
  'só respostas 200 da lista entram na cache; outros domínios e POST ficam de fora.');
