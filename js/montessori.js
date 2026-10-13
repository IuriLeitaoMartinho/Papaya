// Separador Montessori: dica do dia, princípios e atividades por idade,
// carregados de dados/montessori.json (editável sem tocar no código).
//
// A dica do dia roda de forma determinística pela data (todos os dispositivos
// veem a mesma dica no mesmo dia). Dicas com mesesMin/mesesMax só entram na
// rotação quando a idade da criança está na faixa.

import { capitulos, slug } from './conteudo.js';
import { escaparHtml, icone } from './ui.js';

const CAPITULO = '12-montessori';
let dados = null;

async function carregarDados() {
  if (!dados) {
    dados = await (await fetch('dados/montessori.json')).json();
  }
  return dados;
}

const linkSeccao = seccao => {
  if (!capitulos.find(c => c.id === CAPITULO)) return '';
  return '#guia/' + CAPITULO + (seccao ? '/' + slug(seccao) : '');
};

// Número do dia local (igual em todo o lado durante o mesmo dia).
const diaLocal = () => {
  const h = new Date();
  return Math.floor((h.getTime() - h.getTimezoneOffset() * 60000) / 86400000);
};

// Devolve a dica de hoje. `meses` = idade da criança em meses (ou null).
export async function dicaDoDia(meses) {
  const d = await carregarDados();
  const aplicavel = t => t.mesesMin == null ||
    (meses != null && meses >= t.mesesMin && meses <= t.mesesMax);
  const n = d.dicas.length;
  for (let i = 0; i < n; i++) {
    const t = d.dicas[(diaLocal() + i) % n];
    if (aplicavel(t)) return t;
  }
  return d.dicas[diaLocal() % n];
}

// Cartão da dica do dia (usado no ecrã Hoje e no separador Montessori).
export function cartaoDicaDia(dica) {
  const destino = linkSeccao(dica.seccao);
  return `<article class="cartao dica dica-montessori" style="--cor:var(--c-montessori)">
    <span class="etiqueta">${icone('rebento')}Montessori · dica do dia</span>
    <h3>${escaparHtml(dica.titulo)}</h3>
    <p>${escaparHtml(dica.texto)}</p>
    ${destino ? `<a class="ler-mais" href="${destino}">Ler no guia${icone('seta-dir')}</a>` : ''}</article>`;
}

const FAIXAS = [[0, 3], [3, 6], [6, 12], [12, 18], [18, 24]];
const rotuloFaixa = ([a, b]) => `${a}–${b} meses`;

export async function renderMontessori(alvo, meses) {
  const d = await carregarDados();

  let html = cartaoDicaDia(await dicaDoDia(meses));

  // Atividades: para a idade atual, ou todas por faixa se não houver data de nascimento.
  if (meses != null && meses >= 0 && meses <= 25) {
    const atuais = d.atividades.filter(a => a.mesesMin <= meses && meses <= a.mesesMax);
    if (atuais.length) {
      // A faixa etária só se repete quando muda de uma atividade para a seguinte.
      html += '<h2 class="subtitulo">Atividades para a idade atual</h2><div class="lista">' +
        atuais.map((a, i) => cartaoAtividade(a, a.mesesMin !== atuais[i - 1]?.mesesMin)).join('') + '</div>';
    }
  } else {
    html += '<h2 class="subtitulo">Atividades por idade</h2>';
    for (const faixa of FAIXAS) {
      const grupo = d.atividades.filter(a => a.mesesMin === faixa[0]);
      if (!grupo.length) continue;
      html += `<h3 class="subtitulo faixa">${rotuloFaixa(faixa)}</h3><div class="lista">` +
        grupo.map(a => cartaoAtividade(a, false)).join('') + '</div>';
    }
  }

  html += '<h2 class="subtitulo">Os seis princípios</h2><div class="lista principios">' +
    d.principios.map(p => `<div class="principio"><div>
      <h3>${escaparHtml(p.titulo)}</h3>
      <p>${escaparHtml(p.texto)}</p>
    </div></div>`).join('') + '</div>';

  const capitulo = linkSeccao();
  if (capitulo) html += `<a class="botao-secundario botao-link" href="${capitulo}">Ler o capítulo Montessori${icone('seta-dir')}</a>`;

  alvo.innerHTML = html;
}

function cartaoAtividade(a, comFaixa) {
  return `<article class="dica" style="--cor:var(--c-montessori)">
    ${comFaixa ? `<span class="etiqueta">${a.mesesMin}–${a.mesesMax} meses</span>` : ''}
    <h3>${escaparHtml(a.titulo)}</h3>
    <p>${escaparHtml(a.texto)}</p>
  </article>`;
}
