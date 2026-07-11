// Ecrã "Hoje": idade da criança e dicas adequadas à faixa etária,
// carregadas de dados/faixas-etarias.json (editável sem tocar no código).

import { estado } from './armazenamento.js';
import { capitulos, slug } from './conteudo.js';
import { escaparHtml } from './ui.js';

let entradas = null;

const CATEGORIAS = {
  desenvolvimento: { rotulo: 'O que esperar', cor: 'var(--c-desenvolvimento)' },
  estimulacao:     { rotulo: 'O que trabalhar', cor: 'var(--c-estimulacao)' },
  saude:           { rotulo: 'Saúde', cor: 'var(--c-saude)' },
  consulta:        { rotulo: 'Consulta', cor: 'var(--c-consulta)' },
  vacina:          { rotulo: 'Vacinas', cor: 'var(--c-vacina)' },
  alerta:          { rotulo: 'Sinal a vigiar', cor: 'var(--c-alerta)' }
};

async function carregarEntradas() {
  if (!entradas) {
    entradas = (await (await fetch('dados/faixas-etarias.json')).json()).entradas;
  }
  return entradas;
}

// Meses completos de vida (negativo se a data for no futuro).
export function idadeEmMeses(dataNascimento) {
  const n = new Date(dataNascimento + 'T00:00:00');
  const h = new Date();
  let m = (h.getFullYear() - n.getFullYear()) * 12 + h.getMonth() - n.getMonth();
  if (h.getDate() < n.getDate()) m--;
  return m;
}

// "23 dias", "7 meses e 12 dias", "1 ano e 3 meses" — para o cabeçalho.
export function textoIdade(dataNascimento) {
  const n = new Date(dataNascimento + 'T00:00:00');
  const h = new Date();
  if (n > h) return 'a caminho';
  const meses = idadeEmMeses(dataNascimento);
  if (meses < 1) {
    const dias = Math.floor((h - n) / 86400000);
    return dias === 1 ? '1 dia' : dias + ' dias';
  }
  if (meses < 24) {
    const ancora = new Date(n); ancora.setMonth(ancora.getMonth() + meses);
    const dias = Math.floor((h - ancora) / 86400000);
    const anos = meses >= 12 ? '1 ano e ' + (meses - 12) + (meses - 12 === 1 ? ' mês' : ' meses') : meses + ' meses';
    if (meses >= 12) return anos;
    return dias > 0 ? `${meses} ${meses === 1 ? 'mês' : 'meses'} e ${dias} ${dias === 1 ? 'dia' : 'dias'}` : `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  }
  const anos = Math.floor(meses / 12), resto = meses % 12;
  return anos + ' anos' + (resto ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : '');
}

const rotuloMeses = m => m === 0 ? 'ao nascer' : m === 24 ? 'aos 2 anos' : m === 1 ? 'com 1 mês' : `aos ${m} meses`;

function cartaoDica(e, quando) {
  const cat = CATEGORIAS[e.categoria] || CATEGORIAS.saude;
  let link = '';
  if (e.capitulo && capitulos.find(c => c.id === e.capitulo)) {
    const destino = '#guia/' + e.capitulo + (e.seccao ? '/' + slug(e.seccao) : '');
    link = `<a class="ler-mais" href="${destino}">Ler mais no guia →</a>`;
  }
  return `<div class="cartao dica ${quando ? 'pontual' : ''}" style="--cor:${cat.cor}">
    <span class="etiqueta">${cat.rotulo}${quando ? ` · <span class="quando">${quando}</span>` : ''}</span>
    <h3>${escaparHtml(e.titulo)}</h3>
    <p>${escaparHtml(e.texto)}</p>
    ${link}</div>`;
}

export async function renderHoje(alvo) {
  const { dataNascimento, nomeCrianca } = estado.definicoes;
  if (!dataNascimento) {
    alvo.innerHTML = `<div class="vazio">Para veres dicas adequadas à idade,
      indica a data de nascimento nas definições (⚙ no canto superior direito).</div>`;
    return;
  }
  const lista = await carregarEntradas();
  const meses = idadeEmMeses(dataNascimento);

  if (meses < 0) {
    alvo.innerHTML = `<div class="vazio">${escaparHtml(nomeCrianca || 'O bebé')} ainda vem a caminho.
      Espreita entretanto o capítulo da mala da maternidade no Guia.</div>`;
    return;
  }
  if (meses > 25) {
    alvo.innerHTML = `<div class="vazio">Este guia cobre dos 0 aos 2 anos — que voam.
      O conteúdo do Guia e a Pesquisa continuam disponíveis.</div>`;
    return;
  }

  const atuais = lista.filter(e => e.mesesMin <= meses && meses <= e.mesesMax);
  const porCategoria = c => atuais.filter(e => e.categoria === c && !ehPontual(e));

  // Consultas/vacinas: as deste mês ("é agora") e o próximo marco futuro.
  const pontuais = lista.filter(ehPontual).sort((a, b) => a.mesesMin - b.mesesMin);
  const agora = pontuais.filter(e => e.mesesMin === meses);
  const futuras = pontuais.filter(e => e.mesesMin > meses);
  const proximoMarco = futuras.length ? futuras[0].mesesMin : null;
  const proximas = futuras.filter(e => e.mesesMin === proximoMarco);

  let html = '';
  if (agora.length) {
    html += '<div class="subtitulo">É este mês</div>' +
      agora.map(e => cartaoDica(e, 'agora')).join('');
  }
  const seccoes = [
    ['Nesta idade', [...porCategoria('desenvolvimento'), ...porCategoria('estimulacao')]],
    ['Saúde e rotinas', porCategoria('saude')],
    ['Sinais a vigiar', porCategoria('alerta')]
  ];
  for (const [titulo, grupo] of seccoes) {
    if (grupo.length) html += `<div class="subtitulo">${titulo}</div>` + grupo.map(e => cartaoDica(e)).join('');
  }
  if (proximas.length) {
    html += '<div class="subtitulo">A seguir</div>' +
      proximas.map(e => cartaoDica(e, rotuloMeses(e.mesesMin))).join('');
  }
  alvo.innerHTML = html || '<div class="vazio">Sem dicas para esta idade — acrescenta entradas em dados/faixas-etarias.json.</div>';
}

const ehPontual = e => e.categoria === 'consulta' || e.categoria === 'vacina';
