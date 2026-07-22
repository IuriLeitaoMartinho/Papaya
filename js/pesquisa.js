// Pesquisa no conteúdo do guia (Fuse.js, client-side).
//
// Cada secção "##" de cada capítulo é um documento do índice. A tolerância a
// acentos vem de indexarmos cópias normalizadas (sem diacríticos) e de
// normalizarmos a query da mesma maneira; a tolerância a pequenos erros vem
// do fuzzy matching do Fuse. Como a normalização preserva o comprimento,
// os índices dos matches servem diretamente para destacar no texto original.

import Fuse from './vendor/fuse.min.mjs';
import { capitulos, normalizar } from './conteudo.js';
import { $, escaparHtml } from './ui.js';

let fuse = null;

export function construirIndice() {
  const docs = [];
  for (const cap of capitulos) {
    for (const sec of cap.seccoes) {
      docs.push({
        capituloId: cap.id,
        capituloTitulo: cap.titulo,
        seccaoTitulo: sec.titulo,
        ancora: sec.ancora,
        texto: sec.texto,
        tituloNorm: normalizar(sec.titulo),
        textoNorm: normalizar(sec.texto)
      });
    }
  }
  fuse = new Fuse(docs, {
    keys: [
      { name: 'tituloNorm', weight: 2 },
      { name: 'textoNorm', weight: 1 }
    ],
    includeMatches: true,
    ignoreLocation: true,
    threshold: 0.3,
    minMatchCharLength: 3
  });
}

export function ligarPesquisa() {
  const campo = $('#campoPesquisa');
  campo.addEventListener('input', () => renderResultados(campo.value));
}

function renderResultados(termo) {
  const alvo = $('#resultadosPesquisa');
  const q = normalizar(termo.trim());
  if (q.length < 2) {
    alvo.innerHTML = '<div class="vazio">Escreve para pesquisar em todo o guia.<br>A pesquisa ignora acentos e perdoa gralhas.</div>';
    return;
  }
  const resultados = fuse.search(q, { limit: 30 });
  if (!resultados.length) {
    alvo.innerHTML = `<div class="vazio">Sem resultados para «${escaparHtml(termo)}».<br>Tenta outra palavra (ex: febre, sono, papa).</div>`;
    return;
  }
  // O fuzzy é ótimo para gralhas, mas um match exato deve ganhar sempre a um
  // parecido: reordena por (termo no título) > (termo no texto) > ordem do Fuse.
  // O sort é estável, por isso dentro de cada grupo mantém-se o ranking do Fuse.
  const prioridade = d => d.tituloNorm.includes(q) ? 2 : (d.textoNorm.includes(q) ? 1 : 0);
  resultados.sort((a, b) => prioridade(b.item) - prioridade(a.item));
  resultados.length = Math.min(resultados.length, 15);
  alvo.innerHTML = resultados.map(r => {
    const d = r.item;
    const destino = '#guia/' + d.capituloId + (d.ancora ? '/' + d.ancora : '');
    return `<a class="resultado cartao" href="${destino}">
      <div class="caminho">${escaparHtml(d.capituloTitulo)}</div>
      <h3>${escaparHtml(d.seccaoTitulo)}</h3>
      <p>${excerto(d, r.matches, q)}</p>
    </a>`;
  }).join('');
}

// Excerto do texto da secção com o melhor match destacado com <mark>.
// Se o termo aparecer tal e qual no texto, destaca essa ocorrência;
// senão usa o melhor intervalo fuzzy devolvido pelo Fuse.
function excerto(doc, matches, qNorm) {
  let a = doc.textoNorm.indexOf(qNorm);
  let b = a + qNorm.length;
  if (a === -1) {
    const m = (matches || []).find(x => x.key === 'textoNorm');
    if (!m || !m.indices.length) {
      return escaparHtml(doc.texto.slice(0, 140)) + (doc.texto.length > 140 ? '…' : '');
    }
    // Escolhe o intervalo de match mais longo.
    [a, b] = m.indices.reduce((melhor, par) =>
      (par[1] - par[0] > melhor[1] - melhor[0] ? par : melhor));
    b += 1; // Fuse devolve fim inclusivo
  }

  const texto = doc.texto;
  let inicio = Math.max(0, a - 60);
  let fim = Math.min(texto.length, b + 90);
  // Ajusta aos limites de palavra para o excerto não cortar a meio.
  if (inicio > 0) { const esp = texto.indexOf(' ', inicio); if (esp !== -1 && esp < a) inicio = esp + 1; }
  if (fim < texto.length) { const esp = texto.lastIndexOf(' ', fim); if (esp > b) fim = esp; }

  return (inicio > 0 ? '…' : '') +
    escaparHtml(texto.slice(inicio, a)) +
    '<mark>' + escaparHtml(texto.slice(a, b)) + '</mark>' +
    escaparHtml(texto.slice(b, fim)) +
    (fim < texto.length ? '…' : '');
}
