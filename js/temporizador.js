// Temporizador de mamada: botão flutuante no ecrã Hoje que abre uma folha
// para definir o tempo até à próxima mamada e anotar quantos ml o bebé bebeu.
//
// O estado persiste em localStorage (chave própria, fora do backup — é estado
// transitório, não faz sentido sincronizar entre dispositivos). O botão mostra
// a contagem decrescente e, ao terminar, avisa com aviso visual, vibração e
// (se autorizada) uma notificação. O temporizador continua a contar mesmo
// noutros separadores; só o botão é que aparece apenas no Hoje.

import { $, abrirFolha, fecharFolha } from './ui.js';

const CHAVE = 'papaya.temporizador';

// estado guardado: null ou { inicioMs, duracaoMin, ml? }
function carregar() {
  try { return JSON.parse(localStorage.getItem(CHAVE)); } catch { return null; }
}
function guardar(t) {
  if (t) localStorage.setItem(CHAVE, JSON.stringify(t));
  else localStorage.removeItem(CHAVE);
}

let temporizador = carregar();
let intervalo = null;
let avisado = false; // já disparou o aviso de "terminado" nesta sessão?

const fab = () => $('#fabMamada');
const fimMs = () => temporizador.inicioMs + temporizador.duracaoMin * 60000;
const restanteMs = () => temporizador ? fimMs() - Date.now() : 0;
const terminado = () => temporizador && restanteMs() <= 0;

// Formata milissegundos em H:MM:SS ou M:SS.
function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(seg)}` : `${m}:${p(seg)}`;
}

const horaFim = () =>
  new Date(fimMs()).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------- botão (FAB) -----

function atualizarFab() {
  const b = fab();
  if (!b) return;
  if (!temporizador) {
    b.className = 'fab-mamada';
    b.innerHTML = '<span class="icone">🍼</span>';
    b.setAttribute('aria-label', 'Temporizador de mamada');
  } else if (terminado()) {
    b.className = 'fab-mamada terminado';
    b.innerHTML = '<span class="icone">🍼</span><span class="tempo">Mamada!</span>';
    b.setAttribute('aria-label', 'Está na hora da mamada');
  } else {
    b.className = 'fab-mamada ativo';
    b.innerHTML = `<span class="icone">🍼</span><span class="tempo">${fmt(restanteMs())}</span>`;
    b.setAttribute('aria-label', `Mamada dentro de ${fmt(restanteMs())}`);
  }
}

// ------------------------------------------------------------- contagem -----

function iniciarIntervalo() {
  pararIntervalo();
  intervalo = setInterval(tick, 1000);
}
function pararIntervalo() {
  if (intervalo) { clearInterval(intervalo); intervalo = null; }
}

function tick() {
  if (!temporizador) { pararIntervalo(); atualizarFab(); return; }
  if (terminado()) {
    atualizarFab();
    if (!avisado) {
      avisado = true;
      avisar();
      if ($('#tmpSheet')) folhaTemporizador(); // atualiza a folha, se aberta
    }
    pararIntervalo(); // já não há nada para contar
    return;
  }
  atualizarFab();
  const c = $('#tmpContador');
  if (c) c.textContent = fmt(restanteMs());
}

function avisar() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if ('Notification' in window && Notification.permission === 'granted') {
    const corpo = temporizador.ml
      ? `Última mamada: ${temporizador.ml} ml. Está na hora da próxima.`
      : 'Está na hora da próxima mamada.';
    try { new Notification('Hora da mamada', { body: corpo, tag: 'papaya-mamada' }); } catch {}
  }
}

function pedirPermissaoAvisos() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// --------------------------------------------------------------- folhas -----

function folhaTemporizador() {
  if (!temporizador) return folhaDefinir();
  if (terminado()) return folhaTerminado();
  return folhaAtivo();
}

const RAPIDOS = [[120, '2h'], [150, '2h30'], [180, '3h'], [210, '3h30']];

function folhaDefinir() {
  const minAtual = temporizador ? temporizador.duracaoMin : 180;
  const mlAtual = temporizador && temporizador.ml != null ? temporizador.ml : '';
  abrirFolha(`<div id="tmpSheet"><h2>Temporizador de mamada</h2>
    <label>Tempo até à próxima mamada</label>
    <div class="tmp-rapidos" id="tmpRapidos">
      ${RAPIDOS.map(([v, l]) => `<button type="button" data-min="${v}" class="${v === minAtual ? 'sel' : ''}">${l}</button>`).join('')}
    </div>
    <label>Ou minutos exatos</label>
    <input type="number" id="tmpMin" inputmode="numeric" min="1" max="1440" value="${minAtual}">
    <label>Quantos ml bebeu? (opcional)</label>
    <input type="number" id="tmpMl" inputmode="numeric" min="0" step="5" placeholder="ex: 90" value="${mlAtual}">
    <div class="acoes">
      <button type="button" class="botao-cancelar" id="tmpCancelar">Cancelar</button>
      <button type="button" class="botao-guardar" id="tmpIniciar">Iniciar</button>
    </div></div>`);

  const min = $('#tmpMin');
  document.querySelectorAll('#tmpRapidos button').forEach(b => b.onclick = () => {
    min.value = b.dataset.min;
    marcarRapido();
  });
  min.oninput = marcarRapido;
  $('#tmpCancelar').onclick = fecharFolha;
  $('#tmpIniciar').onclick = () => {
    const m = parseInt(min.value, 10);
    if (!m || m < 1) { alert('Escolhe quantos minutos até à próxima mamada.'); return; }
    temporizador = { inicioMs: Date.now(), duracaoMin: m };
    if ($('#tmpMl').value !== '') temporizador.ml = +$('#tmpMl').value;
    guardar(temporizador);
    avisado = false;
    pedirPermissaoAvisos();
    iniciarIntervalo();
    atualizarFab();
    folhaTemporizador();
  };
}

function marcarRapido() {
  const v = $('#tmpMin').value;
  document.querySelectorAll('#tmpRapidos button').forEach(b =>
    b.classList.toggle('sel', b.dataset.min === v));
}

function folhaAtivo() {
  abrirFolha(`<div id="tmpSheet"><h2>Temporizador de mamada</h2>
    <div class="tmp-contador" id="tmpContador">${fmt(restanteMs())}</div>
    <div class="tmp-info">Toca às <strong>${horaFim()}</strong>${temporizador.ml ? ` · última mamada: <strong>${temporizador.ml} ml</strong>` : ''}</div>
    <div class="acoes">
      <button type="button" class="botao-cancelar" id="tmpFechar">Fechar</button>
      <button type="button" class="botao-guardar" id="tmpNova">Nova mamada</button>
    </div>
    <button type="button" class="botao-apagar" id="tmpParar">Parar temporizador</button></div>`);
  $('#tmpFechar').onclick = fecharFolha;
  $('#tmpNova').onclick = () => folhaDefinir();
  $('#tmpParar').onclick = () => { limpar(); fecharFolha(); };
}

function folhaTerminado() {
  const decorrido = Date.now() - temporizador.inicioMs;
  abrirFolha(`<div id="tmpSheet"><h2>Está na hora da mamada</h2>
    <div class="tmp-info tmp-alerta">Já passaram <strong>${fmt(decorrido)}</strong> desde a última mamada${temporizador.ml ? ` (${temporizador.ml} ml)` : ''}.</div>
    <div class="acoes">
      <button type="button" class="botao-cancelar" id="tmpFechar">Fechar</button>
      <button type="button" class="botao-guardar" id="tmpNova">Nova mamada</button>
    </div>
    <button type="button" class="botao-apagar" id="tmpParar">Parar temporizador</button></div>`);
  $('#tmpFechar').onclick = fecharFolha;
  $('#tmpNova').onclick = () => folhaDefinir();
  $('#tmpParar').onclick = () => { limpar(); fecharFolha(); };
}

function limpar() {
  temporizador = null;
  guardar(null);
  avisado = false;
  pararIntervalo();
  atualizarFab();
}

// --------------------------------------------------------------- arranque ---

export function iniciarTemporizador() {
  const b = fab();
  if (b) b.onclick = folhaTemporizador;
  if (temporizador) {
    avisado = terminado(); // não re-avisar algo que já tinha terminado antes de abrir a app
    atualizarFab();
    if (!terminado()) iniciarIntervalo();
  } else {
    atualizarFab();
  }
}
