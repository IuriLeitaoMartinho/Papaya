// Sem dependências: node tests/validar-pacote.mjs
// A app das lojas (Capacitor) leva exatamente os ficheiros que o sw.js guarda
// para o offline: nem um a menos (falharia sem rede) nem um a mais (sw.js,
// node_modules, android/, ios/ não podem ir dentro do pacote).
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listaAssets, preparar } from '../scripts/preparar-www.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

async function ficheiros(pasta) {
  const entradas = await readdir(pasta, { withFileTypes: true, recursive: true });
  return entradas.filter(e => e.isFile())
    .map(e => relative(pasta, join(e.parentPath, e.name)).split(sep).join('/'));
}

const assets = await listaAssets();
assert.ok(assets.length >= 30, 'a lista ASSETS do sw.js foi lida');
assert.ok(assets.includes('index.html') && !assets.includes(''), "'./' conta como index.html");

const destino = await mkdtemp(join(tmpdir(), 'papaya-www-'));
try {
  await preparar(destino);
  const copiados = (await ficheiros(destino)).sort();
  assert.deepEqual(copiados, [...assets].sort(), 'www/ tem os ficheiros do ASSETS e nada mais');
  for (const a of assets) {
    const original = await readFile(join(RAIZ, a));
    const copia = await readFile(join(destino, a));
    assert.ok(original.equals(copia), 'cópia igual ao original: ' + a);
  }

  // Preparar de novo por cima não deixa restos de uma versão anterior.
  await writeFile(join(destino, 'resto-antigo.js'), '');
  await preparar(destino);
  assert.ok(!(await ficheiros(destino)).includes('resto-antigo.js'), 'www/ é refeita do zero');
} finally {
  await rm(destino, { recursive: true, force: true });
}

const config = JSON.parse(await readFile(join(RAIZ, 'capacitor.config.json'), 'utf8'));
assert.equal(config.webDir, 'www');
assert.equal(config.appId, 'pt.papayabebe.app');
assert.equal(config.appName, 'Papaya');

console.log(`OK: ${assets.length} ficheiros no pacote, iguais aos do sw.js.`);
