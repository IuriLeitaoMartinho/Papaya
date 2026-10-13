// Carregamento e rendering do conteúdo do guia (ficheiros Markdown em conteudo/).
//
// O parser suporta exatamente o mesmo subset de Markdown que o gerar_pdf.py:
//   # Capítulo   ## Secção   ### Subsecção
//   - listas     1. listas numeradas
//   > caixas de destaque
//   **negrito**  *itálico*  _itálico_  `código`
//   | tabelas | com pipes |

import { escaparHtml, icone } from './ui.js';

// Preenchido por carregarGuia(): [{id, titulo, linhas, seccoes:[{titulo, ancora, texto}]}]
export const capitulos = [];

// Agrupamento da lista do Guia, lido de dados/capitulos.json ("grupos").
// [{titulo, urgente, ids:[...]}] — os capítulos fora de qualquer grupo vão para "Outros".
export const grupos = [];

// Remove acentos e minusculiza — usado nos slugs e na pesquisa.
// (Para os diacríticos PT a remoção preserva o comprimento da string,
// por isso os índices da pesquisa alinham com o texto original.)
export const normalizar = s =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const slug = s =>
  normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function carregarGuia() {
  if (capitulos.length) return capitulos;
  const manifesto = await (await fetch('dados/capitulos.json')).json();
  const textos = await Promise.all(
    manifesto.capitulos.map(f => fetch('conteudo/' + f).then(r => {
      if (!r.ok) throw new Error('Falha ao carregar ' + f);
      return r.text();
    }))
  );
  manifesto.capitulos.forEach((ficheiro, i) => {
    const linhas = textos[i].split(/\r?\n/);
    const titulo = (linhas.find(l => l.startsWith('# ')) || '# ?').slice(2).trim();
    capitulos.push({
      id: ficheiro.replace(/\.md$/, ''),
      titulo,
      linhas,
      seccoes: extrairSeccoes(titulo, linhas)
    });
  });

  const arrumados = new Set();
  for (const g of manifesto.grupos || []) {
    const ids = (g.capitulos || []).map(f => f.replace(/\.md$/, ''))
      .filter(id => capitulos.some(c => c.id === id) && !arrumados.has(id));
    ids.forEach(id => arrumados.add(id));
    if (ids.length) grupos.push({ titulo: g.titulo, urgente: !!g.urgente, ids });
  }
  const soltos = capitulos.filter(c => !arrumados.has(c.id)).map(c => c.id);
  if (soltos.length) grupos.push({ titulo: grupos.length ? 'Outros' : '', urgente: false, ids: soltos });
  return capitulos;
}

// Divide um capítulo em secções (##) e subsecções (###) com texto simples, para
// a pesquisa. A granularidade fina importa em capítulos longos: um resultado
// aponta para a subsecção exata em vez de para o topo de uma secção enorme.
//
// Palavras-chave: uma linha `<!-- chaves: a, b, c -->` logo a seguir a um
// título acrescenta termos de pesquisa a essa secção (não aparecem no texto).
// As chaves da secção-mãe valem também para as suas subsecções.
function extrairSeccoes(tituloCapitulo, linhas) {
  const seccoes = [];
  let atual = { titulo: tituloCapitulo, sub: null, ancora: '', chaves: [], texto: [] };
  let chavesSeccao = [];

  const novaSeccao = (titulo, sub, ancora, chaves) => {
    if (atual.texto.length || atual.chaves.length) seccoes.push(fecharSeccao(atual));
    atual = { titulo, sub, ancora, chaves: [...chaves], texto: [] };
  };

  for (const linha of linhas) {
    const chaves = linha.match(/^<!--\s*chaves:\s*(.*?)\s*-->\s*$/i);
    if (chaves) {
      const lista = chaves[1].split(',').map(s => s.trim()).filter(Boolean);
      atual.chaves.push(...lista);
      if (!atual.sub) chavesSeccao = [...atual.chaves];
      continue;
    }
    if (linha.startsWith('## ')) {
      const t = linha.slice(3).trim();
      chavesSeccao = [];
      novaSeccao(t, null, slug(t), []);
    } else if (linha.startsWith('### ')) {
      const t = linha.slice(4).trim();
      // A subsecção herda as chaves da secção-mãe e guarda o título dela.
      novaSeccao(atual.sub ? atual.titulo : atual.titulo, t, slug(t), chavesSeccao);
    } else if (!linha.startsWith('# ')) {
      const limpo = linhaParaTexto(linha);
      if (limpo) atual.texto.push(limpo);
    }
  }
  seccoes.push(fecharSeccao(atual));
  return seccoes;
}

const fecharSeccao = s => ({
  titulo: s.titulo, sub: s.sub, ancora: s.ancora,
  chaves: s.chaves.join(', '), texto: s.texto.join(' ')
});

// Reduz uma linha Markdown a texto corrido (para indexar e mostrar excertos).
function linhaParaTexto(linha) {
  return linha
    .replace(/^###?\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
    .replace(/\|/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------- rendering ----

function inline(t) {
  return escaparHtml(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/(^|\s)_([^_]+)_(?=\s|[.,;:!?)]|$)/g, '$1<em>$2</em>');
}

// Converte as linhas de um capítulo em HTML. As secções ## recebem id=slug
// para navegação direta (pesquisa e "ler mais" do ecrã Hoje).
export function markdownParaHtml(linhas) {
  const saida = [];
  let paragrafo = [], lista = null, citacao = [], tabela = [];

  const fecharParagrafo = () => {
    if (paragrafo.length) { saida.push('<p>' + inline(paragrafo.join(' ')) + '</p>'); paragrafo = []; }
  };
  const fecharLista = () => {
    if (lista) { saida.push(`<${lista.tag}>` + lista.itens.map(i => '<li>' + inline(i) + '</li>').join('') + `</${lista.tag}>`); lista = null; }
  };
  const fecharCitacao = () => {
    if (citacao.length) { saida.push('<blockquote><p>' + citacao.map(inline).join('</p><p>') + '</p></blockquote>'); citacao = []; }
  };
  const fecharTabela = () => {
    if (!tabela.length) return;
    const filas = tabela.map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    const corpo = filas.filter(f => !f.every(c => /^:?-{2,}:?$/.test(c) || c === ''));
    if (corpo.length) {
      const [cab, ...resto] = corpo;
      saida.push('<div class="tabela-scroll"><table><thead><tr>' +
        cab.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        resto.map(f => '<tr>' + f.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>');
    }
    tabela = [];
  };
  const fecharTudo = () => { fecharParagrafo(); fecharLista(); fecharCitacao(); fecharTabela(); };

  for (const linha of linhas) {
    const l = linha.trimEnd();
    let m;
    // Comentários HTML (ex.: as palavras-chave da pesquisa) não são mostrados.
    if (/^<!--.*-->\s*$/.test(l)) continue;
    if (l.startsWith('# ')) {
      fecharTudo(); saida.push('<h1>' + inline(l.slice(2)) + '</h1>');
    } else if (l.startsWith('## ')) {
      fecharTudo();
      const t = l.slice(3).trim();
      saida.push(`<h2 id="${slug(t)}">` + inline(t) + '</h2>');
    } else if (l.startsWith('### ')) {
      fecharTudo();
      const t = l.slice(4).trim();
      saida.push(`<h3 id="${slug(t)}">` + inline(t) + '</h3>');
    } else if (l.startsWith('>')) {
      fecharParagrafo(); fecharLista(); fecharTabela();
      citacao.push(l.replace(/^>\s?/, ''));
    } else if ((m = l.match(/^\s*[-*]\s+(.*)/))) {
      fecharParagrafo(); fecharCitacao(); fecharTabela();
      if (!lista || lista.tag !== 'ul') { fecharLista(); lista = { tag: 'ul', itens: [] }; }
      lista.itens.push(m[1]);
    } else if ((m = l.match(/^\s*\d+\.\s+(.*)/))) {
      fecharParagrafo(); fecharCitacao(); fecharTabela();
      if (!lista || lista.tag !== 'ol') { fecharLista(); lista = { tag: 'ol', itens: [] }; }
      lista.itens.push(m[1]);
    } else if (l.startsWith('|')) {
      fecharParagrafo(); fecharLista(); fecharCitacao();
      tabela.push(l);
    } else if (l === '') {
      fecharTudo();
    } else {
      fecharLista(); fecharCitacao(); fecharTabela();
      paragrafo.push(l);
    }
  }
  fecharTudo();
  return saida.join('\n');
}

export function htmlCapitulo(id) {
  const cap = capitulos.find(c => c.id === id);
  if (!cap) return '<div class="vazio">Capítulo não encontrado.</div>';
  // O índice das secções entra logo a seguir ao título (só na app: o PDF tem o seu).
  const html = markdownParaHtml(cap.linhas);
  const fimTitulo = html.indexOf('</h1>');
  const corpo = fimTitulo === -1
    ? indiceCapitulo(cap) + html
    : html.slice(0, fimTitulo + 5) + indiceCapitulo(cap) + html.slice(fimTitulo + 5);
  return '<article class="capitulo">' + corpo + '</article>';
}

// Títulos das secções ## de um capítulo, pela ordem do texto.
export const seccoesDoCapitulo = cap =>
  cap.linhas.filter(l => l.startsWith('## ')).map(l => l.slice(3).trim());

// Índice clicável das secções. Capítulos curtos (menos de 3 secções) não precisam.
function indiceCapitulo(cap) {
  const titulos = seccoesDoCapitulo(cap);
  if (titulos.length < 3) return '';
  return `<details class="indice lista" open>
    <summary>Neste capítulo <span class="conta">${titulos.length} secções</span>${icone('seta-baixo')}</summary>
    <ol>` + titulos.map(t =>
      `<li><a href="#guia/${cap.id}/${slug(t)}" data-ancora="${slug(t)}">${inline(t)}</a></li>`).join('') +
    '</ol></details>';
}
