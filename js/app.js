// Arranque da app: navegação por hash, cabeçalho, Guia e Definições.
//
// Rotas: #hoje | #guia | #guia/<capitulo> | #guia/<capitulo>/<ancora>
//        #pesquisa | #tarefas
// Usar o hash dá deep-links (resultados de pesquisa, "ler mais") e faz o
// botão/gesto de retroceder do telemóvel funcionar sem código extra.

import {
  estado, uid, guardarDefinicoes, podarConclusoes,
  exportarBackup, validarBackup, aplicarBackup
} from './armazenamento.js';
import { carregarGuia, capitulos, htmlCapitulo } from './conteudo.js';
import { construirIndice, ligarPesquisa } from './pesquisa.js';
import { renderHoje, textoIdade, idadeEmMeses } from './idade.js';
import { renderTarefas, CORES_MEMBRO } from './tarefas.js';
import { renderMontessori } from './montessori.js';
import { iniciarTemporizador } from './temporizador.js';
import { $, escaparHtml, abrirFolha, fecharFolha, acoesFolha } from './ui.js';

// ------------------------------------------------------------- cabeçalho ----

function renderCabecalho() {
  const { nomeCrianca, dataNascimento } = estado.definicoes;
  $('#cabecalhoNome').textContent = nomeCrianca || 'Papaya';
  $('#cabecalhoIdade').textContent = dataNascimento ? textoIdade(dataNascimento) : '';
}

// ------------------------------------------------------------------ guia ----

function renderListaCapitulos(alvo) {
  alvo.innerHTML = '<div class="lista-capitulos">' + capitulos.map((c, i) =>
    `<a href="#guia/${c.id}"><span class="num">${String(i + 1).padStart(2, '0')}</span>${escaparHtml(c.titulo)}</a>`
  ).join('') + '</div>';
}

function renderCapitulo(alvo, id, ancora) {
  alvo.innerHTML = '<button class="voltar" id="voltarGuia">← Todos os capítulos</button>' + htmlCapitulo(id);
  $('#voltarGuia').addEventListener('click', () => { location.hash = '#guia'; });
  if (ancora) {
    const el = document.getElementById(ancora);
    if (el) {
      el.scrollIntoView();
      el.classList.add('realce');
    }
  } else {
    scrollTo(0, 0);
  }
}

// ---------------------------------------------------------------- rotas -----

const vistas = ['hoje', 'guia', 'pesquisa', 'tarefas', 'montessori'];

function rota() {
  const partes = location.hash.replace(/^#/, '').split('/');
  const separador = vistas.includes(partes[0]) ? partes[0] : 'hoje';

  for (const v of vistas) $('#vista-' + v).hidden = v !== separador;
  document.querySelectorAll('.barra-fundo a').forEach(a =>
    a.classList.toggle('ativo', a.dataset.sep === separador));
  $('#fabMamada').hidden = separador !== 'hoje'; // botão do temporizador só no Hoje
  fecharFolha();

  if (separador === 'hoje') renderHoje($('#vista-hoje'));
  else if (separador === 'guia') {
    if (partes[1]) renderCapitulo($('#vista-guia'), partes[1], partes[2]);
    else renderListaCapitulos($('#vista-guia'));
  }
  else if (separador === 'tarefas') renderTarefas($('#vista-tarefas'));
  else if (separador === 'montessori') {
    const { dataNascimento } = estado.definicoes;
    renderMontessori($('#vista-montessori'), dataNascimento ? idadeEmMeses(dataNascimento) : null);
  }
  else if (separador === 'pesquisa') $('#campoPesquisa').focus();
}

// ------------------------------------------------------------- definições ---

function folhaDefinicoes() {
  const d = estado.definicoes;
  abrirFolha(`<h2>Definições</h2>
    <label>Nome da criança</label>
    <input type="text" id="defNome" value="${escaparHtml(d.nomeCrianca)}">
    <label>Data de nascimento</label>
    <input type="date" id="defNascimento" value="${d.dataNascimento || ''}">

    <label>Licença parental — marcar datas no calendário</label>
    <select id="defLicenca">
      <option value="">Não marcar</option>
      <option value="120" ${d.licenca === '120' ? 'selected' : ''}>120 dias (100%)</option>
      <option value="150" ${d.licenca === '150' ? 'selected' : ''}>150 dias (80%)</option>
      <option value="120+30" ${d.licenca === '120+30' ? 'selected' : ''}>Partilhada 120+30 (100%)</option>
      <option value="150+30" ${d.licenca === '150+30' ? 'selected' : ''}>Partilhada 150+30 (83%)</option>
    </select>
    <div class="aviso-import" style="margin-top:6px">As datas (prazos, fim de cada bloco, regressos ao trabalho) são estimadas a partir da data de nascimento e aparecem no calendário do ecrã Hoje. Regras no capítulo Licença parental do Guia; confirma com a Segurança Social.</div>

    <label>Membros da família (para as tarefas)</label>
    <div id="listaMembros"></div>
    <button type="button" class="botao-secundario" id="defNovoMembro">+ Adicionar membro</button>

    <label>Os dados vivem só neste dispositivo</label>
    <div class="linha-botoes">
      <button type="button" id="defExportar">Exportar dados</button>
      <button type="button" id="defImportar">Importar dados</button>
    </div>
    ${acoesFolha('Guardar')}`);

  renderMembros();
  $('#defNovoMembro').onclick = folhaMembro;
  $('#defExportar').onclick = exportarBackup;
  $('#defImportar').onclick = escolherFicheiroImport;
  $('#folhaGuardar').onclick = () => {
    d.nomeCrianca = $('#defNome').value.trim();
    d.dataNascimento = $('#defNascimento').value;
    d.licenca = $('#defLicenca').value;
    guardarDefinicoes();
    fecharFolha();
    renderCabecalho();
    rota();
  };
  $('#folhaCancelar').onclick = fecharFolha;
}

function renderMembros() {
  const alvo = $('#listaMembros');
  const membros = estado.definicoes.membros;
  alvo.innerHTML = membros.length ? membros.map(m =>
    `<div class="membro-linha">
      <span class="ponto-cor" style="background:${m.cor}; width:14px; height:14px"></span>
      <span class="nome">${escaparHtml(m.nome)}</span>
      <button data-id="${m.id}" aria-label="Remover ${escaparHtml(m.nome)}">✕</button>
    </div>`).join('')
    : '<div class="vazio" style="padding:10px">Ainda sem membros.</div>';
  alvo.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (!confirm('Remover este membro? As tarefas dele passam para "Família".')) return;
    estado.definicoes.membros = membros.filter(m => m.id !== b.dataset.id);
    for (const t of estado.tarefas) if (t.membroId === b.dataset.id) t.membroId = null;
    guardarDefinicoes();
    renderMembros();
  });
}

function folhaMembro() {
  const usadas = estado.definicoes.membros.map(m => m.cor);
  const livre = CORES_MEMBRO.find(c => !usadas.includes(c)) || CORES_MEMBRO[0];
  abrirFolha(`<h2>Novo membro</h2>
    <label>Nome</label>
    <input type="text" id="mNome" placeholder="ex: Papá">
    <label>Cor</label>
    <div class="paleta" id="mPaleta">${CORES_MEMBRO.map(c =>
      `<button type="button" data-cor="${c}" class="${c === livre ? 'sel' : ''}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}
    </div>
    ${acoesFolha('Adicionar')}`);
  document.querySelectorAll('#mPaleta button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#mPaleta button').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
  });
  $('#folhaGuardar').onclick = () => {
    const nome = $('#mNome').value.trim();
    if (!nome) { alert('Escreve o nome do membro.'); return; }
    const cor = document.querySelector('#mPaleta .sel').dataset.cor;
    estado.definicoes.membros.push({ id: uid(), nome, cor });
    guardarDefinicoes();
    folhaDefinicoes(); // volta às definições, já com o membro na lista
  };
  $('#folhaCancelar').onclick = folhaDefinicoes;
}

// ------------------------------------------------------------- importação ---

function escolherFicheiroImport() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    let obj = null;
    try { obj = JSON.parse(await f.text()); } catch { /* validarBackup trata */ }
    const r = validarBackup(obj);
    if (r.erro) {
      abrirFolha(`<h2>Importar dados</h2>
        <div class="aviso-import">${escaparHtml(r.erro)} Nada foi alterado.</div>
        <button type="button" class="botao-principal" id="impFechar">Fechar</button>`);
      $('#impFechar').onclick = folhaDefinicoes;
      return;
    }
    const data = r.resumo.exportadoEm ? new Date(r.resumo.exportadoEm).toLocaleDateString('pt-PT') : 'data desconhecida';
    abrirFolha(`<h2>Importar dados</h2>
      <p>Backup de <strong>${data}</strong>: ${r.resumo.membros} membro(s),
      ${r.resumo.tarefas} tarefa(s), ${r.resumo.eventos} lembrete(s),
      registos em ${r.resumo.diasComRegistos} dia(s).</p>
      <div class="aviso-import"><strong>Substituir</strong> apaga os dados deste dispositivo e usa só os do ficheiro.
      <strong>Fundir</strong> junta os dois (em conflito, ganha o ficheiro).</div>
      <div class="acoes">
        <button type="button" class="botao-cancelar" id="impCancelar">Cancelar</button>
        <button type="button" class="botao-cancelar" id="impFundir">Fundir</button>
        <button type="button" class="botao-guardar" id="impSubstituir">Substituir</button>
      </div>`);
    $('#impCancelar').onclick = folhaDefinicoes;
    $('#impFundir').onclick = () => aplicarEImportar(r.dados, 'fundir');
    $('#impSubstituir').onclick = () => aplicarEImportar(r.dados, 'substituir');
  };
  inp.click();
}

function aplicarEImportar(dados, modo) {
  aplicarBackup(dados, modo);
  fecharFolha();
  renderCabecalho();
  rota();
}

// -------------------------------------------------------------- arranque ----

async function iniciar() {
  podarConclusoes();
  renderCabecalho();
  $('#botaoDefinicoes').addEventListener('click', folhaDefinicoes);
  iniciarTemporizador();
  window.addEventListener('hashchange', rota);

  try {
    await carregarGuia();
    construirIndice();
    ligarPesquisa();
  } catch (e) {
    $('#vista-guia').innerHTML = '<div class="vazio">Não foi possível carregar o conteúdo do guia.<br>' + escaparHtml(String(e)) + '</div>';
  }

  rota();

  // Primeira utilização: pedir logo a data de nascimento.
  if (!estado.definicoes.dataNascimento && !estado.tarefas.length) folhaDefinicoes();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

iniciar();
