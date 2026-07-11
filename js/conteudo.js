// Carregamento e rendering do conteúdo do guia (ficheiros Markdown em conteudo/).
//
// O parser suporta exatamente o mesmo subset de Markdown que o gerar_pdf.py:
//   # Capítulo   ## Secção   ### Subsecção
//   - listas     1. listas numeradas
//   > caixas de destaque
//   **negrito**  *itálico*  _itálico_  `código`
//   | tabelas | com pipes |

import { escaparHtml } from './ui.js';

// Preenchido por carregarGuia(): [{id, titulo, linhas, seccoes:[{titulo, ancora, texto}]}]
export const capitulos = [];

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
  return capitulos;
}

// Divide um capítulo em secções (## ...) com texto simples, para a pesquisa.
// O texto antes da primeira secção conta como secção com o título do capítulo.
function extrairSeccoes(tituloCapitulo, linhas) {
  const seccoes = [];
  let atual = { titulo: tituloCapitulo, ancora: '', texto: [] };
  for (const linha of linhas) {
    if (linha.startsWith('## ')) {
      if (atual.texto.length) seccoes.push(fecharSeccao(atual));
      const t = linha.slice(3).trim();
      atual = { titulo: t, ancora: slug(t), texto: [] };
    } else if (!linha.startsWith('# ')) {
      const limpo = linhaParaTexto(linha);
      if (limpo) atual.texto.push(limpo);
    }
  }
  seccoes.push(fecharSeccao(atual));
  return seccoes;
}

const fecharSeccao = s => ({ titulo: s.titulo, ancora: s.ancora, texto: s.texto.join(' ') });

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
    if (l.startsWith('# ')) {
      fecharTudo(); saida.push('<h1>' + inline(l.slice(2)) + '</h1>');
    } else if (l.startsWith('## ')) {
      fecharTudo();
      const t = l.slice(3).trim();
      saida.push(`<h2 id="${slug(t)}">` + inline(t) + '</h2>');
    } else if (l.startsWith('### ')) {
      fecharTudo(); saida.push('<h3>' + inline(l.slice(4)) + '</h3>');
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
  return '<article class="capitulo">' + markdownParaHtml(cap.linhas) + '</article>';
}
