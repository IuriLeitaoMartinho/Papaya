// Calendário do ecrã Hoje: barra horizontal com a semana no topo que,
// ao tocar no cabeçalho, expande para a vista do mês (com navegação).
//
// Nos dias aparecem pontos coloridos: consultas e vacinas do PNV (calculadas
// automaticamente a partir da data de nascimento e de dados/faixas-etarias.json)
// e eventos/lembretes criados pelo utilizador (guardados em estado.eventos).

import { estado, uid, dataLocalISO, guardarEventos } from './armazenamento.js';
import { capitulos, slug } from './conteudo.js';
import { $, escaparHtml, abrirFolha, fecharFolha, acoesFolha } from './ui.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']; // semana a começar à segunda

// Estado da vista (vive entre re-renders do Hoje, reinicia ao recarregar a app).
let diaSel = dataLocalISO();
let expandido = false;
let mesVis = null; // {ano, mes} da vista de mês
let raiz = null;   // o contentor onde o calendário se desenha

let faixas = null;    // cache de dados/faixas-etarias.json
let marcos = null;    // { 'AAAA-MM-DD': [{titulo, categoria, capitulo, seccao, sub?}] }
let marcosChave = ''; // nascimento + modalidade de licença com que foram calculados

const deISO = iso => new Date(iso + 'T00:00:00');
const paraISO = d => dataLocalISO(d);

function somarMeses(iso, n) {
  const d = deISO(iso);
  return paraISO(new Date(d.getFullYear(), d.getMonth() + n, d.getDate()));
}

function somarDias(iso, n) {
  const d = deISO(iso);
  return paraISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

// Consultas/vacinas do PNV e datas da licença parental projetadas em datas concretas.
async function calcularMarcos() {
  const nasc = estado.definicoes.dataNascimento;
  const chave = nasc + '|' + (estado.definicoes.licenca || '');
  if (marcos && marcosChave === chave) return marcos;
  marcos = {};
  marcosChave = chave;
  if (!nasc) return marcos;
  if (!faixas) faixas = (await (await fetch('dados/faixas-etarias.json')).json()).entradas;
  for (const e of faixas) {
    if (e.categoria !== 'consulta' && e.categoria !== 'vacina') continue;
    const data = somarMeses(nasc, e.mesesMin);
    (marcos[data] = marcos[data] || []).push(e);
  }
  for (const m of marcosLicenca(nasc, estado.definicoes.licenca)) {
    (marcos[m.data] = marcos[m.data] || []).push(m);
  }
  return marcos;
}

// Datas-chave da licença parental (regras no capítulo Licença parental).
// Estimativas em dias de calendário a partir do nascimento — a confirmar
// com a Segurança Social e a entidade empregadora.
function marcosLicenca(nasc, modalidade) {
  if (!modalidade) return [];
  const partilhada = modalidade.includes('+');
  const diasMae = modalidade.startsWith('150') ? 150 : 120;
  const total = partilhada ? diasMae + 30 : diasMae;
  const ev = (dias, titulo, sub) => ({
    data: somarDias(nasc, dias), titulo, sub,
    categoria: 'licenca', capitulo: '13-licenca-parental'
  });
  const lista = [
    ev(0, 'Início das licenças parentais',
      'Pai: começam os 7 dias seguidos obrigatórios. Mãe: dia 1 da licença inicial.'),
    ev(7, 'Prazo: comunicar as licenças ao empregador',
      'Por escrito, até 7 dias após o parto' + (partilhada ? ', com a declaração conjunta de partilha' : '') + '.'),
    ev(42, 'Dia 42: fim do período obrigatório da mãe',
      'Também é o limite para o pai gozar os 28 dias obrigatórios e os 7 facultativos.')
  ];
  if (partilhada) {
    lista.push(
      ev(diasMae - 1, `Dia ${diasMae}: último dia de licença da mãe`,
        'No dia seguinte começa o bloco de 30 dias do pai.'),
      ev(diasMae, 'Início do bloco de 30 dias do pai',
        'A mãe regressa ao trabalho (no dia útil seguinte).'),
      ev(total - 1, `Dia ${total}: fim da licença parental inicial`,
        'O pai regressa ao trabalho no dia útil seguinte.')
    );
  } else {
    lista.push(
      ev(total - 1, `Dia ${total}: fim da licença parental inicial`,
        'Regresso ao trabalho no dia útil seguinte (ou início da licença alargada, se pedida).')
    );
  }
  return lista;
}

const eventosDoDia = iso => estado.eventos
  .filter(e => e.data === iso)
  .sort((a, b) => (a.hora || '99') < (b.hora || '99') ? -1 : 1);

// Pontos coloridos de um dia (máx. 3).
function pontos(iso) {
  const cores = [];
  for (const m of (marcos[iso] || [])) cores.push(`var(--c-${m.categoria})`);
  for (const e of eventosDoDia(iso)) { cores.push('var(--c-evento)'); if (cores.length >= 3) break; }
  return '<span class="cal-pontos">' +
    cores.slice(0, 3).map(c => `<i style="background:${c}"></i>`).join('') + '</span>';
}

function celulaDia(d) {
  const iso = paraISO(d);
  const classes = ['cal-dia'];
  if (iso === dataLocalISO()) classes.push('hoje');
  if (iso === diaSel) classes.push('sel');
  return `<button type="button" class="${classes.join(' ')}" data-dia="${iso}">
    <span class="num">${d.getDate()}</span>${pontos(iso)}</button>`;
}

// ------------------------------------------------------------- rendering ----

export async function renderCalendario(container) {
  raiz = container;
  await calcularMarcos();
  const sel = deISO(diaSel);
  if (!mesVis) mesVis = { ano: sel.getFullYear(), mes: sel.getMonth() };

  let html = `<div class="cal cartao">
    <button type="button" class="cal-cab" id="calExpandir" aria-expanded="${expandido}">
      ${MESES[mesVis.mes]} ${mesVis.ano} <span class="seta">${expandido ? '▴' : '▾'}</span>
    </button>`;

  if (expandido) {
    html += `<div class="cal-nav">
      <button type="button" id="calAntes" aria-label="Mês anterior">‹</button>
      <button type="button" id="calDepois" aria-label="Mês seguinte">›</button>
    </div>`;
    html += '<div class="cal-grelha cal-letras">' + LETRAS.map(l => `<span>${l}</span>`).join('') + '</div>';
    const primeiro = new Date(mesVis.ano, mesVis.mes, 1);
    const nDias = new Date(mesVis.ano, mesVis.mes + 1, 0).getDate();
    const desvio = (primeiro.getDay() + 6) % 7; // segunda = 0
    html += '<div class="cal-grelha">';
    for (let i = 0; i < desvio; i++) html += '<span></span>';
    for (let dia = 1; dia <= nDias; dia++) html += celulaDia(new Date(mesVis.ano, mesVis.mes, dia));
    html += '</div>';
  } else {
    // semana (segunda a domingo) do dia selecionado
    const inicio = new Date(sel);
    inicio.setDate(sel.getDate() - ((sel.getDay() + 6) % 7));
    html += '<div class="cal-grelha cal-letras">' + LETRAS.map(l => `<span>${l}</span>`).join('') + '</div>';
    html += '<div class="cal-grelha">';
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i);
      html += celulaDia(d);
    }
    html += '</div>';
  }

  html += renderDia() + '</div>';
  container.innerHTML = html;
  ligar();
}

// Eventos e marcos do dia selecionado, por baixo do calendário.
function renderDia() {
  const d = deISO(diaSel);
  const rotulo = `${DIAS_SEMANA[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  let html = `<div class="cal-eventos"><div class="cal-rotulo">${rotulo}</div>`;

  for (const m of (marcos[diaSel] || [])) {
    const destino = m.capitulo && capitulos.find(c => c.id === m.capitulo)
      ? '#guia/' + m.capitulo + (m.seccao ? '/' + slug(m.seccao) : '') : '';
    html += `<div class="cal-evento" style="--cor:var(--c-${m.categoria})">
      <span class="ponto-cor" style="background:var(--c-${m.categoria})"></span>
      <div class="corpo"><div class="titulo">${escaparHtml(m.titulo)}</div>
        <div class="sub">${m.sub ? escaparHtml(m.sub) : (m.categoria === 'vacina' ? 'Vacinas (PNV)' : 'Consulta de vigilância') + ' — data estimada pela idade'}</div></div>
      ${destino ? `<a href="${destino}" aria-label="Abrir no guia">→</a>` : ''}</div>`;
  }
  for (const e of eventosDoDia(diaSel)) {
    html += `<div class="cal-evento editavel" data-id="${e.id}" role="button" tabindex="0" style="--cor:var(--c-evento)">
      <span class="ponto-cor" style="background:var(--c-evento)"></span>
      <div class="corpo"><div class="titulo">${e.hora ? `<span class="hora">${e.hora}</span> ` : ''}${escaparHtml(e.titulo)}</div>
        ${e.notas ? `<div class="sub">${escaparHtml(e.notas)}</div>` : ''}</div></div>`;
  }
  if (!(marcos[diaSel] || []).length && !eventosDoDia(diaSel).length) {
    html += '<div class="cal-vazio">Sem eventos neste dia.</div>';
  }
  html += `<button type="button" class="cal-novo" id="calNovoEvento">+ Lembrete neste dia</button></div>`;
  return html;
}

function ligar() {
  $('#calExpandir').onclick = () => {
    expandido = !expandido;
    if (expandido) { const d = deISO(diaSel); mesVis = { ano: d.getFullYear(), mes: d.getMonth() }; }
    renderCalendario(raiz);
  };
  const antes = $('#calAntes'), depois = $('#calDepois');
  if (antes) antes.onclick = () => { mudarMes(-1); };
  if (depois) depois.onclick = () => { mudarMes(1); };
  raiz.querySelectorAll('.cal-dia').forEach(b => b.onclick = () => {
    diaSel = b.dataset.dia;
    if (expandido) expandido = false; // escolher um dia no mês volta à barra da semana
    renderCalendario(raiz);
  });
  raiz.querySelectorAll('.cal-evento.editavel').forEach(el => {
    const abrir = () => folhaEvento(estado.eventos.find(x => x.id === el.dataset.id));
    el.addEventListener('click', abrir);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter') abrir(); });
  });
  $('#calNovoEvento').onclick = () => folhaEvento(null);
}

function mudarMes(n) {
  const d = new Date(mesVis.ano, mesVis.mes + n, 1);
  mesVis = { ano: d.getFullYear(), mes: d.getMonth() };
  renderCalendario(raiz);
}

// Folha de criar/editar evento/lembrete.
function folhaEvento(e) {
  abrirFolha(`<h2>${e ? 'Editar lembrete' : 'Novo lembrete'}</h2>
    <label>O quê</label>
    <input type="text" id="evTitulo" value="${e ? escaparHtml(e.titulo) : ''}" placeholder="ex: Consulta dos 9 meses, comprar fraldas">
    <label>Dia</label>
    <input type="date" id="evData" value="${e ? e.data : diaSel}">
    <label>Hora (opcional)</label>
    <input type="time" id="evHora" value="${e?.hora || ''}">
    <label>Notas (opcional)</label>
    <input type="text" id="evNotas" value="${e?.notas ? escaparHtml(e.notas) : ''}" placeholder="ex: levar o boletim">
    ${acoesFolha(e ? 'Guardar' : 'Criar lembrete')}
    ${e ? '<button type="button" class="botao-apagar" id="evApagar">Apagar lembrete</button>' : ''}`);

  $('#folhaGuardar').onclick = () => {
    const titulo = $('#evTitulo').value.trim();
    const data = $('#evData').value;
    if (!titulo || !data) { alert('Dá um nome ao lembrete e escolhe o dia.'); return; }
    const obj = e || { id: uid() };
    obj.titulo = titulo;
    obj.data = data;
    obj.hora = $('#evHora').value || undefined;
    obj.notas = $('#evNotas').value.trim() || undefined;
    if (!e) estado.eventos.push(obj);
    guardarEventos();
    diaSel = data;
    fecharFolha();
    renderCalendario(raiz);
  };
  $('#folhaCancelar').onclick = fecharFolha;
  const apagar = $('#evApagar');
  if (apagar) apagar.onclick = () => {
    if (!confirm('Apagar este lembrete?')) return;
    estado.eventos = estado.eventos.filter(x => x.id !== e.id);
    guardarEventos();
    fecharFolha();
    renderCalendario(raiz);
  };
}
