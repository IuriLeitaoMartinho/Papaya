// Prepara a pasta www/ que o Capacitor mete dentro das apps Android e iOS.
// Uso: node scripts/preparar-www.mjs   (ou npm run preparar)
//
// A lista de ficheiros é a ASSETS do sw.js: o que funciona offline no browser
// é exatamente o que vai no pacote. Um ficheiro novo da app entra no ASSETS e
// passa a ir para os dois sítios. O próprio sw.js fica de fora: a app nativa
// não regista o service worker (os ficheiros já estão no telemóvel).
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

export async function listaAssets() {
  const sw = await readFile(join(RAIZ, 'sw.js'), 'utf8');
  const bloco = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  if (!bloco) throw new Error('Não encontrei a lista ASSETS no sw.js');
  const caminhos = [...bloco[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1] || 'index.html');
  return [...new Set(caminhos)];
}

export async function preparar(destino = join(RAIZ, 'www')) {
  await rm(destino, { recursive: true, force: true });
  for (const a of await listaAssets()) {
    await mkdir(dirname(join(destino, a)), { recursive: true });
    await cp(join(RAIZ, a), join(destino, a));
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await preparar();
  console.log('www/ preparada com os ficheiros do ASSETS do sw.js.');
}
