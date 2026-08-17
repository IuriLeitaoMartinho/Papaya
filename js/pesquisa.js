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

// Palavras de ligação ignoradas na pesquisa (já normalizadas, sem acentos).
const LIGACAO = new Set([
  'que', 'com', 'para', 'por', 'dos', 'das', 'uma', 'uns', 'umas', 'nos', 'nas',
  'meu', 'sua', 'seu', 'este', 'esta', 'isso', 'mais', 'como', 'quais', 'pelo', 'pela'
]);

export function construirIndice() {
  const docs = [];
  for (const cap of capitulos) {
    for (const sec of cap.seccoes) {
      // O título pesquisável junta secção e subsecção, para que uma pesquisa
      // acerte tanto no tema geral como no detalhe.
      const tituloCompleto = sec.sub ? `${sec.titulo} ${sec.sub}` : sec.titulo;
      docs.push({
        capituloId: cap.id,
        capituloTitulo: cap.titulo,
        seccaoTitulo: sec.titulo,
        subTitulo: sec.sub || null,
        ancora: sec.ancora,
        texto: sec.texto,
        tituloNorm: normalizar(tituloCompleto),
        chavesNorm: normalizar(sec.chaves || ''),
        textoNorm: normalizar(sec.texto)
      });
    }
  }
  fuse = new Fuse(docs, {
    keys: [
      { name: 'tituloNorm', weight: 3 },
      { name: 'chavesNorm', weight: 2 },
      { name: 'textoNorm', weight: 1 }
    ],
    includeMatches: true,
    ignoreLocation: true,
    useExtendedSearch: true, // espaços entre termos funcionam como "E"
    threshold: 0.3,
    minMatchCharLength: 3
  });
}

// Liga uma caixa de pesquisa ao seu contentor de resultados. Enquanto a query
// tem menos de 2 caracteres, mostra `aoLimpar()` (ex.: a lista de capítulos).
export function ligarPesquisa(campo, alvo, aoLimpar) {
  campo.addEventListener('input', () => renderResultados(campo.value, alvo, aoLimpar));
}

function renderResultados(termo, alvo, aoLimpar) {
  const q = normalizar(termo.trim());
  if (q.length < 2) {
    if (aoLimpar) aoLimpar();
    else alvo.innerHTML = '';
    return;
  }
  // Vários termos = todos têm de aparecer (o espaço é "E" na pesquisa
  // estendida do Fuse). Cada termo continua a tolerar gralhas e acentos.
  // Palavras muito curtas e de ligação são descartadas: não ajudam a
  // distinguir resultados e, se destacadas, enchem o excerto de ruído.
  const todos = q.split(/\s+/).filter(Boolean);
  const uteis = todos.filter(t => t.length >= 3 && !LIGACAO.has(t));
  const termos = uteis.length ? uteis : todos;
  const consulta = termos.join(' ');
  let resultados = fuse.search(consulta, { limit: 40 });

  // Se a combinação de todos os termos não der nada, tenta o termo mais longo
  // sozinho, para não deixar o utilizador sem pistas.
  let parcial = false;
  if (!resultados.length && termos.length > 1) {
    const maisLongo = termos.reduce((a, b) => (b.length > a.length ? b : a));
    resultados = fuse.search(maisLongo, { limit: 40 });
    parcial = resultados.length > 0;
  }
  if (!resultados.length) {
    alvo.innerHTML = `<div class="vazio">Sem resultados para «${escaparHtml(termo)}».<br>Tenta outra palavra (ex: febre, sono, esterilizar).</div>`;
    return;
  }

  // O fuzzy é ótimo para gralhas, mas um acerto exato deve ganhar sempre a um
  // parecido: título > palavras-chave > texto. O sort é estável, por isso
  // dentro de cada grupo mantém-se o ranking do Fuse.
  const contem = (campo, d) => termos.every(t => d[campo].includes(t));
  const prioridade = d =>
    (contem('tituloNorm', d) ? 4 : 0) +
    (contem('chavesNorm', d) ? 2 : 0) +
    (contem('textoNorm', d) ? 1 : 0);
  resultados.sort((a, b) => prioridade(b.item) - prioridade(a.item));
  resultados.length = Math.min(resultados.length, 15);

  const aviso = parcial
    ? '<div class="nota-pesquisa">Sem resultados com todas as palavras. A mostrar os do termo mais específico.</div>'
    : '';

  alvo.innerHTML = aviso + resultados.map(r => {
    const d = r.item;
    const destino = '#guia/' + d.capituloId + (d.ancora ? '/' + d.ancora : '');
    const caminho = escaparHtml(d.capituloTitulo) +
      (d.subTitulo ? ' › ' + escaparHtml(d.seccaoTitulo) : '');
    return `<a class="resultado cartao" href="${destino}">
      <div class="caminho">${caminho}</div>
      <h3>${escaparHtml(d.subTitulo || d.seccaoTitulo)}</h3>
      <p>${excerto(d, r.matches, termos)}</p>
    </a>`;
  }).join('');
}

// Excerto do texto da secção com TODOS os termos destacados com <mark>.
// A janela é centrada na primeira ocorrência de um termo; se nenhum aparecer
// no texto (o acerto foi no título ou nas palavras-chave), mostra o início.
// A normalização preserva o comprimento, por isso os índices do texto
// normalizado servem diretamente para cortar o texto original.
function excerto(doc, matches, termos) {
  const texto = doc.texto, norm = doc.textoNorm;

  let a = -1;
  for (const t of termos) {
    const i = norm.indexOf(t);
    if (i !== -1 && (a === -1 || i < a)) a = i;
  }
  if (a === -1) {
    const m = (matches || []).find(x => x.key === 'textoNorm');
    if (m && m.indices.length) {
      a = m.indices.reduce((mel, par) => (par[1] - par[0] > mel[1] - mel[0] ? par : mel))[0];
    }
  }
  if (a === -1) {
    return escaparHtml(texto.slice(0, 160)) + (texto.length > 160 ? '…' : '');
  }

  let inicio = Math.max(0, a - 60);
  let fim = Math.min(texto.length, a + 170);
  // Ajusta aos limites de palavra para o excerto não cortar a meio.
  if (inicio > 0) { const esp = texto.indexOf(' ', inicio); if (esp !== -1 && esp < a) inicio = esp + 1; }
  if (fim < texto.length) { const esp = texto.lastIndexOf(' ', fim); if (esp > a) fim = esp; }

  // Intervalos a destacar dentro da janela, fundindo sobreposições.
  const janela = texto.slice(inicio, fim), janelaNorm = norm.slice(inicio, fim);
  const intervalos = [];
  for (const t of termos) {
    let i = janelaNorm.indexOf(t);
    while (i !== -1) { intervalos.push([i, i + t.length]); i = janelaNorm.indexOf(t, i + t.length); }
  }
  intervalos.sort((x, y) => x[0] - y[0]);
  const fundidos = [];
  for (const iv of intervalos) {
    const ultimo = fundidos[fundidos.length - 1];
    if (ultimo && iv[0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], iv[1]);
    else fundidos.push([...iv]);
  }

  let html = '', pos = 0;
  for (const [ini, f] of fundidos) {
    html += escaparHtml(janela.slice(pos, ini)) + '<mark>' + escaparHtml(janela.slice(ini, f)) + '</mark>';
    pos = f;
  }
  html += escaparHtml(janela.slice(pos));

  return (inicio > 0 ? '…' : '') + html + (fim < texto.length ? '…' : '');
}
