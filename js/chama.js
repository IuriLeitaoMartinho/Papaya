// Calor da chama: os rituais do casal, as surpresas e o registo do que foi feito.
//
// O catálogo de sugestões vive em dados/chama.json (editável sem tocar no
// código); as surpresas do casal e os registos vivem em estado.chama.
//
// A surpresa do dia roda de forma determinística pela data: os dois telemóveis
// mostram a mesma sugestão no mesmo dia, para qualquer um dos dois poder pegar
// nela. A rotação corre sobre a lista ordenada por id — não pela ordem em que
// cada dispositivo importou as surpresas, que difere depois de uma fusão.
//
// Nada aqui é obrigatório: rituais desligados não aparecem em lado nenhum, e um
// ritual em atraso é sempre um convite, nunca uma falha.

import { estado, uid, dataLocalISO, guardarChama, guardarEventos } from './armazenamento.js';
import { capitulos, slug } from './conteudo.js';
import {
  $, escaparHtml, icone, abrirFolha, fecharFolha, acoesFolha,
  seletorDias, ligarSeletorDiaUnico
} from './ui.js';

const CAPITULO = '11-ser-pai';
const SECCAO = 'Manter a chama acesa';

// Quanto tempo depois da cadência é que um ritual passa a "em atraso".
// A folga é generosa de propósito: falhar uma semana não é falhar.
const CADENCIAS = {
  semanal: { dias: 7, folga: 3, rotulo: 'todas as semanas', adiar: 3 },
  quinzenal: { dias: 15, folga: 7, rotulo: 'duas vezes por mês', adiar: 7 },
  anual: { dias: 365, folga: 60, rotulo: 'uma vez por ano', adiar: 30 }
};

// Valores por omissão ao ligar um ritual, para bastar um toque.
const OMISSAO = {
  conversa: { diaSemana: 3, semanas: null, mes: null },
  encontro: { diaSemana: 6, semanas: [1, 3], mes: null },
  viagem: { diaSemana: null, semanas: null, mes: 5 }
};

let dados = null;

export async function carregarCatalogo() {
  if (!dados) dados = await (await fetch('dados/chama.json')).json();
  return dados;
}

// ------------------------------------------------------------------ datas ---

const deISO = s => new Date(s + 'T00:00:00');
const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);
const somarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Número do dia local (igual em todo o lado durante o mesmo dia).
const diaLocal = () => {
  const h = new Date();
  return Math.floor((h.getTime() - h.getTimezoneOffset() * 60000) / 86400000);
};

const semanaDoMes = d => Math.floor((d.getDate() - 1) / 7) + 1;

function haQuanto(iso) {
  const d = diasEntre(iso, dataLocalISO());
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 14) return `há ${d} dias`;
  if (d < 60) return `há ${Math.round(d / 7)} semanas`;
  if (d < 365) return `há ${Math.round(d / 30)} meses`;
  return `há mais de um ano`;
}

function daquiA(iso) {
  const d = diasEntre(dataLocalISO(), iso);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d < 7) return deISO(iso).toLocaleDateString('pt-PT', { weekday: 'long' });
  if (d < 60) return deISO(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
  return deISO(iso).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}

const dataCurta = iso => deISO(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });

// --------------------------------------------------------------- rituais ----

// Configuração guardada de um ritual, ou o esqueleto desligado se ainda não existir.
export function configRitual(id) {
  return estado.chama.rituais.find(r => r.id === id) ||
    { id, ativo: false, diaSemana: null, semanas: null, mes: null, hora: null,
      pausadoAte: null, adiadoAte: null };
}

const pausado = r => !!r.pausadoAte && r.pausadoAte > dataLocalISO();
// O "Adiar" do ecrã Hoje: cala só o cartão, durante uns dias. O painel
// continua a mostrar o estado real do ritual.
const adiado = r => !!r.adiadoAte && r.adiadoAte > dataLocalISO();

// Ocorrências de um ritual dentro de uma janela [de, ate], em ISO.
// Exportada porque o calendário gera os marcos a partir da mesma regra.
export function ocorrenciasRitual(r, tipo, de, ate) {
  const out = [];
  if (!r.ativo || de > ate) return out;

  if (tipo === 'anual') {
    if (!r.mes) return out;
    const fim = deISO(ate);
    for (let ano = deISO(de).getFullYear(); ano <= fim.getFullYear(); ano++) {
      const iso = dataLocalISO(new Date(ano, r.mes - 1, 1));
      if (iso >= de && iso <= ate) out.push(iso);
    }
    return out;
  }

  if (r.diaSemana == null) return out;
  // 1.ª e 3.ª semana do mês: âncora estável, ao contrário de "de 14 em 14 dias",
  // que deriva e acaba a cair a meio de tudo.
  const semanas = tipo === 'quinzenal' ? (r.semanas?.length ? r.semanas : [1, 3]) : null;
  let cur = deISO(de);
  while (cur.getDay() !== r.diaSemana) cur = somarDias(cur, 1);
  while (dataLocalISO(cur) <= ate) {
    if (!semanas || semanas.includes(semanaDoMes(cur))) out.push(dataLocalISO(cur));
    cur = somarDias(cur, 7);
  }
  return out;
}

const registosDe = id => estado.chama.registos
  .filter(g => g.ritualId === id)
  .map(g => g.data)
  .sort();

// Estado apresentável de um ritual: última vez, próxima ocorrência e atraso.
export function estadoRitual(ritual) {
  const r = configRitual(ritual.id);
  const cad = CADENCIAS[ritual.cadencia] || CADENCIAS.semanal;
  const feitos = registosDe(ritual.id);
  const ultima = feitos.length ? feitos[feitos.length - 1] : null;
  const hoje = dataLocalISO();
  const proxima = r.ativo
    ? ocorrenciasRitual(r, ritual.cadencia, hoje, dataLocalISO(somarDias(new Date(), 400)))[0] || null
    : null;
  const diasDesde = ultima ? diasEntre(ultima, hoje) : null;
  // Sem registo nenhum não há atraso: ainda não houve um ciclo para falhar.
  const emAtraso = r.ativo && !pausado(r) && diasDesde != null && diasDesde > cad.dias + cad.folga;
  return { r, cad, ultima, proxima, diasDesde, emAtraso, pausado: pausado(r) };
}

function registarRitual(id) {
  estado.chama.registos.push({ id: uid(), ritualId: id, surpresaId: null, data: dataLocalISO() });
  guardarChama();
}

function guardarRitual(cfg) {
  const i = estado.chama.rituais.findIndex(x => x.id === cfg.id);
  if (i >= 0) estado.chama.rituais[i] = cfg; else estado.chama.rituais.push(cfg);
  guardarChama();
}

// -------------------------------------------------------------- surpresas ---

const idCatalogo = s => 'cat:' + slug(s.titulo);

// Todas as surpresas disponíveis: as do catálogo mais as do casal.
// União por id (a entrada do casal ganha, porque leva as vezes e a favorita),
// ordenada por id para a rotação diária ser igual nos dois telemóveis.
function poolSurpresas(cat) {
  const mapa = new Map();
  for (const s of cat.surpresas) mapa.set(idCatalogo(s), { ...s, id: idCatalogo(s), minha: false, vezes: 0 });
  for (const s of estado.chama.surpresas) mapa.set(s.id, { ...mapa.get(s.id), ...s });
  return [...mapa.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

// Deslocamento do botão "Outra": vive só nesta sessão, não é guardado.
let saltoSurpresa = 0;

function surpresaDoDia(cat) {
  const pool = poolSurpresas(cat);
  return pool.length ? pool[(diaLocal() + saltoSurpresa) % pool.length] : null;
}

// Garante que a surpresa existe na lista do casal e devolve-a.
function fixarSurpresa(s) {
  let nossa = estado.chama.surpresas.find(x => x.id === s.id);
  if (!nossa) {
    nossa = {
      id: s.id, titulo: s.titulo, texto: s.texto || '',
      minha: !!s.minha, favorita: false, vezes: 0, ultimaVez: null
    };
    estado.chama.surpresas.push(nossa);
  }
  return nossa;
}

function registarSurpresa(s) {
  const nossa = fixarSurpresa(s);
  nossa.vezes = (nossa.vezes || 0) + 1;
  nossa.ultimaVez = dataLocalISO();
  estado.chama.registos.push({ id: uid(), ritualId: null, surpresaId: s.id, data: dataLocalISO() });
  guardarChama();
}

// ---------------------------------------------------------------- registos --

// Registos dos últimos `meses`, do mais recente para o mais antigo, sem
// duplicados: se os dois marcarem o mesmo jantar em telemóveis diferentes
// ficam dois registos com ids diferentes — mostra-se um só (sem apagar nada).
function historico(cat, meses = 3) {
  const limite = dataLocalISO(somarDias(new Date(), -meses * 31));
  const vistos = new Set();
  const nomes = new Map(cat.rituais.map(x => [x.id, x.titulo]));
  for (const s of poolSurpresas(cat)) nomes.set(s.id, s.titulo);
  return estado.chama.registos
    .filter(g => g.data >= limite)
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .filter(g => {
      const chave = (g.ritualId || g.surpresaId) + '|' + g.data;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .map(g => ({
      data: g.data,
      ritual: !!g.ritualId,
      titulo: nomes.get(g.ritualId || g.surpresaId) || 'Surpresa',
      nota: g.nota || ''
    }));
}

// ------------------------------------------------------------------ vista ---

const linkGuia = () => capitulos.find(c => c.id === CAPITULO)
  ? '#guia/' + CAPITULO + '/' + slug(SECCAO)
  : '';

export async function renderChama(alvo) {
  const cat = await carregarCatalogo();

  // A surpresa do dia vem primeiro: é o que há para fazer hoje, e custa dez
  // minutos. Os rituais ligados ficam em cartão; os desligados recolhem a uma
  // linha discreta — ninguém abre este ecrã para ver três vezes "desligado".
  let html = '';
  const s = surpresaDoDia(cat);
  if (s) html += '<h2 class="subtitulo">Surpresa de hoje</h2>' + cartaoSurpresaDoDia(s);

  const ligados = cat.rituais.filter(r => configRitual(r.id).ativo);
  const desligados = cat.rituais.filter(r => !configRitual(r.id).ativo);
  html += '<h2 class="subtitulo">Os nossos rituais</h2>' + ligados.map(cartaoRitual).join('');
  if (desligados.length) {
    html += '<div class="lista">' + desligados.map(linhaRitualDesligado).join('') + '</div>';
  }

  html += '<h2 class="subtitulo">As nossas surpresas</h2>' + listaNossas(cat);
  html += `<button type="button" class="botao-secundario" id="chNova">${icone('mais')}Acrescentar surpresa</button>`;

  html += ideias(cat);
  html += secaoHistorico(cat);

  const link = linkGuia();
  if (link) html += `<a class="botao-secundario botao-link" href="${link}">Ler no guia: manter a chama acesa${icone('seta-dir')}</a>`;

  alvo.innerHTML = html;
  ligar(alvo, cat);
}

function linhaRitualDesligado(ritual) {
  const cad = CADENCIAS[ritual.cadencia] || CADENCIAS.semanal;
  return `<div class="chama-item chama-ritual" data-ritual="${ritual.id}">
    <div class="corpo">
      <div class="titulo">${escaparHtml(ritual.titulo)}</div>
      <div class="meta">${escaparHtml(cad.rotulo)}</div>
    </div>
    <button type="button" class="chama-ligar" data-acao="config"
            aria-label="Ligar o ritual ${escaparHtml(ritual.titulo)}">Ligar</button>
  </div>`;
}

function cartaoRitual(ritual) {
  const e = estadoRitual(ritual);
  const cad = CADENCIAS[ritual.cadencia] || CADENCIAS.semanal;

  let etiqueta = cad.rotulo, classe = '';
  if (e.pausado) { etiqueta = 'em pausa até ' + dataCurta(e.r.pausadoAte); classe = ' pausado'; }
  else if (e.emAtraso) { etiqueta = 'está na hora'; classe = ' atrasado'; }
  etiqueta = etiqueta[0].toUpperCase() + etiqueta.slice(1);

  const linhas = [];
  if (e.ultima) linhas.push('Última vez ' + haQuanto(e.ultima));
  else if (e.r.ativo) linhas.push('Ainda sem registo');
  if (e.r.ativo && !e.pausado && e.proxima) {
    linhas.push('Próxima ' + daquiA(e.proxima) + (e.r.hora ? ' às ' + e.r.hora : ''));
  }

  return `<div class="cartao dica chama-ritual${classe}" style="--cor:var(--c-chama)" data-ritual="${ritual.id}">
    <span class="etiqueta">${icone('chama')}${escaparHtml(etiqueta)}</span>
    <h3>${escaparHtml(ritual.titulo)}</h3>
    <p>${escaparHtml(ritual.texto)}</p>
    ${linhas.length ? `<p class="chama-estado">${escaparHtml(linhas.join(' · '))}</p>` : ''}
    <div class="linha-botoes">
      <button type="button" class="principal" data-acao="feito">Já fizemos</button>
      <button type="button" data-acao="config">Configurar</button>
    </div>
  </div>`;
}

// A etiqueta de momento do catálogo (dados/chama.json), dita por extenso.
const MOMENTOS = {
  'manhã': 'De manhã', 'dia': 'Durante o dia', 'tarde': 'À tarde',
  'noite': 'À noite', 'fim de semana': 'Ao fim de semana'
};

function cartaoSurpresaDoDia(s) {
  return `<div class="cartao dica chama-surpresa" style="--cor:var(--c-chama)" data-surpresa="${escaparHtml(s.id)}">
    <span class="etiqueta">${icone('chama')}${escaparHtml(MOMENTOS[s.etiqueta] || s.etiqueta || 'Um gesto pequeno')}</span>
    <h3>${escaparHtml(s.titulo)}</h3>
    ${s.texto ? `<p>${escaparHtml(s.texto)}</p>` : ''}
    ${s.vezes ? `<p class="chama-estado">Já fizeram ${s.vezes}x${s.ultimaVez ? ' · última ' + haQuanto(s.ultimaVez) : ''}</p>` : ''}
    <div class="linha-botoes">
      <button type="button" class="principal" data-acao="fiz">Já fiz</button>
      <button type="button" data-acao="outra">Outra</button>
    </div>
  </div>`;
}

function listaNossas(cat) {
  const nossas = [...estado.chama.surpresas].sort((a, b) =>
    (b.favorita ? 1 : 0) - (a.favorita ? 1 : 0) || (b.vezes || 0) - (a.vezes || 0) ||
    (a.titulo > b.titulo ? 1 : -1));
  if (!nossas.length) {
    return '<div class="vazio"><strong>A vossa lista começa aqui</strong>Guarda as ideias que resultaram, ou escreve as vossas.</div>';
  }
  return '<div class="lista">' + nossas.map(s => `<div class="chama-item" data-nossa="${escaparHtml(s.id)}">
    <button type="button" class="chama-fav ${s.favorita ? 'sel' : ''}" data-acao="fav"
            aria-label="Favorita" aria-pressed="${!!s.favorita}">${icone('estrela')}</button>
    <div class="corpo">
      <div class="titulo">${escaparHtml(s.titulo)}</div>
      <div class="meta">${s.vezes ? s.vezes + 'x' : 'ainda por fazer'}${s.ultimaVez ? ' · ' + haQuanto(s.ultimaVez) : ''}</div>
    </div>
    <button type="button" class="chama-editar" data-acao="editar" aria-label="Editar surpresa">${icone('pontos')}</button>
  </div>`).join('') + '</div>';
}

function ideias(cat) {
  const nossos = new Set(estado.chama.surpresas.map(s => s.id));
  const porGuardar = cat.surpresas.filter(s => !nossos.has(idCatalogo(s)));
  if (!porGuardar.length) return '';
  return `<details class="gaveta chama-ideias">
    <summary><span class="g-corpo"><span class="g-titulo">Ideias para guardar</span>
      <span class="g-previa">${escaparHtml(porGuardar.map(s => s.titulo).join(' · '))}</span></span>
      <span class="g-conta">${porGuardar.length}</span>${icone('seta-baixo')}</summary>
    <div class="lista">` + porGuardar.map(s => `<div class="chama-item" data-ideia="${escaparHtml(idCatalogo(s))}">
      <div class="corpo">
        <div class="titulo">${escaparHtml(s.titulo)}</div>
        <div class="meta">${escaparHtml(s.texto || '')}</div>
      </div>
      <button type="button" class="chama-guardar" data-acao="guardar" aria-label="Guardar nas nossas">${icone('mais')}</button>
    </div>`).join('') + '</div></details>';
}

function secaoHistorico(cat) {
  const h = historico(cat);
  if (!h.length) return '';
  return '<h2 class="subtitulo">Últimos 3 meses</h2><div class="lista chama-hist">' +
    h.map(g => `<div class="chama-hl">
      <span class="quando">${escaparHtml(dataCurta(g.data))}</span>
      <span class="ponto ${g.ritual ? 'ritual' : ''}"></span>
      <span class="titulo">${escaparHtml(g.titulo)}</span>
    </div>`).join('') + '</div>';
}

// --------------------------------------------------------------- ligações ---

function ligar(alvo, cat) {
  const recarregar = () => renderChama(alvo);

  alvo.querySelectorAll('.chama-ritual').forEach(el => {
    const ritual = cat.rituais.find(x => x.id === el.dataset.ritual);
    el.querySelectorAll('button[data-acao]').forEach(b => b.onclick = () => {
      if (b.dataset.acao === 'feito') { registarRitual(ritual.id); recarregar(); }
      else folhaRitual(ritual, recarregar);
    });
  });

  const cartaoS = alvo.querySelector('.chama-surpresa');
  if (cartaoS) {
    const s = surpresaDoDia(cat);
    cartaoS.querySelectorAll('button[data-acao]').forEach(b => b.onclick = () => {
      if (b.dataset.acao === 'outra') saltoSurpresa++;
      else registarSurpresa(s);
      recarregar();
    });
  }

  alvo.querySelectorAll('[data-nossa]').forEach(el => {
    const s = estado.chama.surpresas.find(x => x.id === el.dataset.nossa);
    el.querySelector('[data-acao="fav"]').onclick = () => {
      s.favorita = !s.favorita; guardarChama(); recarregar();
    };
    el.querySelector('[data-acao="editar"]').onclick = () => folhaSurpresa(s, recarregar);
  });

  alvo.querySelectorAll('[data-ideia]').forEach(el => {
    el.querySelector('[data-acao="guardar"]').onclick = () => {
      const s = cat.surpresas.find(x => idCatalogo(x) === el.dataset.ideia);
      fixarSurpresa({ ...s, id: idCatalogo(s), minha: false });
      guardarChama();
      recarregar();
    };
  });

  const nova = alvo.querySelector('#chNova');
  if (nova) nova.onclick = () => folhaSurpresa(null, recarregar);
}

// ------------------------------------------------- marcos do calendário ---

// Janela deslizante dos marcos virtuais: um ritual semanal é infinito, por isso
// gera-se só o que a vista consegue mostrar. 60 dias para trás cobrem a vista de
// mês anterior; 400 para a frente garantem uma ocorrência anual.
export const JANELA_ATRAS = 60;
export const JANELA_FRENTE = 400;

const inicioSemana = iso => {
  const d = deISO(iso);
  return dataLocalISO(somarDias(d, -((d.getDay() + 6) % 7)));  // segunda = início
};

// "Mesma ocorrência": um evento real na mesma semana (semanal e quinzenal) ou no
// mesmo mês (anual) já representa aquele ciclo. Sem isto o dia aparecia duas
// vezes — uma como marco virtual, outra como evento — e mudar o jantar de
// sábado para sexta deixava o marco de sábado a sobrar.
function jaTemEvento(ritualId, tipo, data) {
  return estado.eventos.some(ev =>
    ev.origem === 'chama' && ev.ritualId === ritualId &&
    (tipo === 'anual'
      ? ev.data.slice(0, 7) === data.slice(0, 7)
      : inicioSemana(ev.data) === inicioSemana(data)));
}

// Marcos virtuais dos rituais para o calendário, na janela [de, ate].
//
// Síncrona de propósito — o calcularMarcos() do calendario.js chama-a a meio do
// ciclo. Isso obriga a que alguém já tenha feito carregarCatalogo(); sem
// catálogo devolve [] em vez de rebentar (a app tem de continuar a desenhar o
// calendário mesmo que o dados/chama.json falhe).
export function marcosChama(de, ate) {
  if (!dados) return [];
  const out = [];
  for (const ritual of dados.rituais) {
    const r = configRitual(ritual.id);
    if (!r.ativo || pausado(r)) continue;       // desligado ou em pausa não suja o calendário
    const cad = CADENCIAS[ritual.cadencia] || CADENCIAS.semanal;
    const sub = ritual.cadencia === 'anual'
      ? 'Ritual do casal — uma vez por ano. Este é o lembrete para começar a planear.'
      : 'Ritual do casal — ' + cad.rotulo + (r.hora ? ' · ' + r.hora : '');
    for (const data of ocorrenciasRitual(r, ritual.cadencia, de, ate)) {
      if (jaTemEvento(ritual.id, ritual.cadencia, data)) continue;
      out.push({ data, titulo: ritual.titulo, sub, categoria: 'chama',
        capitulo: CAPITULO, seccao: SECCAO });
    }
  }
  return out;
}

// ------------------------------------------------- cartões do ecrã Hoje ---

// Dias de vida do bebé em que a app deixa os rituais em paz. Nas primeiras
// semanas um jantar fora não está atrasado, está impossível — e a app não
// serve para o lembrar. A surpresa do dia, essa, continua a aparecer.
const TREGUA_RECEM_NASCIDO = 40;

function recemNascido() {
  const n = estado.definicoes.dataNascimento;
  if (!n) return false;
  const d = diasEntre(n, dataLocalISO());
  return d >= 0 && d < TREGUA_RECEM_NASCIDO;
}

// A funcionalidade é opcional: quem nunca lhe tocou não vê nada no Hoje.
// Basta um ritual ligado, uma surpresa guardada ou um registo para entrar.
const usaChama = () => estado.chama.rituais.some(r => r.ativo) ||
  estado.chama.surpresas.length > 0 || estado.chama.registos.length > 0;

// Já marcado hoje? Compara-se por ritual/surpresa + dia, e não por id do
// registo: dois telemóveis que marquem o mesmo jantar geram ids diferentes.
const feitoHoje = (campo, id) => estado.chama.registos
  .some(g => g[campo] === id && g.data === dataLocalISO());

// Já está marcado no calendário para um dia futuro? Então o "Agendar" também
// vale como resposta: não faz sentido repetir o convite todos os dias até lá.
// (Marcado para hoje continua a mostrar-se — é o lembrete da noite.)
const agendadoParaDepois = id => estado.eventos
  .some(ev => ev.origem === 'chama' && ev.ritualId === id && ev.data > dataLocalISO());

// Cartões da chama para o ecrã Hoje, por prioridade: primeiro os rituais que
// estão na hora, depois a surpresa do dia. Devolve '' quando não há nada a
// dizer — o Hoje já é comprido que baste.
export async function cartoesChama() {
  const cat = await carregarCatalogo();
  if (!usaChama()) return '';
  const hoje = dataLocalISO();

  let html = '';
  if (!recemNascido()) {
    for (const ritual of cat.rituais) {
      const e = estadoRitual(ritual);
      if (!e.r.ativo || e.pausado || adiado(e.r)) continue;
      if (feitoHoje('ritualId', ritual.id) || agendadoParaDepois(ritual.id)) continue;
      const eHoje = e.proxima === hoje;
      if (!e.emAtraso && !eHoje) continue;
      html += cartaoRitualHoje(ritual, e, eHoje);
    }
  }

  const s = surpresaDoDia(cat);
  if (s && !feitoHoje('surpresaId', s.id)) html += cartaoSurpresaHoje(s);

  return html ? '<h2 class="subtitulo">Calor da chama</h2>' + html : '';
}

// Um ritual em atraso é um convite, nunca uma falha: sem contagem de falhas,
// sem vermelho, e com o "Adiar" à distância de um toque.
function cartaoRitualHoje(ritual, e, eHoje) {
  const linha = e.ultima ? 'Última vez ' + haQuanto(e.ultima) : 'Ainda sem registo';
  return `<div class="cartao dica chama-ritual chama-hoje" style="--cor:var(--c-chama)"
       data-hoje-ritual="${escaparHtml(ritual.id)}">
    <span class="etiqueta">${icone('chama')}${eHoje ? 'É hoje' : 'Está na hora'}</span>
    <h3>${escaparHtml(ritual.titulo)}</h3>
    <p>${escaparHtml(ritual.texto)}</p>
    <p class="chama-estado">${escaparHtml(linha)}</p>
    <div class="linha-botoes">
      <button type="button" class="principal" data-acao="feito">Já fizemos</button>
      <button type="button" data-acao="agendar">Agendar</button>
      <button type="button" data-acao="adiar">Adiar</button>
    </div>
  </div>`;
}

function cartaoSurpresaHoje(s) {
  return `<div class="cartao dica chama-surpresa chama-hoje" style="--cor:var(--c-chama)"
       data-hoje-surpresa="${escaparHtml(s.id)}">
    <span class="etiqueta">${icone('chama')}Surpresa de hoje${s.etiqueta ? ' · ' + escaparHtml((MOMENTOS[s.etiqueta] || s.etiqueta).toLowerCase()) : ''}</span>
    <h3>${escaparHtml(s.titulo)}</h3>
    ${s.texto ? `<p>${escaparHtml(s.texto)}</p>` : ''}
    <div class="linha-botoes">
      <button type="button" class="principal" data-acao="fiz">Já fiz</button>
      <button type="button" data-acao="outra">Outra</button>
    </div>
  </div>`;
}

// Liga os botões dos cartões depois de o Hoje escrever o innerHTML.
// `recarregar` volta a desenhar o ecrã todo (o calendário incluído, para o
// evento agendado aparecer logo).
export async function ligarCartoesChama(alvo, recarregar) {
  if (!alvo.querySelector('[data-hoje-ritual],[data-hoje-surpresa]')) return;
  const cat = await carregarCatalogo();

  alvo.querySelectorAll('[data-hoje-ritual]').forEach(el => {
    const ritual = cat.rituais.find(x => x.id === el.dataset.hojeRitual);
    if (!ritual) return;
    el.querySelectorAll('button[data-acao]').forEach(b => b.onclick = () => {
      const acao = b.dataset.acao;
      if (acao === 'feito') { registarRitual(ritual.id); recarregar(); }
      else if (acao === 'adiar') { adiarRitual(ritual); recarregar(); }
      else folhaMarcar(ritual, recarregar);
    });
  });

  const cartao = alvo.querySelector('[data-hoje-surpresa]');
  if (cartao) {
    const s = surpresaDoDia(cat);
    cartao.querySelectorAll('button[data-acao]').forEach(b => b.onclick = () => {
      if (b.dataset.acao === 'outra') saltoSurpresa++;
      else if (s) registarSurpresa(s);
      recarregar();
    });
  }
}

function adiarRitual(ritual) {
  const cad = CADENCIAS[ritual.cadencia] || CADENCIAS.semanal;
  const r = { ...configRitual(ritual.id) };
  r.adiadoAte = dataLocalISO(somarDias(new Date(), cad.adiar));
  guardarRitual(r);
}

// ----------------------------------------------------------------- folhas ---

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Promove uma ocorrência do ritual a evento real do calendário: passa a ter
// hora e notas, e viaja no backup para o telemóvel do outro. O origem/ritualId
// é o que a Fase 4 usa para não desenhar o marco virtual por cima do evento.
function folhaMarcar(ritual, aoFechar) {
  const e = estadoRitual(ritual);
  const hoje = dataLocalISO();
  const data = e.proxima && e.proxima >= hoje ? e.proxima : hoje;

  abrirFolha(`<h2>Marcar no calendário</h2>
    <p class="folha-nota">${escaparHtml(ritual.titulo)}</p>
    <label for="chEvData">Dia</label>
    <input type="date" id="chEvData" value="${data}">
    <label for="chEvHora">Hora (opcional)</label>
    <input type="time" id="chEvHora" value="${e.r.hora || ''}">
    <label for="chEvNotas">Notas (opcional)</label>
    <input type="text" id="chEvNotas" placeholder="No sítio do costume" autocomplete="off">
    ${acoesFolha('Marcar')}`);

  $('#folhaGuardar').onclick = () => {
    const dia = $('#chEvData').value;
    if (!dia) { alert('Escolhe o dia.'); return; }
    estado.eventos.push({
      id: uid(),
      data: dia,
      hora: $('#chEvHora').value || undefined,
      titulo: ritual.titulo,
      notas: $('#chEvNotas').value.trim() || undefined,
      origem: 'chama',
      ritualId: ritual.id
    });
    guardarEventos();
    fecharFolha();
    aoFechar();
  };
  $('#folhaCancelar').onclick = fecharFolha;
}

function folhaRitual(ritual, aoFechar) {
  const r = { ...configRitual(ritual.id) };
  const tipo = ritual.cadencia;
  const cad = CADENCIAS[tipo] || CADENCIAS.semanal;
  const om = OMISSAO[ritual.id] || {};
  const dia = r.diaSemana ?? om.diaSemana;

  abrirFolha(`<h2>${escaparHtml(ritual.titulo)}</h2>
    <p class="folha-nota">${escaparHtml(ritual.texto)}</p>
    <label>Cadência</label>
    <div class="folha-fixo">${escaparHtml(cad.rotulo)}</div>
    ${tipo === 'anual' ? `
      <label>Mês</label>
      <select id="chMes">${MESES.map((m, i) =>
        `<option value="${i + 1}" ${(r.mes ?? om.mes) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>`
    : `
      <label>Dia da semana</label>
      ${seletorDias('chDia', dia == null ? [] : [dia])}`}
    ${tipo === 'quinzenal' ? `
      <label>Semanas do mês</label>
      <div class="dias-semana" id="chSemanas">${[1, 2, 3, 4].map(n =>
        `<button type="button" data-v="${n}" class="${(r.semanas || om.semanas || [1, 3]).includes(n) ? 'sel' : ''}">${n}.ª</button>`).join('')}</div>`
    : ''}
    <label>Hora (opcional)</label>
    <input type="time" id="chHora" value="${r.hora || ''}">
    ${acoesFolha(r.ativo ? 'Guardar' : 'Ligar ritual')}
    ${r.ativo ? `<div class="linha-botoes">
      <button type="button" id="chPausa">${pausado(r) ? 'Retomar' : 'Pausar um mês'}</button>
      <button type="button" id="chDesligar">Desligar ritual</button>
    </div>` : ''}`);

  if (tipo !== 'anual') ligarSeletorDiaUnico('chDia');
  document.querySelectorAll('#chSemanas button').forEach(b =>
    b.onclick = () => b.classList.toggle('sel'));

  const recolher = () => {
    if (tipo === 'anual') {
      r.mes = +$('#chMes').value;
      r.diaSemana = null; r.semanas = null;
    } else {
      const sel = document.querySelector('#chDia button.sel');
      r.diaSemana = sel ? +sel.dataset.v : null;
      r.mes = null;
      r.semanas = tipo === 'quinzenal'
        ? [...document.querySelectorAll('#chSemanas button.sel')].map(b => +b.dataset.v)
        : null;
    }
    r.hora = $('#chHora').value || null;
  };

  $('#folhaGuardar').onclick = () => {
    recolher();
    if (tipo !== 'anual' && r.diaSemana == null) { alert('Escolhe um dia da semana.'); return; }
    if (tipo === 'quinzenal' && !r.semanas.length) { alert('Escolhe pelo menos uma semana do mês.'); return; }
    r.ativo = true;
    guardarRitual(r);
    fecharFolha();
    aoFechar();
  };
  $('#folhaCancelar').onclick = fecharFolha;

  const pausa = $('#chPausa');
  if (pausa) pausa.onclick = () => {
    recolher();
    r.pausadoAte = pausado(r) ? null : dataLocalISO(somarDias(new Date(), 30));
    guardarRitual(r);
    fecharFolha();
    aoFechar();
  };
  const desligar = $('#chDesligar');
  if (desligar) desligar.onclick = () => {
    recolher();
    r.ativo = false;
    r.pausadoAte = null;
    r.adiadoAte = null;
    guardarRitual(r);
    fecharFolha();
    aoFechar();
  };
}

function folhaSurpresa(s, aoFechar) {
  abrirFolha(`<h2>${s ? 'Editar surpresa' : 'Nova surpresa'}</h2>
    <label for="chTitulo">Surpresa</label>
    <input type="text" id="chTitulo" value="${s ? escaparHtml(s.titulo) : ''}"
           placeholder="Trazer o pequeno-almoço à cama" autocomplete="off">
    <label for="chTexto">Notas (opcional)</label>
    <input type="text" id="chTexto" value="${s ? escaparHtml(s.texto || '') : ''}"
           placeholder="Com o pão da padaria da esquina" autocomplete="off">
    ${acoesFolha(s ? 'Guardar' : 'Acrescentar')}
    ${s ? '<button type="button" class="botao-apagar" id="chApagar">Apagar surpresa</button>' : ''}`);

  $('#folhaGuardar').onclick = () => {
    const titulo = $('#chTitulo').value.trim();
    if (!titulo) { alert('Dá um nome à surpresa.'); return; }
    if (s) {
      s.titulo = titulo;
      s.texto = $('#chTexto').value.trim();
    } else {
      estado.chama.surpresas.push({
        id: uid(), titulo, texto: $('#chTexto').value.trim(),
        minha: true, favorita: false, vezes: 0, ultimaVez: null
      });
    }
    guardarChama();
    fecharFolha();
    aoFechar();
  };
  $('#folhaCancelar').onclick = fecharFolha;

  const apagar = $('#chApagar');
  if (apagar) apagar.onclick = () => {
    if (!confirm('Tirar esta surpresa da vossa lista? O histórico fica.')) return;
    estado.chama.surpresas = estado.chama.surpresas.filter(x => x.id !== s.id);
    guardarChama();
    fecharFolha();
    aoFechar();
  };
}
