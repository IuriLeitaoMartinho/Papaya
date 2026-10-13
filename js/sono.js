// Registo do sono: um toque quando adormece, um toque quando acorda.
//
// Três sítios, cada um com o seu papel:
// - a linha "Sono" do ecrã Hoje: o botão "Adormeceu" e a porta para o registo;
// - a faixa por cima da navegação (#faixaSono), só enquanto o bebé dorme e em
//   todos os separadores: quanto tempo leva e o botão "Acordou";
// - o ecrã #sono: o dia de hoje numa régua das 0 às 24 horas, os últimos sete
//   dias, a leitura contra o que o guia indica para a idade, e a lista dos sonos
//   (para corrigir, apagar ou acrescentar um que ficou por registar).
//
// Nenhum toque pede confirmação — às três da manhã quer-se um gesto só. Em troca,
// tudo se desfaz: "Ainda está a dormir" depois de um "Acordou" por engano,
// "Anular" depois de um "Adormeceu" por engano, e as horas corrigem-se sempre.
//
// O sono a decorrer é estado deste telemóvel (chave própria, fora do backup,
// como o temporizador da mamada). Só ao acordar passa a ser um registo, em
// estado.registos, e é esse que viaja no ficheiro exportado.

import { estado, uid, dataLocalISO, guardarRegistos } from './armazenamento.js';
import { capitulos, slug } from './conteudo.js';
import { idadeEmMeses } from './idade.js';
import { $, icone, abrirFolha, fecharFolha, acoesFolha } from './ui.js';

const CHAVE = 'papaya.sonoEmCurso';
const MIN = 60000, HORA = 3600000;

// estado guardado: null ou { inicio: ms }
function carregar() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE));
    return v && Number.isInteger(v.inicio) ? v : null;
  } catch { return null; }
}
function guardarEmCurso() {
  if (emCurso) localStorage.setItem(CHAVE, JSON.stringify(emCurso));
  else localStorage.removeItem(CHAVE);
}

let emCurso = carregar();

// ------------------------------------------------------- horas e durações ---

const p2 = n => String(n).padStart(2, '0');
const hora = ms => { const d = new Date(ms); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };

// "45 min", "1h12" — para ler de relance.
function dur(ms) {
  const m = Math.max(0, Math.round(ms / MIN));
  return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + p2(m % 60);
}
// O mesmo por extenso, para os leitores de ecrã: "1 hora e 12 minutos".
function falado(ms) {
  const m = Math.max(0, Math.round(ms / MIN)), h = Math.floor(m / 60), r = m % 60;
  const horas = h ? h + (h === 1 ? ' hora' : ' horas') : '';
  const minutos = r || !h ? r + (r === 1 ? ' minuto' : ' minutos') : '';
  return [horas, minutos].filter(Boolean).join(' e ');
}
// Tempo decorrido desde um instante: só minutos completos (um contador que
// arredonda para cima diz "1 min" ao fim de trinta segundos).
const passou = desde => dur(Math.floor(Math.max(0, Date.now() - desde) / MIN) * MIN);
// Para frases com "há": "há menos de 1 min", "há 1h12".
const ha = desde => Date.now() - desde < MIN ? 'menos de 1 min' : passou(desde);
// O mesmo por extenso (leitores de ecrã), com os minutos que o ecrã mostra.
const haFalado = desde => Date.now() - desde < MIN ? 'menos de 1 minuto'
  : falado(Math.floor((Date.now() - desde) / MIN) * MIN);

const meiaNoite = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const maisDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const acabaNoutroDia = g => dataLocalISO(new Date(g.inicio)) !== dataLocalISO(new Date(g.fim));

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const plural = n => n === 1 ? 'sono' : 'sonos';

// ---------------------------------------------------------------- contas ----

const sonos = () => estado.registos.filter(g => g.tipo === 'sono' && g.fim > g.inicio);

// Junta intervalos que se tocam ou sobrepõem. É isto que impede contar duas
// vezes o mesmo sono quando os dois pais o registaram, cada um no seu telemóvel.
function uniao(intervalos) {
  const fora = [];
  for (const [a, b] of intervalos.map(i => [...i]).sort((x, y) => x[0] - y[0])) {
    const ultimo = fora[fora.length - 1];
    if (ultimo && a <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], b);
    else fora.push([a, b]);
  }
  return fora;
}

// Depois de uma fusão, o mesmo sono pode estar duas vezes na lista: os dois pais
// tocaram em "Adormeceu" e "Acordou" com um minuto ou dois de diferença. As contas
// já não o contam a dobrar (uniao); a lista mostra só um, e corrigir ou apagar
// esse leva o gémeo atrás.
const TOLERANCIA = 10 * MIN;
const mesmoSono = (a, b) =>
  Math.abs(a.inicio - b.inicio) <= TOLERANCIA && Math.abs(a.fim - b.fim) <= TOLERANCIA;
const gemeos = reg => sonos().filter(g => g !== reg && mesmoSono(g, reg));
function semGemeos(lista) {
  const fora = [];
  // ordem fixa (início, depois id) para os dois telemóveis mostrarem o mesmo
  for (const g of [...lista].sort((a, b) => a.inicio - b.inicio || (a.id < b.id ? -1 : 1))) {
    if (!fora.some(x => mesmoSono(x, g))) fora.push(g);
  }
  return fora;
}

// O sono de um dia, de meia-noite a meia-noite: um sono que atravessa a noite
// conta em cada dia a parte que lhe cabe. `vivo` é o sono que ainda decorre.
function sonoDoDia(dia) {
  const de = +dia, ate = +maisDias(dia, 1);
  const cortar = ([a, b]) => [Math.max(a, de), Math.min(b, ate)];
  const cabe = ([a, b]) => b > a;
  const blocos = uniao(sonos().map(g => cortar([g.inicio, g.fim])).filter(cabe));
  const vivo = emCurso ? [cortar([emCurso.inicio, Date.now()])].filter(cabe) : [];
  const tudo = uniao([...blocos, ...vivo]);
  return { de, ate, blocos, vivo, n: tudo.length, total: tudo.reduce((s, [a, b]) => s + b - a, 0) };
}

// Horas de sono por 24 horas (sestas incluídas) que a OMS recomenda: são as da
// tabela "O que esperar em cada fase" de conteudo/06-sono.md. Mudar lá é mudar
// aqui — a app não pode dizer uma coisa e o guia outra.
const FAIXAS = [
  { ate: 3, min: 14, max: 17, quem: 'até aos 3 meses' },
  { ate: 11, min: 12, max: 16, quem: 'dos 4 aos 11 meses' },
  { ate: 24, min: 11, max: 14, quem: 'dos 12 aos 24 meses' }
];
const SECCAO_GUIA = 'O que esperar em cada fase';
const DIAS_PARA_COMPARAR = 3;

// A leitura da semana contra a idade. Devolve HTML (ou '' se não há nada a dizer).
function leitura(media, nDias) {
  const { dataNascimento } = estado.definicoes;
  const guia = capitulos.find(c => c.id === '06-sono')
    ? `<a class="ler-mais" href="#guia/06-sono/${slug(SECCAO_GUIA)}">Ler no guia${icone('seta-dir')}</a>` : '';
  // O aviso não depende da média: um valor dentro do intervalo não exclui doença.
  const aviso = '<p>Se não acorda ou não responde, ou tem dificuldade marcada em respirar, liga <a href="tel:112">112</a>. Se está mais sonolento do que o habitual ou mama mal, procura avaliação sem esperar pela média: <a href="tel:808242424">SNS 24 — 808 24 24 24</a>.</p>';
  const frase = t => `<div class="sono-leitura"><p>${t}</p>${aviso}${guia}</div>`;

  if (!dataNascimento) {
    return frase('Com a data de nascimento nas Definições, a média da semana passa a ser comparada com o que o guia indica para a idade.');
  }
  const meses = idadeEmMeses(dataNascimento);
  const faixa = meses >= 0 ? FAIXAS.find(f => meses <= f.ate) : null;
  if (!faixa) return '';
  const intervalo = `${faixa.min} a ${faixa.max} horas por dia que o guia indica ${faixa.quem}`;
  if (nDias < DIAS_PARA_COMPARAR) {
    return frase(`Com ${DIAS_PARA_COMPARAR} dias inteiros de registos, a média passa a ser comparada com as ${intervalo}.`);
  }
  const abertura = `Em média ${dur(media)} por dia, nos ${nDias} dias inteiros com registos.`;
  if (media < faixa.min * HORA) {
    return frase(`${abertura} Fica abaixo das ${intervalo}. Basta um sono por registar para a média descer, e o
      intervalo é uma referência, não uma avaliação de saúde. Se a diferença persistir, leva estes registos
      à consulta; perante sinais de doença, pede ajuda mais cedo.`);
  }
  if (media > faixa.max * HORA) {
    return frase(`${abertura} Fica acima das ${intervalo}. Confirma se as horas ficaram bem registadas.
      O intervalo é uma referência e os registos não avaliam a saúde do bebé. Se a diferença persistir,
      leva os registos à consulta.`);
  }
  return frase(`${abertura} Está dentro das ${intervalo}. Isto descreve apenas os sonos registados, não avalia a saúde do bebé.`);
}

// --------------------------------------------------------------- desenho ----

// A régua de um dia: das 0 às 24 horas, com o sono a cheio. É a mesma ideia da
// régua dos 0 aos 24 meses do Hoje, e no dia de hoje a semente marca a hora.
function reguaDia(d, comAgora) {
  const largura = d.ate - d.de;
  const pct = x => (x / largura * 100).toFixed(2) + '%';
  const bloco = ([a, b], classe = '') =>
    `<i class="b${classe}" style="left:${pct(a - d.de)};width:${pct(b - a)}"></i>`;
  const agora = Date.now();
  return `<div class="dia-regua" aria-hidden="true">` +
    [0, 6, 12, 18, 24].map(h => `<i class="t" style="left:${h / 24 * 100}%"></i>`).join('') +
    d.blocos.map(i => bloco(i)).join('') + d.vivo.map(i => bloco(i, ' vivo')).join('') +
    (comAgora && agora < d.ate ? `<i class="agora" style="left:${pct(agora - d.de)}"></i>` : '') +
    '</div>';
}

const ESCALA = '<div class="dia-escala" aria-hidden="true">' +
  [0, 6, 12, 18, 24].map(h => `<span style="left:${h / 24 * 100}%">${h}h</span>`).join('') + '</div>';

// O cartão de hoje. Redesenha-se sozinho enquanto o bebé dorme (ver tique()),
// por isso não leva nada que receba foco.
function htmlHoje() {
  const d = sonoDoDia(meiaNoite());
  const resumo = d.n ? `em ${d.n} ${plural(d.n)}, desde a meia-noite` : 'desde a meia-noite';
  const blocos = uniao([...d.blocos, ...d.vivo]).map(([a, b]) => `das ${hora(a)} às ${hora(b)}`).join(', ');
  return `<p class="sono-total"><span aria-hidden="true">${dur(d.total)}</span>
      <span class="so-leitor">${falado(d.total)} de sono</span> <small>${resumo}</small></p>
    ${reguaDia(d, true)}${ESCALA}
    ${blocos ? `<p class="so-leitor">Sono de hoje: ${blocos}.</p>` : ''}`;
}

function htmlSemana() {
  const dias = [];
  for (let i = 1; i <= 8; i++) dias.push(sonoDoDia(maisDias(meiaNoite(), -i)));
  // A média só conta dias inteiros: os que têm registos e cuja véspera também
  // tem. O dia em que se começa (ou se volta) a registar fica a meio — falta-lhe
  // a noite anterior — e puxava a média para baixo.
  const vespera = dias.pop();
  const comRegisto = dias.filter((d, i) => d.total > 0 && (dias[i + 1] || vespera).total > 0);
  const media = comRegisto.length ? comRegisto.reduce((s, d) => s + d.total, 0) / comRegisto.length : 0;
  const linha = d => {
    const dia = new Date(d.de);
    const longo = dia.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric' });
    return `<li><span class="dia" aria-hidden="true">${DIAS_CURTOS[dia.getDay()]} ${dia.getDate()}</span>
      ${reguaDia(d)}<span class="tot" aria-hidden="true">${d.total ? dur(d.total) : '–'}</span>
      <span class="so-leitor">${longo}: ${d.total ? `${falado(d.total)} em ${d.n} ${plural(d.n)}` : 'sem registos'}</span></li>`;
  };
  return `<h2 class="subtitulo">Últimos 7 dias${comRegisto.length ? ` <span class="conta">média ${dur(media)}</span>` : ''}</h2>
    <div class="cartao"><ul class="sono-semana">${dias.map(linha).join('')}
      <li aria-hidden="true"><span></span>${ESCALA}<span></span></li></ul>
      ${leitura(media, comRegisto.length)}</div>`;
}

// Fica por cima da lista: ao fundo de trinta linhas ninguém dava por ele.
const BOTAO_NOVO = `<button type="button" class="botao-secundario botao-link" id="sonoNovo">${icone('mais')}Acrescentar um sono que já passou</button>`;

// Quantos dias da lista de registos estão à vista (cresce com "Ver mais antigos").
let diasLista = 7;

function htmlRegistos() {
  const todos = semGemeos(sonos()).sort((a, b) => b.inicio - a.inicio);
  const limite = +maisDias(meiaNoite(), -(diasLista - 1));
  const visiveis = todos.filter(g => g.inicio >= limite);
  const hoje = +meiaNoite(), ontem = +maisDias(meiaNoite(), -1);
  let html = '<h2 class="subtitulo">Registos</h2>' + BOTAO_NOVO;
  if (!visiveis.length) {
    html += `<div class="vazio">Nenhum sono registado nos últimos ${diasLista} dias.</div>`;
  } else {
    let diaAnterior = null;
    html += '<div class="lista sono-registos">' + visiveis.map(g => {
      const dia = +meiaNoite(new Date(g.inicio));
      const rotulo = dia === hoje ? 'Hoje' : dia === ontem ? 'Ontem'
        : new Date(dia).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
      const cabeca = dia !== diaAnterior ? `<h3 class="sono-grupo">${rotulo}</h3>` : '';
      diaAnterior = dia;
      const total = g.fim - g.inicio;
      return `${cabeca}<button type="button" class="sono-reg" data-id="${g.id}"
          aria-label="Sono das ${hora(g.inicio)} às ${hora(g.fim)}, ${falado(total)}. Editar.">
        <span class="horas">${hora(g.inicio)} – ${hora(g.fim)}${acabaNoutroDia(g) ? '<small>dia seguinte</small>' : ''}</span>
        <span class="dur">${dur(total)}</span>${icone('seta-dir')}</button>`;
    }).join('') + '</div>';
  }
  if (todos.length > visiveis.length) {
    html += '<button type="button" class="botao-secundario" id="sonoMais">Ver registos mais antigos</button>';
  }
  return html;
}

// ----------------------------------------------------------------- vistas ---

const vista = () => $('#vista-sono');
const naVista = () => { const v = vista(); return !!v && !v.hidden; };

export function renderSono(alvo) {
  let html = `<button type="button" class="voltar" id="sonoVoltar">${icone('seta-esq')}Hoje</button>`;
  if (emCurso) {
    html += `<section class="cartao sono-agora" aria-label="Sono a decorrer">
      <p class="etiqueta">${icone('lua')}A dormir</p>
      <p class="sono-conta" data-desde="${emCurso.inicio}">${passou(emCurso.inicio)}</p>
      <p class="sono-desde">Adormeceu às ${hora(emCurso.inicio)}</p>
      <button type="button" class="botao-principal grande" id="sonoAcordouVista">Acordou</button>
      <button type="button" class="ler-mais sono-corrigir" id="sonoCorrigir">Corrigir a hora ou anular${icone('seta-dir')}</button>
    </section>`;
  } else {
    const ultimo = ultimoDespertar();
    html += `<button type="button" class="botao-principal grande" id="sonoAdormeceuVista">${icone('lua')}Adormeceu agora</button>` +
      (ultimo ? `<p class="sono-desde fora">Acordou há <span data-desde="${ultimo}" data-ha>${ha(ultimo)}</span></p>` : '');
  }

  if (!sonos().length && !emCurso) {
    html += `<div class="vazio sono-primeiro"><strong>Ainda sem sonos registados</strong>
      Um toque quando o bebé adormece, outro quando acorda. As horas corrigem-se depois, e um sono que
      ficou por registar acrescenta-se à mão.</div>` + BOTAO_NOVO;
  } else {
    html += `<h2 class="subtitulo">Hoje</h2><div class="cartao sono-dia">${htmlHoje()}</div>` +
      htmlSemana() + htmlRegistos();
  }
  alvo.innerHTML = html;

  alvo.querySelector('#sonoVoltar').onclick = () => { location.hash = '#hoje'; };
  const liga = (id, f) => { const b = alvo.querySelector(id); if (b) b.onclick = f; };
  liga('#sonoAdormeceuVista', adormecer);
  liga('#sonoAcordouVista', acordar);
  liga('#sonoCorrigir', folhaEmCurso);
  liga('#sonoNovo', () => folhaSono(null));
  liga('#sonoMais', () => {
    // Abre até ao registo antigo mais próximo e mais duas semanas para trás:
    // somar sempre trinta dias podia não mostrar nada de novo.
    const limite = +maisDias(meiaNoite(), -(diasLista - 1));
    const seguinte = Math.max(...sonos().filter(g => g.inicio < limite).map(g => g.inicio));
    diasLista = Math.ceil((+meiaNoite() - +meiaNoite(new Date(seguinte))) / (24 * HORA)) + 15;
    renderSono(alvo);
  });
  alvo.querySelectorAll('.sono-reg').forEach(b => {
    b.onclick = () => folhaSono(estado.registos.find(g => g.id === b.dataset.id));
  });
}

// A hora a que acordou pela última vez, se foi há menos de 12 horas.
function ultimoDespertar() {
  const ultimo = Math.max(0, ...sonos().map(g => g.fim));
  return ultimo && ultimo <= Date.now() && Date.now() - ultimo < 12 * HORA ? ultimo : 0;
}

// A linha do Hoje (redesenhada a cada render do Hoje).
let linhaHoje = null;

export function renderSonoHoje(el) {
  linhaHoje = el;
  // Com o bebé ainda por nascer não há sono para registar.
  const { dataNascimento } = estado.definicoes;
  el.hidden = !emCurso && !!dataNascimento && new Date(dataNascimento + 'T00:00:00') > new Date();
  if (el.hidden) { el.innerHTML = ''; return; }

  if (emCurso) {
    el.innerHTML = `<a class="sono-estado" href="#sono">${icone('lua')}<span class="corpo">
        <span class="titulo">A dormir há <span data-desde="${emCurso.inicio}" data-ha>${ha(emCurso.inicio)}</span></span>
        <span class="sub">Desde as ${hora(emCurso.inicio)}</span></span>${icone('seta-dir')}</a>`;
    return;
  }
  const hoje = sonoDoDia(meiaNoite()), ultimo = ultimoDespertar();
  const partes = [];
  if (ultimo) partes.push(`Acordou há <span data-desde="${ultimo}" data-ha>${ha(ultimo)}</span>`);
  if (hoje.total) partes.push(`${ultimo ? 'hoje' : 'Hoje:'} ${dur(hoje.total)} em ${hoje.n} ${plural(hoje.n)}`);
  el.innerHTML = `<a class="sono-estado" href="#sono" aria-label="Registo do sono">${icone('lua')}<span class="corpo">
      <span class="titulo">Sono${icone('seta-dir')}</span>
      <span class="sub">${partes.join(' · ') || 'Um toque ao adormecer'}</span></span></a>
    <button type="button" class="sono-botao" id="sonoAdormeceu">Adormeceu</button>`;
  el.querySelector('#sonoAdormeceu').onclick = adormecer;
}

// ------------------------------------------- faixa do sono (na navegação) ---

// No próprio ecrã do sono a faixa cala-se: o cartão do topo já tem o "Acordou".
export function atualizarFaixaSono() {
  const f = $('#faixaSono');
  if (!f) return;
  const mostra = !!emCurso && !naVista();
  f.hidden = !mostra;
  // A faixa aumenta a barra: o corpo reserva-lhe o espaço (ver --sono-alt).
  document.body.classList.toggle('com-sono', mostra);
  if (!mostra) return;
  const conta = f.querySelector('.conta');
  conta.dataset.desde = emCurso.inicio;
  conta.textContent = passou(emCurso.inicio);
  $('#sonoInfo').setAttribute('aria-label',
    `A dormir há ${haFalado(emCurso.inicio)}, desde as ${hora(emCurso.inicio)}. Ver ou corrigir.`);
}

// Tudo o que mostra o sono, de uma vez. As folhas ficam de fora: quem as abre fecha-as.
function refrescar() {
  atualizarFaixaSono();
  if (linhaHoje && linhaHoje.isConnected) renderSonoHoje(linhaHoje);
  if (naVista()) renderSono(vista());
}

// Os contadores andam ao minuto: de 20 em 20 segundos acerta-se o texto de quem
// tem data-desde, sem redesenhar nada (não rouba o foco a ninguém).
let diaDesenhado = dataLocalISO();

function tique() {
  if (dataLocalISO() !== diaDesenhado) { // passou a meia-noite: os dias mudaram todos
    diaDesenhado = dataLocalISO();
    refrescar();
    return;
  }
  document.querySelectorAll('[data-desde]').forEach(el => {
    el.textContent = 'ha' in el.dataset ? ha(+el.dataset.desde) : passou(+el.dataset.desde);
  });
  atualizarFaixaSono();
  const cartao = emCurso && naVista() && vista().querySelector('.sono-dia');
  if (cartao) cartao.innerHTML = htmlHoje();
}

// ------------------------------------------------------------- os toques ----

function vibrar() {
  try { if (navigator.vibrate) navigator.vibrate(30); } catch { /* sem vibração, segue */ }
}

// Diz aos leitores de ecrã o que acabou de acontecer (#anuncio é aria-live).
function anunciar(texto) {
  const a = $('#anuncio');
  if (a) a.textContent = texto;
}

function adormecer() {
  if (emCurso) return;
  emCurso = { inicio: Date.now() };
  guardarEmCurso();
  vibrar();
  refrescar();
  anunciar(`A contar o sono desde as ${hora(emCurso.inicio)}.`);
  // O botão que se tocou desapareceu: o foco passa para o que o desfaz.
  const seguinte = naVista() ? $('#sonoAcordouVista') : $('#sonoAcordou');
  if (seguinte) seguinte.focus({ preventScroll: true });
}

function acordar() {
  if (!emCurso) return;
  const inicio = emCurso.inicio, fim = Date.now();
  emCurso = null;
  guardarEmCurso();
  vibrar();
  // Menos de um minuto é um toque por engano, não um sono.
  if (fim - inicio < MIN) {
    refrescar();
    anunciar('Sono anulado.');
    abrirFolha(`<h2>Não ficou registado</h2>
      <p class="folha-nota">Passou menos de um minuto entre os dois toques.</p>
      <button type="button" class="botao-principal" id="sonoFechar">Fechar</button>`);
    $('#sonoFechar').onclick = fecharFolha;
    return;
  }
  const reg = { id: uid(), tipo: 'sono', inicio, fim };
  estado.registos.push(reg);
  guardarRegistos();
  refrescar();
  anunciar(`Dormiu ${falado(fim - inicio)}.`);
  folhaAcordou(reg);
}

// --------------------------------------------------------------- folhas -----

// Depois do "Acordou": o que ficou registado, e a saída para quem tocou cedo de mais.
function folhaAcordou(reg) {
  const total = reg.fim - reg.inicio;
  abrirFolha(`<h2>Dormiu ${dur(total)}</h2>
    <p class="folha-nota">Das ${hora(reg.inicio)} às ${hora(reg.fim)}${acabaNoutroDia(reg) ? ' do dia seguinte' : ''}. Já está no registo.</p>
    ${total > 16 * HORA ? `<div class="aviso-import">São mais de 16 horas seguidas. Se o toque em "Acordou"
      ficou esquecido, corrige a hora.</div>` : ''}
    <div class="acoes">
      <button type="button" class="botao-cancelar" id="sonoCorrigirReg">Corrigir horas</button>
      <button type="button" class="botao-guardar" id="sonoFechar">Está certo</button>
    </div>
    <button type="button" class="botao-secundario" id="sonoAinda">Ainda está a dormir</button>`);
  $('#sonoFechar').onclick = fecharFolha;
  $('#sonoCorrigirReg').onclick = () => folhaSono(reg);
  $('#sonoAinda').onclick = () => {
    estado.registos = estado.registos.filter(g => g.id !== reg.id);
    guardarRegistos();
    emCurso = { inicio: reg.inicio };
    guardarEmCurso();
    fecharFolha();
    refrescar();
    anunciar(`Continua a contar desde as ${hora(reg.inicio)}.`);
  };
}

// O sono a decorrer: acertar a hora a que adormeceu, acordar ou anular.
function folhaEmCurso() {
  if (!emCurso) return;
  abrirFolha(`<h2>A dormir</h2>
    <div class="tmp-contador" data-desde="${emCurso.inicio}">${passou(emCurso.inicio)}</div>
    <label for="sonoInicio">Adormeceu às</label>
    <input type="time" id="sonoInicio" value="${hora(emCurso.inicio)}">
    <p class="folha-nota">Se só te lembraste mais tarde, acerta aqui a hora.</p>
    <div class="acoes">
      <button type="button" class="botao-cancelar" id="sonoFechar">Fechar</button>
      <button type="button" class="botao-guardar" id="sonoAcordouFolha">Acordou</button>
    </div>
    <button type="button" class="botao-apagar" id="sonoAnular">Anular: não chegou a dormir</button>`);
  // A hora muda logo ao escolher (não espera por um Guardar): vê-se no contador.
  $('#sonoInicio').onchange = ev => {
    const [h, m] = ev.target.value.split(':').map(Number);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d > new Date()) d.setDate(d.getDate() - 1); // 23:50 escolhido à 00:30 é de ontem
    emCurso = { inicio: +d };
    guardarEmCurso();
    document.querySelector('#folha .tmp-contador').dataset.desde = emCurso.inicio;
    refrescar();
    tique();
  };
  $('#sonoFechar').onclick = fecharFolha;
  $('#sonoAcordouFolha').onclick = acordar;
  $('#sonoAnular').onclick = () => {
    if (!confirm('Anular este sono? Não fica nada registado.')) return;
    emCurso = null;
    guardarEmCurso();
    fecharFolha();
    refrescar();
    anunciar('Sono anulado.');
  };
}

// Acrescentar um sono que já passou, ou corrigir um que está no registo.
function folhaSono(reg) {
  const hojeISO = dataLocalISO();
  abrirFolha(`<h2>${reg ? 'Editar sono' : 'Acrescentar sono'}</h2>
    <label for="sDia">Dia em que adormeceu</label>
    <input type="date" id="sDia" value="${reg ? dataLocalISO(new Date(reg.inicio)) : hojeISO}" max="${hojeISO}">
    <div class="campos-2">
      <div><label for="sInicio">Adormeceu às</label>
        <input type="time" id="sInicio" value="${reg ? hora(reg.inicio) : ''}"></div>
      <div><label for="sFim">Acordou às</label>
        <input type="time" id="sFim" value="${reg ? hora(reg.fim) : ''}"></div>
    </div>
    <p class="folha-nota sono-resumo" id="sResumo" aria-live="polite"></p>
    ${acoesFolha(reg ? 'Guardar' : 'Acrescentar')}
    ${reg ? '<button type="button" class="botao-apagar" id="sApagar">Apagar este sono</button>' : ''}`);

  // Só se pede um dia: se a hora de acordar não é depois da de adormecer, é
  // porque o sono atravessou a meia-noite.
  const ler = () => {
    const dia = $('#sDia').value, a = $('#sInicio').value, b = $('#sFim').value;
    if (!dia || !a || !b) return null;
    const inicio = new Date(`${dia}T${a}:00`), fim = new Date(`${dia}T${b}:00`);
    if (Number.isNaN(+inicio) || Number.isNaN(+fim)) return null;
    if (fim <= inicio) fim.setDate(fim.getDate() + 1);
    return { inicio: +inicio, fim: +fim, iguais: a === b };
  };
  const resumir = () => {
    const v = ler();
    $('#sResumo').textContent = !v || v.iguais ? ''
      : `Dormiu ${dur(v.fim - v.inicio)}${acabaNoutroDia(v) ? ', até ao dia seguinte' : ''}.`;
  };
  for (const id of ['#sDia', '#sInicio', '#sFim']) $(id).oninput = resumir;
  resumir();

  $('#folhaGuardar').onclick = () => {
    const v = ler();
    if (!v) { alert('Indica o dia e as duas horas.'); return; }
    if (v.iguais) { alert('A hora de adormecer e a de acordar são iguais.'); return; }
    if (v.fim > Date.now()) { alert('Esse sono acaba no futuro. Confirma o dia e as horas.'); return; }
    if (reg) {
      const repetidos = gemeos(reg);
      estado.registos = estado.registos.filter(g => !repetidos.includes(g));
      reg.inicio = v.inicio;
      reg.fim = v.fim;
    } else {
      estado.registos.push({ id: uid(), tipo: 'sono', inicio: v.inicio, fim: v.fim });
    }
    guardarRegistos();
    fecharFolha();
    refrescar();
    anunciar(`Sono de ${falado(v.fim - v.inicio)} guardado.`);
  };
  $('#folhaCancelar').onclick = fecharFolha;
  const apagar = $('#sApagar');
  if (apagar) apagar.onclick = () => {
    if (!confirm('Apagar este sono do registo?')) return;
    const repetidos = gemeos(reg);
    estado.registos = estado.registos.filter(g => g !== reg && !repetidos.includes(g));
    guardarRegistos();
    fecharFolha();
    refrescar();
    anunciar('Sono apagado.');
  };
}

// --------------------------------------------------------------- arranque ---

export function iniciarSono() {
  $('#sonoInfo').onclick = folhaEmCurso;
  $('#sonoAcordou').onclick = acordar;
  setInterval(tique, 20000);
  // Ao voltar à app (ecrã desbloqueado, outra app fechada) os números estão velhos.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });
  atualizarFaixaSono();
}
