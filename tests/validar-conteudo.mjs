// Sem dependências: node tests/validar-conteudo.mjs
// Exercita o parser e o motor de pesquisa reais, com conteúdo do disco.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = new URL('../', import.meta.url);
globalThis.document = { addEventListener() {} };
globalThis.fetch = async caminho => {
  const texto = await readFile(new URL(caminho, raiz), 'utf8');
  return { ok: true, text: async () => texto, json: async () => JSON.parse(texto) };
};
const { carregarGuia, capitulos, markdownParaHtml, slug } = await import('../js/conteudo.js');
const { construirIndice, ligarPesquisa } = await import('../js/pesquisa.js');
await carregarGuia();
assert.equal(capitulos.length, 16);
for (const c of capitulos) {
  assert(c.seccoes.some(s => s.chaves), `Sem palavras-chave: ${c.id}`);
  const html = markdownParaHtml(c.linhas);
  assert(!html.includes('<!-- chaves:'), `Palavras-chave visíveis: ${c.id}`);
  for (const sec of c.seccoes.filter(s => s.ancora)) {
    assert(html.includes(`id="${sec.ancora}"`), `Âncora em falta: ${c.id}/${sec.ancora}`);
  }
}
const dicas = JSON.parse(await readFile(new URL('dados/faixas-etarias.json', raiz), 'utf8'));
for (const d of dicas.entradas.filter(d => d.capitulo)) {
  const c = capitulos.find(c => c.id === d.capitulo);
  assert(c, `Capítulo inexistente: ${d.capitulo}`);
  if (d.seccao) assert(c.seccoes.some(s => s.ancora === slug(d.seccao)), `Secção inexistente: ${d.capitulo}/${d.seccao}`);
}

construirIndice();
let pesquisar;
const campo = { value: '', addEventListener: (tipo, fn) => { assert.equal(tipo, 'input'); pesquisar = fn; } };
const alvo = { innerHTML: '' };
ligarPesquisa(campo, alvo);
const casos = [
  ['nariz entupido', '07-sintomas-az/constipacao-resfriado-comum'],
  ['nao faz coco', '07-sintomas-az/obstipacao-prisao-de-ventre'],
  ['olho colado', '07-sintomas-az/conjuntivite-e-olho-remeloso'],
  ['nao acorda', '02-emergencias/liga-112-imediatamente-se-o-bebe'],
  ['engasgou', '10-seguranca/engasgamento-manobras'],
  ['umbigo', '04-recem-nascido/cordao-umbilical'],
  ['só dorme ao colo', '06-sono/problemas-frequentes'],
  ['pn20', '09-vacinas-consultas/programa-nacional'],
  ['dias pai', '13-licenca-parental/o-essencial'],
  ['creche gratuita', '14-burocracia/6-creche'],
];
for (const [q, destino] of casos) {
  campo.value = q;
  pesquisar();
  const links = [...alvo.innerHTML.matchAll(/href="#guia\/([^"#]+)"/g)].map(m => m[1]);
  assert(links.slice(0, 3).some(l => l.startsWith(destino)), `${q}: ${links.slice(0, 3).join(', ')}`);
}
const sw = await readFile(new URL('sw.js', raiz), 'utf8');
const assets = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]);
for (const asset of assets) await access(fileURLToPath(new URL(asset || './', raiz)));
for (const c of capitulos) assert(assets.includes(`conteudo/${c.id}.md`), `Fora do offline: ${c.id}`);
console.log(`OK: ${capitulos.length} capítulos; palavras-chave ocultas; âncoras; ${dicas.entradas.length} dicas; ${casos.length} pesquisas; ${assets.length} recursos offline.`);
