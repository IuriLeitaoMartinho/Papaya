// Ecrã "Hoje": idade da criança e dicas adequadas à faixa etária,
// carregadas de dados/faixas-etarias.json (editável sem tocar no código).

import { estado } from './armazenamento.js';
import { capitulos, slug } from './conteudo.js';
import { dicaDoDia, cartaoDicaDia } from './montessori.js';
import { cartoesChama, ligarCartoesChama } from './chama.js';
import { renderCalendario } from './calendario.js';
import { renderTarefasHoje } from './tarefas.js';
import { ligarBotaoMamada } from './temporizador.js';
import { renderSonoHoje } from './sono.js';
import { escaparHtml, icone } from './ui.js';

let entradas = null;

const CATEGORIAS = {
  desenvolvimento: { rotulo: 'O que esperar', cor: 'var(--c-desenvolvimento)', icone: 'estrela' },
  estimulacao:     { rotulo: 'O que trabalhar', cor: 'var(--c-estimulacao)', icone: 'blocos' },
  saude:           { rotulo: 'Saúde', cor: 'var(--c-saude)', icone: 'coracao' },
  seguranca:       { rotulo: 'Segurança', cor: 'var(--c-alerta)', icone: 'escudo' },
  burocracia:      { rotulo: 'Papelada', cor: 'var(--c-burocracia)', icone: 'papelada' },
  preparacao:      { rotulo: 'Preparar', cor: 'var(--c-preparacao)', icone: 'saco' },
  consulta:        { rotulo: 'Consulta', cor: 'var(--c-consulta)', icone: 'estetoscopio' },
  vacina:          { rotulo: 'Vacinas', cor: 'var(--c-vacina)', icone: 'seringa' },
  alerta:          { rotulo: 'Sinal a vigiar', cor: 'var(--c-alerta)', icone: 'alerta' }
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
    if (meses >= 12) {
      const resto = meses - 12;
      return resto ? `1 ano e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : '1 ano';
    }
    const ancora = new Date(n); ancora.setMonth(ancora.getMonth() + meses);
    const dias = Math.floor((h - ancora) / 86400000);
    return dias > 0 ? `${meses} ${meses === 1 ? 'mês' : 'meses'} e ${dias} ${dias === 1 ? 'dia' : 'dias'}` : `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  }
  const anos = Math.floor(meses / 12), resto = meses % 12;
  return anos + ' anos' + (resto ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : '');
}

const rotuloMeses = m => m === 0 ? 'ao nascer' : m === 24 ? 'aos 2 anos' : m === 1 ? 'com 1 mês' : `aos ${m} meses`;

const ehPontual = e => e.categoria === 'consulta' || e.categoria === 'vacina';

const destinoGuia = e => e.capitulo && capitulos.find(c => c.id === e.capitulo)
  ? '#guia/' + e.capitulo + (e.seccao ? '/' + slug(e.seccao) : '')
  : '';

// Uma dica. Sozinha é um cartão; dentro de uma gaveta é uma linha da lista.
function cartaoDica(e, quando, emLista, comEtiqueta = true) {
  const cat = CATEGORIAS[e.categoria] || CATEGORIAS.saude;
  const destino = destinoGuia(e);
  return `<article class="${emLista ? '' : 'cartao '}dica ${quando ? 'pontual' : ''}" style="--cor:${cat.cor}">
    ${comEtiqueta ? `<span class="etiqueta">${icone(cat.icone)}${cat.rotulo}${quando ? ` · <span class="quando">${quando}</span>` : ''}</span>` : ''}
    <h3>${escaparHtml(e.titulo)}</h3>
    <p>${escaparHtml(e.texto)}</p>
    ${destino ? `<a class="ler-mais" href="${destino}">Ler no guia${icone('seta-dir')}</a>` : ''}</article>`;
}

// ------------------------------------------------------------------ régua ---
// A régua dos 0 aos 24 meses: o caminho todo que o guia cobre, com a semente
// na idade de hoje e as consultas e vacinas marcadas ao longo dele.

const DIA = 86400000;
const deISO = iso => new Date(iso + 'T00:00:00');
const meiaNoite = () => { const h = new Date(); h.setHours(0, 0, 0, 0); return h; };

function daquiA(data) {
  const dias = Math.round((data - meiaNoite()) / DIA);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias < 21) return `em ${dias} dias`;
  if (dias < 70) return `em ${Math.round(dias / 7)} semanas`;
  return `em ${Math.round(dias / 30.4)} meses`;
}

function htmlRegua(nasc, lista) {
  const n = deISO(nasc);
  const fim = new Date(n); fim.setMonth(fim.getMonth() + 24);
  const fracao = Math.min(1, Math.max(0, (Date.now() - n) / (fim - n)));
  const meses = idadeEmMeses(nasc);
  const pct = x => (x * 100).toFixed(2) + '%';

  const marcas = [];
  for (let m = 0; m <= 24; m++) {
    marcas.push(`<i class="t${m % 6 === 0 ? ' maior' : ''}" style="left:${pct(m / 24)}"></i>`);
  }
  // Um ponto por mês com consulta ou vacina (a consulta dá a cor quando há as duas).
  const porMes = new Map();
  for (const e of lista.filter(ehPontual)) {
    if (e.mesesMin < 0 || e.mesesMin > 24) continue;
    if (!porMes.has(e.mesesMin) || e.categoria === 'consulta') porMes.set(e.mesesMin, e.categoria);
  }
  const marcos = [...porMes].map(([m, cat]) =>
    `<i class="regua-marco${m < meses ? ' passado' : ''}" style="left:${pct(m / 24)};--cor:var(--c-${cat})"></i>`);

  const escala = [[0, '0'], [6, '6 m'], [12, '1 ano'], [18, '18 m'], [24, '2 anos']]
    .map(([m, r]) => `<span style="left:${pct(m / 24)}">${r}</span>`).join('');

  const descricao = meses < 0 ? 'Ainda por nascer' : `${textoIdade(nasc)}, num caminho de 24 meses`;
  return `<div class="regua">
    <div role="img" aria-label="${escaparHtml(descricao)}">
      <div class="regua-faixa">${marcas.join('')}${marcos.join('')}
        <i class="regua-cheio" style="width:${pct(fracao)}"></i>
        <i class="regua-semente" style="left:${pct(fracao)}"></i>
      </div>
      <div class="regua-escala" aria-hidden="true">${escala}</div>
    </div>
    ${linhaSeguinte(nasc, lista, meses)}
  </div>`;
}

// A linha por baixo da régua: o próximo compromisso do caminho.
function linhaSeguinte(nasc, lista, meses) {
  if (meses < 0) {
    return `<div class="regua-seguinte"><span class="titulo"><span class="rotulo">Data prevista:</span>
      ${deISO(nasc).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</span>
      <span class="quando">${daquiA(deISO(nasc))}</span></div>`;
  }
  const futuras = lista.filter(e => ehPontual(e) && e.mesesMin > meses)
    .sort((a, b) => a.mesesMin - b.mesesMin);
  if (!futuras.length) return '';
  const doMes = futuras.filter(e => e.mesesMin === futuras[0].mesesMin);
  const consulta = doMes.find(e => e.categoria === 'consulta');
  const principal = consulta || doMes[0];
  const titulo = principal.titulo + (consulta && doMes.length > 1 ? ' e vacinas' : '');
  const data = deISO(nasc); data.setMonth(data.getMonth() + principal.mesesMin);
  const destino = destinoGuia(principal);
  const dentro = `<span class="titulo"><span class="rotulo">A seguir:</span> ${escaparHtml(titulo)}</span>
    <span class="quando">${daquiA(data)}</span>`;
  return destino
    ? `<a class="regua-seguinte" href="${destino}">${dentro}</a>`
    : `<div class="regua-seguinte">${dentro}</div>`;
}

// ---------------------------------------------------------------- gavetas ---
// As dicas da idade vivem em gavetas: o Hoje mostra o que é do dia e deixa o
// resto a um toque. O que cada pessoa abre ou fecha fica lembrado no dispositivo
// (fora do backup — é uma preferência de ecrã). As gavetas vão todas na mesma
// folha (.gavetas), com um fio entre elas.

// As linhas de uma gaveta. O rótulo da categoria só aparece quando muda de uma
// linha para a seguinte, e nunca numa gaveta de uma só categoria: aí o título
// da gaveta já o disse.
function linhasDicas(grupo) {
  const mista = new Set(grupo.map(e => e.categoria)).size > 1;
  return grupo.map((e, i) =>
    cartaoDica(e, null, true, mista && e.categoria !== grupo[i - 1]?.categoria)).join('');
}

const CHAVE_GAVETAS = 'papaya.gavetas';
const ABERTAS_POR_OMISSAO = { 'nesta-idade': true, 'sinais': true };

function gavetasGuardadas() {
  try { return JSON.parse(localStorage.getItem(CHAVE_GAVETAS)) || {}; } catch { return {}; }
}

function gaveta(id, titulo, itens, html) {
  if (!itens.length) return '';
  const aberta = gavetasGuardadas()[id] ?? !!ABERTAS_POR_OMISSAO[id];
  const previa = itens.map(e => e.titulo).join(' · ');
  const sinal = id === 'sinais';
  return `<details class="gaveta${sinal ? ' alerta' : ''}" data-gaveta="${id}" ${aberta ? 'open' : ''}>
    <summary>${sinal ? icone('alerta') : ''}<span class="g-corpo"><span class="g-titulo">${titulo}</span>
      <span class="g-previa">${escaparHtml(previa)}</span></span>
      <span class="g-conta">${itens.length}</span>${icone('seta-baixo')}</summary>
    <div class="lista">${html}</div>
  </details>`;
}

function ligarGavetas(alvo) {
  alvo.querySelectorAll('.gaveta').forEach(g => g.addEventListener('toggle', () => {
    const guardadas = gavetasGuardadas(), id = g.dataset.gaveta;
    // O toggle também dispara ao desenhar uma gaveta já aberta: só se guarda
    // o que a pessoa mudou, para o estado por omissão poder evoluir.
    if (g.open === (guardadas[id] ?? !!ABERTAS_POR_OMISSAO[id])) return;
    guardadas[id] = g.open;
    try { localStorage.setItem(CHAVE_GAVETAS, JSON.stringify(guardadas)); } catch { /* fica só nesta sessão */ }
  }));
}

// ------------------------------------------------------------------- vista --

export async function renderHoje(alvo) {
  // O Hoje é a visão geral do dia: a régua da idade, o calendário, as tarefas
  // de hoje, a dica do dia e as dicas adequadas à idade. Cada bloco vai para o
  // seu contentor.
  alvo.innerHTML = `<div id="hojeRegua"></div>
    <div class="lista acoes-hoje">
      <button type="button" class="linha-acao" id="mamadaIniciar" hidden>
        ${icone('biberao')}<span class="corpo"><span class="titulo">Temporizador de mamada</span>
          <span class="sub">Avisa na hora da próxima</span></span>${icone('seta-dir')}
      </button>
      <div class="sono-linha" id="hojeSono"></div>
    </div>
    <div id="calRaiz"></div><div id="tarefasHoje"></div><div id="hojeCorpo"></div>`;
  ligarBotaoMamada(alvo.querySelector('#mamadaIniciar'));
  renderSonoHoje(alvo.querySelector('#hojeSono'));
  const zonaRegua = alvo.querySelector('#hojeRegua');
  await renderCalendario(alvo.querySelector('#calRaiz'));
  renderTarefasHoje(alvo.querySelector('#tarefasHoje'));
  const corpo = alvo.querySelector('#hojeCorpo');

  // A chama não depende do bebé: os cartões entram com ou sem data de
  // nascimento, por isso são calculados uma vez e colados em cada ramo.
  const chama = await cartoesChama();
  const pintar = html => {
    corpo.innerHTML = html;
    ligarCartoesChama(corpo, () => renderHoje(alvo));
    ligarGavetas(corpo);
  };

  const { dataNascimento, nomeCrianca } = estado.definicoes;
  if (!dataNascimento) {
    zonaRegua.innerHTML = `<div class="cartao vazio"><strong>Quando nasceu?</strong>
      Com a data de nascimento, o Hoje mostra o que esperar em cada idade e marca
      consultas e vacinas no calendário.
      <button type="button" class="botao-principal" id="hojePedirData">Indicar a data</button></div>`;
    zonaRegua.querySelector('#hojePedirData').onclick = () => document.querySelector('#botaoDefinicoes').click();
    pintar(chama);
    return;
  }
  const lista = await carregarEntradas();
  const meses = idadeEmMeses(dataNascimento);
  zonaRegua.innerHTML = htmlRegua(dataNascimento, lista);

  // Antes do nascimento: mostra o que há a preparar (entradas com meses negativos).
  if (meses < 0) {
    const preparar = lista.filter(e => e.mesesMin <= meses && meses <= e.mesesMax);
    pintar(
      `<div class="vazio">${escaparHtml(nomeCrianca || 'O bebé')} ainda vem a caminho.
        Aqui fica o que vale a pena adiantar.</div>` +
      (preparar.length ? `<h2 class="subtitulo">A preparar</h2><div class="lista">${linhasDicas(preparar)}</div>` : '') +
      chama);
    return;
  }
  if (meses > 25) {
    pintar(`<div class="vazio">Este guia cobre dos 0 aos 2 anos — que voam.
      O conteúdo do Guia e a Pesquisa continuam disponíveis.</div>` + chama);
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

  // A dica do dia não leva título: a etiqueta do cartão já diz o que é.
  let html = cartaoDicaDia(await dicaDoDia(meses));
  html += chama;
  if (agora.length) {
    html += '<h2 class="subtitulo">É este mês</h2>' +
      agora.map(e => cartaoDica(e, 'agora')).join('');
  }
  const seccoes = [
    ['nesta-idade', 'Nesta idade', [...porCategoria('desenvolvimento'), ...porCategoria('estimulacao')]],
    ['sinais', 'Sinais a vigiar', porCategoria('alerta')],
    ['saude', 'Saúde e rotinas', porCategoria('saude')],
    ['seguranca', 'Segurança', porCategoria('seguranca')],
    ['papelada', 'Papelada e apoios', [...porCategoria('burocracia'), ...porCategoria('preparacao')]]
  ];
  let gavetas = '';
  for (const [id, titulo, grupo] of seccoes) {
    gavetas += gaveta(id, titulo, grupo, linhasDicas(grupo));
  }
  gavetas += gaveta('a-seguir', 'A seguir', proximas,
    proximas.map(e => cartaoDica(e, rotuloMeses(e.mesesMin), true)).join(''));
  if (gavetas) html += `<div class="lista gavetas">${gavetas}</div>`;
  pintar(html || '<div class="vazio">Sem dicas para esta idade — acrescenta entradas em dados/faixas-etarias.json.</div>');
}
