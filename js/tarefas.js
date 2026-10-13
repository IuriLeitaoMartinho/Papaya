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
  $, escaparHtml, icone, abrirFolha, fecharFolha, acoesFolha,
  seletorDias, ligarSeletorDias, diasSelecionados
} from './ui.js';

export const CORES_MEMBRO = ['#D96E34', '#6C63B5', '#4E9B6F', '#4788B8', '#C9922A', '#C75450', '#3FA0A0', '#8B5FA8'];

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const membro = id => estado.definicoes.membros.find(m => m.id === id) || null;
const feita = (t, data) => !!estado.conclusoes[t.id]?.[data];

// HTML de uma linha de tarefa (partilhado pela vista Tarefas e pelo Hoje).
function linhaTarefa(t) {
  const m = membro(t.membroId);
  const ok = feita(t, dataLocalISO());
  return `<div class="tarefa ${ok ? 'feita' : ''}" data-id="${t.id}">
    <input type="checkbox" ${ok ? 'checked' : ''} aria-label="Concluir ${escaparHtml(t.titulo)}">
    <div class="corpo">
      <div class="titulo">${escaparHtml(t.titulo)}</div>
      <div class="membro">${m ? `<span class="ponto-cor" style="background:${m.cor}"></span>${escaparHtml(m.nome)}` : 'Família'}</div>
    </div>
  </div>`;
}

function alternarConclusao(t) {
  const hoje = dataLocalISO();
  estado.conclusoes[t.id] = estado.conclusoes[t.id] || {};
  if (estado.conclusoes[t.id][hoje]) delete estado.conclusoes[t.id][hoje];
  else estado.conclusoes[t.id][hoje] = true;
  guardarConclusoes();
}

// Título com a contagem, barra de andamento e a lista das tarefas de hoje.
function blocoDeHoje(titulo, deHoje) {
  const feitas = deHoje.filter(t => feita(t, dataLocalISO())).length;
  return `<h2 class="subtitulo">${titulo} <span class="conta">${feitas} de ${deHoje.length}</span></h2>
    <div class="andamento" aria-hidden="true"><i style="width:${Math.round(feitas / deHoje.length * 100)}%"></i></div>
    <div class="lista">${deHoje.map(linhaTarefa).join('')}</div>`;
}

// Vista compacta das tarefas de hoje, para o painel Hoje (visão geral do dia).
export function renderTarefasHoje(alvo) {
  const diaSemana = new Date().getDay();
  const deHoje = estado.tarefas.filter(t => t.ativa && t.dias.includes(diaSemana));
  if (!deHoje.length) return; // sem tarefas hoje: não ocupa espaço no painel

  alvo.innerHTML = blocoDeHoje('Tarefas de hoje', deHoje) +
    `<a class="ler-mais ver-mais-tarefas" href="#tarefas">Gerir tarefas e histórico${icone('seta-dir')}</a>`;

  alvo.querySelectorAll('.tarefa').forEach(el => {
    const t = estado.tarefas.find(x => x.id === el.dataset.id);
    el.querySelector('input').addEventListener('change', () => {
      alternarConclusao(t);
      renderTarefasHoje(alvo);
    });
  });
}

export function renderTarefas(alvo) {
  const diaSemana = new Date().getDay();
  const deHoje = estado.tarefas.filter(t => t.ativa && t.dias.includes(diaSemana));

  let html = '';
  if (!deHoje.length) {
    html += estado.tarefas.length
      ? '<div class="vazio"><strong>Hoje não há tarefas</strong>As que criaste são para outros dias da semana.</div>'
      : '<div class="vazio"><strong>O que se repete lá em casa</strong>Vitamina D, banho, esterilizar biberões: cria a tarefa uma vez, escolhe os dias e de quem é.</div>';
  } else {
    html += blocoDeHoje('Hoje', deHoje);
  }
  // Sem tarefa nenhuma, criar a primeira é a única coisa a fazer aqui: leva a polpa.
  html += `<button type="button" class="${estado.tarefas.length ? 'botao-secundario' : 'botao-principal'}" id="novaTarefa">${icone('mais')}Nova tarefa</button>`;
  html += historico();
  alvo.innerHTML = html;

  alvo.querySelectorAll('.tarefa').forEach(el => {
    const t = estado.tarefas.find(x => x.id === el.dataset.id);
    el.querySelector('input').addEventListener('change', () => { alternarConclusao(t); renderTarefas(alvo); });
    // Aqui (e só aqui) tocar no nome abre a tarefa para editar.
    const corpo = el.querySelector('.corpo');
    corpo.setAttribute('role', 'button');
    corpo.setAttribute('tabindex', '0');
    corpo.setAttribute('aria-label', 'Editar ' + t.titulo);
    corpo.addEventListener('click', () => folhaTarefa(t, alvo));
    corpo.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); folhaTarefa(t, alvo); }
    });
  });
  $('#novaTarefa').addEventListener('click', () => folhaTarefa(null, alvo));
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
  // Uma semente por dia: cheia = feita, só o contorno = ficou por fazer,
  // um ponto = a tarefa não era para esse dia.
  const semente = (classe, rotulo) => `<i class="s ${classe}" role="img" aria-label="${rotulo}"></i>`;
  return '<h2 class="subtitulo">Últimos 7 dias</h2><div class="cartao historico"><table><thead><tr><th></th>' +
    dias.map(d => `<th class="${d.rotulo === 'Hoje' ? 'hoje-col' : ''}">${d.rotulo}</th>`).join('') +
    '</tr></thead><tbody>' +
    ativas.map(t => '<tr><td>' + escaparHtml(t.titulo) + '</td>' +
      dias.map(d => {
        const aplicavel = t.dias.includes(d.diaSemana);
        const marca = !aplicavel ? semente('folga', 'não se aplica')
          : (feita(t, d.data) ? semente('feito', 'feita') : semente('falhou', 'por fazer'));
        return `<td>${marca}</td>`;
      }).join('') + '</tr>').join('') +
    '</tbody></table></div>';
}

// Folha de criar/editar tarefa.
function folhaTarefa(t, alvo) {
  const membros = estado.definicoes.membros;
  abrirFolha(`<h2>${t ? 'Editar tarefa' : 'Nova tarefa'}</h2>
    <label for="tTitulo">Tarefa</label>
    <input type="text" id="tTitulo" value="${t ? escaparHtml(t.titulo) : ''}" placeholder="Vitamina D ao pequeno-almoço" autocomplete="off">
    <label for="tMembro">Responsável</label>
    <select id="tMembro">
      <option value="">Família (todos)</option>
      ${membros.map(m => `<option value="${m.id}" ${t?.membroId === m.id ? 'selected' : ''}>${escaparHtml(m.nome)}</option>`).join('')}
    </select>
    ${membros.length ? '' : '<p class="folha-nota">Para dizer de quem é cada tarefa, cria os membros da família nas Definições.</p>'}
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
