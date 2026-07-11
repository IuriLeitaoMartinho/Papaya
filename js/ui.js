// Utilitários de interface partilhados: folha inferior (bottom sheet) e escaping.

export const $ = s => document.querySelector(s);

export const escaparHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const folha = () => $('#folha');
const fundo = () => $('#fundoFolha');

export function abrirFolha(html) {
  folha().innerHTML = html;
  folha().classList.add('aberta');
  fundo().classList.add('aberta');
}

export function fecharFolha() {
  folha().classList.remove('aberta');
  fundo().classList.remove('aberta');
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

export function diasSelecionados(id) {
  return [...document.querySelectorAll(`#${id} button.sel`)].map(b => +b.dataset.v);
}
