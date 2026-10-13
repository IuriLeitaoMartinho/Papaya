// Utilitários de interface partilhados: folha inferior (bottom sheet) e escaping.

export const $ = s => document.querySelector(s);

export const escaparHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ícone do sprite definido no index.html (<symbol id="i-nome">).
export const icone = nome =>
  `<svg class="ic" aria-hidden="true"><use href="#i-${nome}"/></svg>`;

const folha = () => $('#folha');
const fundo = () => $('#fundoFolha');

// Quem abriu a folha, para lhe devolver o foco ao fechar.
let abridor = null;

export function abrirFolha(html) {
  const f = folha();
  // Uma folha pode abrir outra (Definições -> Novo membro): só a primeira guarda o abridor.
  if (!f.classList.contains('aberta')) abridor = document.activeElement;
  f.innerHTML = '<div class="folha-pega" aria-hidden="true"></div>' + html;
  f.scrollTop = 0;
  f.classList.add('aberta');
  fundo().classList.add('aberta');
  document.documentElement.classList.add('folha-aberta');
  f.focus({ preventScroll: true });
}

export function fecharFolha() {
  const f = folha();
  const estavaAberta = f.classList.contains('aberta');
  f.classList.remove('aberta');
  fundo().classList.remove('aberta');
  document.documentElement.classList.remove('folha-aberta');
  if (estavaAberta && abridor && abridor.isConnected) abridor.focus({ preventScroll: true });
  abridor = null;
}

// Fechar ao tocar fora ou com Escape.
document.addEventListener('DOMContentLoaded', () => {
  fundo().addEventListener('click', fecharFolha);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharFolha(); });

// Botões padrão Guardar/Cancelar das folhas.
export function acoesFolha(rotuloGuardar) {
  return `<div class="acoes">
    <button type="button" class="botao-cancelar" id="folhaCancelar">Cancelar</button>
    <button type="button" class="botao-guardar" id="folhaGuardar">${rotuloGuardar}</button>
  </div>`;
}

// Seletor segmentado dos dias da semana (ordem PT: Seg..Dom; valores JS getDay: 0=Dom).
const DIAS = [['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6], ['Dom', 0]];

export function seletorDias(id, selecionados) {
  return `<div class="dias-semana" id="${id}">` + DIAS.map(([rotulo, v]) =>
    `<button type="button" data-v="${v}" class="${selecionados.includes(v) ? 'sel' : ''}">${rotulo}</button>`
  ).join('') + '</div>';
}

export function ligarSeletorDias(id) {
  document.querySelectorAll(`#${id} button`).forEach(b =>
    b.addEventListener('click', () => b.classList.toggle('sel')));
}

// Variante de um só dia (rituais da chama): escolher um dia limpa o anterior.
export function ligarSeletorDiaUnico(id) {
  document.querySelectorAll(`#${id} button`).forEach(b =>
    b.addEventListener('click', () => {
      const jaEstava = b.classList.contains('sel');
      document.querySelectorAll(`#${id} button`).forEach(x => x.classList.remove('sel'));
      if (!jaEstava) b.classList.add('sel');
    }));
}

export function diasSelecionados(id) {
  return [...document.querySelectorAll(`#${id} button.sel`)].map(b => +b.dataset.v);
}
