// Arranque da app: navegação por hash, cabeçalho, Guia e Definições.
//
// Rotas: #hoje | #guia | #guia/<capitulo> | #guia/<capitulo>/<ancora>
//        #pesquisa | #tarefas | #montessori | #chama | #sono
// Usar o hash dá deep-links (resultados de pesquisa, "ler mais") e faz o
// botão/gesto de retroceder do telemóvel funcionar sem código extra.

import {
  estado, uid, guardarDefinicoes, guardarTarefas, podarConclusoes, podarChama, podarRegistos,
  exportarBackup, validarBackup, aplicarBackup, quandoFalharGravacao
} from './armazenamento.js';
import { carregarGuia, capitulos, grupos, htmlCapitulo, seccoesDoCapitulo } from './conteudo.js';
import { construirIndice, ligarPesquisa } from './pesquisa.js';
import { renderHoje, textoIdade, idadeEmMeses } from './idade.js';
import { renderTarefas, CORES_MEMBRO } from './tarefas.js';
import { renderMontessori } from './montessori.js';
import { renderChama } from './chama.js';
import { iniciarTemporizador } from './temporizador.js';
import { renderSono, iniciarSono, atualizarFaixaSono } from './sono.js';
import { $, escaparHtml, icone, abrirFolha, fecharFolha, acoesFolha } from './ui.js';

// ------------------------------------------------------------- cabeçalho ----

const TITULOS = { guia: 'Guia', tarefas: 'Tarefas', montessori: 'Montessori', chama: 'Calor da chama', sono: 'Sono' };

// O título diz onde estás; a linha por cima diz de quem se trata. No Hoje é ao
// contrário: a idade é a notícia do dia, por isso é ela o título.
function renderCabecalho(separador = separadorAtual) {
  const { nomeCrianca, dataNascimento } = estado.definicoes;
  const idade = dataNascimento ? textoIdade(dataNascimento) : '';
  let sobre, titulo;
  if (separador === 'hoje') {
    const hoje = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    sobre = (nomeCrianca ? nomeCrianca + ' · ' : '') + hoje;
    titulo = idade ? idade[0].toUpperCase() + idade.slice(1) : (nomeCrianca || 'Papaya');
  } else {
    sobre = [nomeCrianca, idade].filter(Boolean).join(' · ') || 'Papaya · dos 0 aos 2 anos';
    titulo = TITULOS[separador];
  }
  $('#cabecalhoSobre').textContent = sobre;
  $('#cabecalhoTitulo').textContent = titulo;
}

// ------------------------------------------------------------------ guia ----

// Lista de capítulos com a pesquisa integrada no topo: enquanto se escreve,
// os resultados substituem a lista; ao limpar, a lista volta.
// Os três números que não podem ficar a dois ecrãs de distância.
const SOS = [['112', '112', 'Emergência'], ['808242424', '808 24 24 24', 'SNS 24'], ['800250250', '800 250 250', 'Antivenenos']];

function linhaCapitulo(id) {
  const i = capitulos.findIndex(c => c.id === id), c = capitulos[i];
  const n = seccoesDoCapitulo(c).length;
  return `<a href="#guia/${c.id}"><span class="num">${String(i + 1).padStart(2, '0')}</span>
    <span class="corpo"><span class="titulo">${escaparHtml(c.titulo)}</span>
    ${n ? `<span class="meta">${n} ${n === 1 ? 'secção' : 'secções'}</span>` : ''}</span>${icone('seta-dir')}</a>`;
}

function renderListaCapitulos(alvo) {
  alvo.innerHTML = `
    <div class="caixa-pesquisa">
      ${icone('pesquisa')}
      <input type="search" id="campoPesquisa" placeholder="Pesquisar: febre, sono, biberão…"
             autocomplete="off" autocapitalize="off" aria-label="Pesquisar no guia">
    </div>
    <div id="guiaResultados"></div>
    <div id="guiaLista" class="lista-capitulos">
      <div class="lista sos" aria-label="Números de emergência">` +
        SOS.map(([tel, numero, quem]) =>
          `<a href="tel:${tel}" aria-label="Ligar ${numero}, ${quem}"><span class="numero">${numero}</span><span class="quem">${quem}</span></a>`
        ).join('') + '</div>' +
      grupos.map(g =>
        (g.titulo ? `<h2 class="subtitulo">${escaparHtml(g.titulo)}</h2>` : '') +
        `<div class="lista${g.urgente ? ' urgente' : ''}">` + g.ids.map(linhaCapitulo).join('') + '</div>'
      ).join('') +
    `</div>`;
  const campo = $('#campoPesquisa'), resultados = $('#guiaResultados'), lista = $('#guiaLista');
  ligarPesquisa(campo, resultados, () => { resultados.innerHTML = ''; });
  campo.addEventListener('input', () => { lista.hidden = campo.value.trim().length >= 2; });
}

// `suave`: dentro do capítulo desliza-se até à secção; à chegada (pesquisa,
// "ler no guia") salta-se logo, sem atravessar vinte ecrãs de texto a correr.
function irParaAncora(ancora, suave) {
  const el = document.getElementById(ancora);
  if (!el) return;
  el.scrollIntoView({ behavior: suave ? 'auto' : 'instant' });
  el.classList.remove('realce');
  void el.offsetWidth; // recomeça a animação se a secção já tinha sido realçada
  el.classList.add('realce');
}

function renderCapitulo(alvo, id, ancora) {
  alvo.innerHTML = `<div class="progresso-leitura" aria-hidden="true"></div>
    <button type="button" class="voltar" id="voltarGuia">${icone('seta-esq')}Todos os capítulos</button>` +
    htmlCapitulo(id);
  $('#voltarGuia').addEventListener('click', () => { location.hash = '#guia'; });
  // Saltar dentro do capítulo não passa pela rota: não se redesenha o texto todo
  // nem se enche o histórico — o botão de retroceder volta à lista de capítulos.
  alvo.querySelectorAll('.indice a').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    history.replaceState(null, '', a.getAttribute('href'));
    irParaAncora(a.dataset.ancora, true);
  }));
  if (ancora) irParaAncora(ancora);
  else scrollTo(0, 0);
  atualizarLeitura();
}

// ---------------------------------------------------------------- rotas -----

// O sono é um ecrã sem lugar na barra: chega-se a ele pelo Hoje, e é o Hoje
// que fica aceso enquanto lá se está.
const vistas = ['hoje', 'guia', 'tarefas', 'montessori', 'chama', 'sono'];
const separadorDaBarra = v => v === 'sono' ? 'hoje' : v;
let separadorAtual = 'hoje';
let capituloAberto = false;

function rota() {
  const partes = location.hash.replace(/^#/, '').split('/');
  const separador = vistas.includes(partes[0]) ? partes[0] : 'hoje';
  const mudouDeVista = separador !== separadorAtual;
  separadorAtual = separador;
  capituloAberto = separador === 'guia' && !!partes[1];
  renderCabecalho(separador);
  // Dentro de um capítulo o cabeçalho cala o "Guia": o título é o do capítulo.
  $('.topo').classList.toggle('em-capitulo', capituloAberto);

  for (const v of vistas) $('#vista-' + v).hidden = v !== separador;
  document.querySelectorAll('.nav-btn[data-sep]').forEach(a => {
    const ativo = a.dataset.sep === separadorDaBarra(separador);
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  fecharFolha();
  if (mudouDeVista) scrollTo({ top: 0, behavior: 'instant' });

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
  else if (separador === 'chama') renderChama($('#vista-chama'));
  else if (separador === 'sono') renderSono($('#vista-sono'));
  atualizarFaixaSono(); // no ecrã do sono a faixa cala-se; ao sair, volta
  atualizarLeitura();
}

// ------------------------------------------------- leitura dos capítulos ----
// Dentro de um capítulo, a linha no topo mostra quanto já se leu e, passado o
// primeiro ecrã, aparece o botão que devolve ao índice do capítulo.

function atualizarLeitura() {
  const botao = $('#botaoIndice');
  const temIndice = capituloAberto && !!document.querySelector('#vista-guia .indice');
  botao.hidden = !(temIndice && scrollY > innerHeight * 0.8);
  const linha = document.querySelector('.progresso-leitura');
  if (linha) {
    const total = document.documentElement.scrollHeight - innerHeight;
    linha.style.setProperty('--lido', total > 0 ? Math.min(1, scrollY / total).toFixed(3) : 0);
  }
}

function ligarLeitura() {
  addEventListener('scroll', () => { if (capituloAberto) atualizarLeitura(); }, { passive: true });
  $('#botaoIndice').addEventListener('click', () => {
    const indice = document.querySelector('#vista-guia .indice');
    if (!indice) return;
    indice.open = true;
    scrollTo({ top: 0 });
  });
}

// ------------------------------------------------------------------ tema ----
// Automático (segue o sistema), claro ou escuro. Vive fora do backup: é uma
// preferência deste ecrã, não da família. O index.html aplica-o antes do CSS.

const CHAVE_TEMA = 'papaya.tema';
const temaAtual = () => document.documentElement.dataset.tema || '';

function aplicarTema(tema) {
  if (tema) document.documentElement.dataset.tema = tema;
  else delete document.documentElement.dataset.tema;
  try {
    if (tema) localStorage.setItem(CHAVE_TEMA, tema);
    else localStorage.removeItem(CHAVE_TEMA);
  } catch { /* sem armazenamento, o tema dura só esta sessão */ }
  pintarBarraDoSistema();
}

// A barra de estado do telemóvel acompanha a cor da tela.
function pintarBarraDoSistema() {
  const cor = getComputedStyle(document.documentElement).getPropertyValue('--musselina').trim();
  if (cor) document.querySelector('meta[name="theme-color"]').content = cor;
  // Na app das lojas a página fica por trás da barra: os ícones (relógio, bateria)
  // seguem o tema da app, que pode não ser o do telemóvel. DARK = ícones claros.
  const barras = window.Capacitor?.Plugins?.SystemBars;
  if (!barras) return;
  const escuro = temaAtual() === 'escuro' ||
    (!temaAtual() && matchMedia('(prefers-color-scheme: dark)').matches);
  barras.setStyle({ style: escuro ? 'DARK' : 'LIGHT' }).catch(() => {});
}

// ------------------------------------------------------------- definições ---

function folhaDefinicoes() {
  const d = estado.definicoes;
  abrirFolha(`<h2>Definições</h2>
    <label for="defNome">Nome da criança</label>
    <input type="text" id="defNome" value="${escaparHtml(d.nomeCrianca)}" autocomplete="off">
    <label for="defNascimento">Data de nascimento (ou data prevista)</label>
    <input type="date" id="defNascimento" value="${d.dataNascimento || ''}">

    <h3>Licença parental</h3>
    <label for="defLicenca">Marcar as datas no calendário</label>
    <select id="defLicenca">
      <option value="">Não marcar</option>
      <option value="120" ${d.licenca === '120' ? 'selected' : ''}>120 dias (100%)</option>
      <option value="150" ${d.licenca === '150' ? 'selected' : ''}>150 dias (80%)</option>
      <option value="120+30" ${d.licenca === '120+30' ? 'selected' : ''}>Partilhada 120+30 (100%)</option>
      <option value="150+30" ${d.licenca === '150+30' ? 'selected' : ''}>Partilhada 150+30 (83%)</option>
    </select>
    <p class="folha-nota">Prazos, fim de cada bloco e regressos ao trabalho, estimados a partir da data de nascimento. As regras estão no capítulo Licença parental; confirma com a Segurança Social.</p>

    <h3>Família</h3>
    <div id="listaMembros"></div>
    <button type="button" class="botao-secundario" id="defNovoMembro">${icone('mais')}Adicionar membro</button>

    <h3>Aparência</h3>
    <div class="dias-semana" id="defTema" role="group" aria-label="Tema">
      ${[['', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([v, r]) =>
        `<button type="button" data-v="${v}" class="${temaAtual() === v ? 'sel' : ''}" aria-pressed="${temaAtual() === v}">${r}</button>`).join('')}
    </div>

    <h3>Dados</h3>
    <p class="folha-nota">Vivem só neste dispositivo. Exporta o ficheiro para os passares ao outro telemóvel.</p>
    <div class="linha-botoes">
      <button type="button" id="defExportar">Exportar</button>
      <button type="button" id="defImportar">Importar</button>
    </div>
    ${acoesFolha('Guardar')}`);

  renderMembros();
  // O tema muda logo ao toque (não espera pelo Guardar): vê-se o efeito na hora.
  document.querySelectorAll('#defTema button').forEach(b => b.onclick = () => {
    aplicarTema(b.dataset.v);
    document.querySelectorAll('#defTema button').forEach(x => {
      x.classList.toggle('sel', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
  });
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
      <span class="ponto-cor" style="background:${escaparHtml(m.cor)}"></span>
      <span class="nome">${escaparHtml(m.nome)}</span>
      <button type="button" data-id="${escaparHtml(m.id)}" aria-label="Remover ${escaparHtml(m.nome)}">${icone('fechar')}</button>
    </div>`).join('')
    : '<p class="folha-nota">Ainda sem membros. Servem para dizer de quem é cada tarefa.</p>';
  alvo.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (!confirm('Remover este membro? As tarefas dele passam para "Família".')) return;
    estado.definicoes.membros = membros.filter(m => m.id !== b.dataset.id);
    for (const t of estado.tarefas) if (t.membroId === b.dataset.id) t.membroId = null;
    guardarDefinicoes();
    guardarTarefas();
    renderMembros();
  });
}

function folhaMembro() {
  const usadas = estado.definicoes.membros.map(m => m.cor);
  const livre = CORES_MEMBRO.find(c => !usadas.includes(c)) || CORES_MEMBRO[0];
  abrirFolha(`<h2>Novo membro</h2>
    <label for="mNome">Nome</label>
    <input type="text" id="mNome" placeholder="Papá" autocomplete="off">
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
    // Dois anos de registos ficam muito abaixo de 5 MB; acima disso não é um backup nosso.
    if (f.size <= 5 * 1024 * 1024) {
      try { obj = JSON.parse(await f.text()); } catch { /* validarBackup trata */ }
    }
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
      ${r.resumo.registosChama} registo(s) do Calor da chama,
      ${r.resumo.sonos} sono(s),
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
  if (!aplicarBackup(dados, modo)) {
    abrirFolha(`<h2>Importar dados</h2>
      <div class="aviso-import">Não foi possível guardar o backup neste dispositivo: o armazenamento do navegador está cheio ou bloqueado. Nada foi alterado.</div>
      <button type="button" class="botao-principal" id="impFechar">Fechar</button>`);
    $('#impFechar').onclick = folhaDefinicoes;
    return;
  }
  fecharFolha();
  renderCabecalho();
  rota();
}

// -------------------------------------------------------------- arranque ----

async function iniciar() {
  // Avisa uma vez por falha seguida; uma escrita que corra bem rearma o aviso.
  quandoFalharGravacao(() => alert('Não foi possível guardar neste dispositivo: o armazenamento ' +
    'do navegador está cheio ou bloqueado. O que mudaste fica só até fechares a app. ' +
    'Exporta os dados nas Definições para não os perderes.'));
  podarConclusoes();
  podarChama();
  podarRegistos();
  renderCabecalho();
  $('#botaoDefinicoes').addEventListener('click', folhaDefinicoes);
  iniciarTemporizador();
  iniciarSono();
  ligarLeitura();
  pintarBarraDoSistema();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintarBarraDoSistema);
  window.addEventListener('hashchange', rota);

  try {
    await carregarGuia();
    construirIndice(); // a pesquisa é ligada dentro do Guia, ao render da lista
  } catch (e) {
    $('#vista-guia').innerHTML = '<div class="vazio">Não foi possível carregar o conteúdo do guia.<br>' + escaparHtml(String(e)) + '</div>';
  }

  rota();

  // Primeira utilização: pedir logo a data de nascimento.
  if (!estado.definicoes.dataNascimento && !estado.tarefas.length) folhaDefinicoes();

  // Na app das lojas (Capacitor) os ficheiros já vêm no pacote: sem service worker.
  if (APP_NATIVA) ligarVoltarAndroid();
  else if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

const APP_NATIVA = !!window.Capacitor?.isNativePlatform?.();

// Botão de voltar do Android: fecha a folha aberta, senão recua no histórico;
// no primeiro ecrã sai da app. Sem o plugin App (iOS, web) não faz nada.
function ligarVoltarAndroid() {
  const App = window.Capacitor.Plugins?.App;
  if (!App) return;
  App.addListener('backButton', ({ canGoBack }) => {
    if ($('#folha').classList.contains('aberta')) fecharFolha();
    else if (canGoBack) history.back();
    else App.exitApp();
  });
}

iniciar();
