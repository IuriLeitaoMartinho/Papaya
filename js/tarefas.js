// Separador Tarefas: tarefas recorrentes da família, marcadas por dia.
//
// Cada tarefa tem os dias da semana em que se aplica (valores JS getDay(),
// 0=Domingo). As conclusões guardam-se por data local (AAAA-MM-DD), por isso
// o "reset diário" é automático: um dia novo começa sem marcas.

import {
  estado, uid, dataLocalISO,
  guardarTarefas, guardarConclusoes
} from './armazenamento.js';
import {
  $, escaparHtml, abrirFolha, fecharFolha, acoesFolha,
  seletorDias, ligarSeletorDias, diasSelecionados
} from './ui.js';

export const CORES_MEMBRO = ['#D96E34', '#6C63B5', '#4E9B6F', '#4788B8', '#C9922A', '#C75450', '#3FA0A0', '#8B5FA8'];

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const membro = id => estado.definicoes.membros.find(m => m.id === id) || null;
const feita = (t, data) => !!estado.conclusoes[t.id]?.[data];

export function renderTarefas(alvo) {
  const hoje = dataLocalISO();
  const diaSemana = new Date().getDay();
  const deHoje = estado.tarefas.filter(t => t.ativa && t.dias.includes(diaSemana));

  let html = '<div class="subtitulo">Hoje</div>';
  if (!deHoje.length) {
    html += '<div class="vazio">Sem tarefas para hoje.<br>Cria a primeira com o botão abaixo.</div>';
  } else {
    html += deHoje.map(t => {
      const m = membro(t.membroId);
      const ok = feita(t, hoje);
      return `<div class="tarefa ${ok ? 'feita' : ''}" data-id="${t.id}">
        <input type="checkbox" ${ok ? 'checked' : ''} aria-label="Concluir ${escaparHtml(t.titulo)}">
        <div class="corpo">
          <div class="titulo">${escaparHtml(t.titulo)}</div>
          <div class="membro">${m ? `<span class="ponto-cor" style="background:${m.cor}"></span>${escaparHtml(m.nome)}` : 'Família'}</div>
        </div>
      </div>`;
    }).join('');
  }
  html += '<button class="botao-principal" id="novaTarefa">+ Nova tarefa</button>';
  html += historico();
  alvo.innerHTML = html;

  alvo.querySelectorAll('.tarefa').forEach(el => {
    const t = estado.tarefas.find(x => x.id === el.dataset.id);
    el.querySelector('input').addEventListener('change', () => alternar(t, alvo));
    el.querySelector('.corpo').addEventListener('click', () => folhaTarefa(t, alvo));
  });
  $('#novaTarefa').addEventListener('click', () => folhaTarefa(null, alvo));
}

function alternar(t, alvo) {
  const hoje = dataLocalISO();
  estado.conclusoes[t.id] = estado.conclusoes[t.id] || {};
  if (estado.conclusoes[t.id][hoje]) delete estado.conclusoes[t.id][hoje];
  else estado.conclusoes[t.id][hoje] = true;
  guardarConclusoes();
  renderTarefas(alvo);
}

// Grelha dos últimos 7 dias: linhas = tarefas ativas, colunas = dias.
function historico() {
  const ativas = estado.tarefas.filter(t => t.ativa);
  if (!ativas.length) return '';
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dias.push({ data: dataLocalISO(d), diaSemana: d.getDay(), rotulo: i === 0 ? 'Hoje' : NOMES_DIA[d.getDay()] });
  }
  return '<div class="subtitulo">Últimos 7 dias</div><div class="cartao historico"><table><thead><tr><th></th>' +
    dias.map(d => `<th class="${d.rotulo === 'Hoje' ? 'hoje-col' : ''}">${d.rotulo}</th>`).join('') +
    '</tr></thead><tbody>' +
    ativas.map(t => '<tr><td>' + escaparHtml(t.titulo) + '</td>' +
      dias.map(d => {
        const aplicavel = t.dias.includes(d.diaSemana);
        const marca = !aplicavel ? '·' : (feita(t, d.data) ? '<span class="feito">✓</span>' : '—');
        return `<td class="${d.rotulo === 'Hoje' ? 'hoje-col' : ''}">${marca}</td>`;
      }).join('') + '</tr>').join('') +
    '</tbody></table></div>';
}

// Folha de criar/editar tarefa.
function folhaTarefa(t, alvo) {
  const membros = estado.definicoes.membros;
  abrirFolha(`<h2>${t ? 'Editar tarefa' : 'Nova tarefa'}</h2>
    <label>Tarefa</label>
    <input type="text" id="tTitulo" value="${t ? escaparHtml(t.titulo) : ''}" placeholder="ex: Vitamina D ao pequeno-almoço">
    <label>Responsável</label>
    <select id="tMembro">
      <option value="">Família (todos)</option>
      ${membros.map(m => `<option value="${m.id}" ${t?.membroId === m.id ? 'selected' : ''}>${escaparHtml(m.nome)}</option>`).join('')}
    </select>
    ${membros.length ? '' : '<div class="aviso-import">Podes criar membros da família (com nome e cor) nas definições ⚙.</div>'}
    <label>Dias da semana</label>
    ${seletorDias('tDias', t ? t.dias : [0, 1, 2, 3, 4, 5, 6])}
    ${acoesFolha(t ? 'Guardar' : 'Criar tarefa')}
    ${t ? '<button type="button" class="botao-apagar" id="tApagar">Apagar tarefa</button>' : ''}`);
  ligarSeletorDias('tDias');

  $('#folhaGuardar').onclick = () => {
    const titulo = $('#tTitulo').value.trim();
    const dias = diasSelecionados('tDias');
    if (!titulo || !dias.length) { alert('Dá um nome à tarefa e escolhe pelo menos um dia.'); return; }
    const obj = t || { id: uid(), ativa: true };
    obj.titulo = titulo;
    obj.membroId = $('#tMembro').value || null;
    obj.dias = dias;
    if (!t) estado.tarefas.push(obj);
    guardarTarefas();
    fecharFolha();
    renderTarefas(alvo);
  };
  $('#folhaCancelar').onclick = fecharFolha;
  const apagar = $('#tApagar');
  if (apagar) apagar.onclick = () => {
    if (!confirm('Apagar esta tarefa e o seu histórico?')) return;
    estado.tarefas = estado.tarefas.filter(x => x.id !== t.id);
    delete estado.conclusoes[t.id];
    guardarTarefas();
    guardarConclusoes();
    fecharFolha();
    renderTarefas(alvo);
  };
}
