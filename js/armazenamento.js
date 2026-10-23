// Persistência local (localStorage) e export/import de dados.
//
// Todos os dados do utilizador vivem SÓ neste dispositivo, sob chaves "papaya.*".
// O backup exportado é um JSON com schema/versao para validação na importação.

const PREFIXO = 'papaya.';
const SCHEMA_BACKUP = 'papaya-backup';
const VERSAO_BACKUP = 4; // v4 acrescentou os registos (sono); ainda aceita importar v1, v2 e v3

function carregar(chave, defeito) {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIXO + chave));
    return v ?? defeito;
  } catch {
    return defeito;
  }
}

// Uma escrita pode falhar (memória cheia, modo privado, armazenamento bloqueado).
// Nunca rebenta com quem a chamou: devolve false e avisa uma vez, até uma
// escrita voltar a correr bem. Quem avisa é a interface (quandoFalharGravacao).
let avisarFalha = () => {};
let falhou = false;
export const quandoFalharGravacao = fn => { avisarFalha = fn; };

// Escreve (ou apaga, com texto null) uma chave crua do localStorage.
export function escrever(chave, texto) {
  try {
    if (texto == null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, texto);
    falhou = false;
    return true;
  } catch {
    if (!falhou) { falhou = true; avisarFalha(); }
    return false;
  }
}

const guardar = (chave, valor) => escrever(PREFIXO + chave, JSON.stringify(valor));

// Estado partilhado por toda a app. Mutar e chamar o guardar* respetivo.
export const estado = {
  // licenca: modalidade da licença parental para marcar no calendário
  // ('' | '120' | '150' | '120+30' | '150+30')
  definicoes: carregar('definicoes', { nomeCrianca: '', dataNascimento: '', membros: [], licenca: '' }),
  tarefas: carregar('tarefas', []),      // [{id, titulo, membroId|null, dias:[0-6], ativa}]
  conclusoes: carregar('conclusoes', {}),// { tarefaId: { 'AAAA-MM-DD': true } }
  eventos: carregar('eventos', []),      // [{id, data:'AAAA-MM-DD', hora?:'HH:MM', titulo, notas?}]

  // Calor da chama — rituais e surpresas do casal.
  // rituais:   [{ id: 'conversa'|'encontro'|'viagem', ativo: bool,
  //               diaSemana: 0-6|null,   // semanal e quinzenal
  //               semanas: [1,3]|null,   // quinzenal: 1.ª e 3.ª semana do mês
  //               mes: 1-12|null,        // anual
  //               hora: 'HH:MM'|null,
  //               pausadoAte: 'AAAA-MM-DD'|null,
  //               adiadoAte: 'AAAA-MM-DD'|null }]  // adiadoAte cala só o cartão do Hoje
  // surpresas: as do casal — criadas por eles (minha: true, id novo) ou guardadas
  //            do catálogo (minha: false, id 'cat:<slug>' igual ao do catálogo,
  //            para não aparecerem duas vezes na rotação diária).
  //            [{ id, titulo, texto?, minha: bool, favorita: bool, vezes: n,
  //               ultimaVez: 'AAAA-MM-DD'|null }]
  // registos:  [{ id, ritualId|null, surpresaId|null, data: 'AAAA-MM-DD', nota?, correu?: 1-3 }]
  // rev:       contador incrementado a cada escrita (invalida a cache do calendário)
  chama: carregar('chama', { rituais: [], surpresas: [], registos: [], rev: 0 }),

  // Registo diário do bebé: uma só lista para todos os tipos, hoje só o sono.
  // [{ id, tipo: 'sono', inicio: ms, fim: ms }]
  // As horas são instantes (ms desde 1970), não 'AAAA-MM-DD': um sono atravessa
  // a meia-noite e o que interessa é a duração. Um tipo sem duração (uma fralda)
  // fica só com `inicio`. O sono que ainda está a decorrer NÃO vive aqui: é
  // estado deste telemóvel (ver js/sono.js) e só entra na lista ao acordar.
  registos: carregar('registos', [])
};

export const guardarDefinicoes = () => guardar('definicoes', estado.definicoes);
export const guardarTarefas = () => guardar('tarefas', estado.tarefas);
export const guardarConclusoes = () => guardar('conclusoes', estado.conclusoes);
export const guardarEventos = () => guardar('eventos', estado.eventos);
export const guardarChama = () => { estado.chama.rev++; guardar('chama', estado.chama); };
export const guardarRegistos = () => guardar('registos', estado.registos);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Data local no formato AAAA-MM-DD (sem UTC — o dia da tarefa é o dia local).
export function dataLocalISO(d = new Date()) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ---------------------------------------------------------------- export ----

export function exportarBackup() {
  const backup = {
    schema: SCHEMA_BACKUP,
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString(),
    dados: {
      definicoes: estado.definicoes,
      tarefas: estado.tarefas,
      conclusoes: estado.conclusoes,
      eventos: estado.eventos,
      chama: estado.chama,
      registos: estado.registos
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'papaya-backup-' + dataLocalISO() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------- import ----

// O ficheiro vem de fora (email, WhatsApp): tudo o que a app depois mete em HTML
// ou usa em contas tem de ter a forma que a própria app escreveria.
const MAX_TITULO = 500, MAX_NOTA = 10000, MAX_ITENS = 50000;
const LICENCAS = ['', '120', '150', '120+30', '150+30'];
const ehTexto = (v, max = MAX_TITULO) => typeof v === 'string' && v.length <= max;
const ehNota = v => v == null || ehTexto(v, MAX_NOTA);
// uid() dá base 36; o catálogo da chama dá 'cat:<slug>'; os rituais têm nomes fixos.
const ehId = v => typeof v === 'string' && /^[A-Za-z0-9:_-]{1,80}$/.test(v);
const ehCor = v => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
const ehHora = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
// Um dia que existe no calendário: 2026-02-30 e 2026-99-99 têm a forma mas não existem.
function ehData(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, d] = v.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return a >= 1900 && a <= 2200 &&
    dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}
// Instantes do registo diário: depois de 2000 e não mais de um dia à frente
// deste relógio (o outro telemóvel pode estar ligeiramente adiantado).
const ehInstante = v => Number.isInteger(v) && v >= 946684800000 && v <= Date.now() + 86400000;
const lista = v => Array.isArray(v) && v.length <= MAX_ITENS;
const semRepetidos = l => new Set(l.map(x => x.id)).size === l.length;

// Valida a estrutura de um backup. Devolve { erro } ou { dados, resumo }.
export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object') return { erro: 'O ficheiro não contém JSON válido.' };
  if (obj.schema !== SCHEMA_BACKUP) return { erro: 'Este ficheiro não é um backup da Papaya.' };
  if (![1, 2, 3, VERSAO_BACKUP].includes(obj.versao))
    return { erro: `Versão de backup não suportada (${obj.versao}).` };
  const d = obj.dados;
  if (!d || typeof d !== 'object') return { erro: 'O backup não tem a secção de dados.' };
  if (d.eventos == null) d.eventos = []; // backups v1 não tinham eventos
  if (d.chama == null) d.chama = { rituais: [], surpresas: [], registos: [], rev: 0 }; // v1 e v2
  if (d.registos == null) d.registos = []; // até à v3 não havia registo diário

  const def = d.definicoes;
  if (!def || typeof def !== 'object' || !ehTexto(def.nomeCrianca ?? '') ||
      (def.dataNascimento !== '' && def.dataNascimento != null && !ehData(def.dataNascimento)) ||
      (def.licenca != null && !LICENCAS.includes(def.licenca)) ||
      !lista(def.membros) || !semRepetidos(def.membros) ||
      !def.membros.every(m => m && ehId(m.id) && ehTexto(m.nome) && ehCor(m.cor)))
    return { erro: 'As definições no backup estão corrompidas.' };

  if (!lista(d.tarefas) || !semRepetidos(d.tarefas) ||
      !d.tarefas.every(t => t && ehId(t.id) && ehTexto(t.titulo) &&
        (t.membroId == null || ehId(t.membroId)) &&
        Array.isArray(t.dias) && t.dias.length <= 7 &&
        t.dias.every(x => Number.isInteger(x) && x >= 0 && x <= 6) &&
        typeof t.ativa === 'boolean'))
    return { erro: 'As tarefas no backup estão corrompidas.' };

  if (!d.conclusoes || typeof d.conclusoes !== 'object' || Array.isArray(d.conclusoes) ||
      Object.keys(d.conclusoes).length > MAX_ITENS ||
      !Object.entries(d.conclusoes).every(([tarefaId, porDia]) =>
        ehId(tarefaId) && porDia && typeof porDia === 'object' &&
        Object.entries(porDia).every(([dia, feito]) => ehData(dia) && feito === true)))
    return { erro: 'O histórico de conclusões no backup está corrompido.' };

  if (!lista(d.eventos) || !semRepetidos(d.eventos) ||
      !d.eventos.every(e => e && ehId(e.id) && ehTexto(e.titulo) && ehData(e.data) &&
        (e.hora == null || ehHora(e.hora)) && ehNota(e.notas)))
    return { erro: 'Os eventos do calendário no backup estão corrompidos.' };

  const c = d.chama;
  if (!c || typeof c !== 'object' ||
      !lista(c.rituais) || !lista(c.surpresas) || !lista(c.registos) ||
      !semRepetidos(c.rituais) || !semRepetidos(c.surpresas) || !semRepetidos(c.registos) ||
      !c.rituais.every(r => r && ehId(r.id) && typeof r.ativo === 'boolean' &&
        (r.diaSemana == null || (Number.isInteger(r.diaSemana) && r.diaSemana >= 0 && r.diaSemana <= 6)) &&
        (r.semanas == null || (Array.isArray(r.semanas) && r.semanas.length <= 5 &&
          r.semanas.every(x => Number.isInteger(x) && x >= 1 && x <= 5))) &&
        (r.mes == null || (Number.isInteger(r.mes) && r.mes >= 1 && r.mes <= 12)) &&
        (r.hora == null || ehHora(r.hora)) &&
        (r.pausadoAte == null || ehData(r.pausadoAte)) &&
        (r.adiadoAte == null || ehData(r.adiadoAte))) ||
      !c.surpresas.every(x => x && ehId(x.id) && ehTexto(x.titulo) && ehNota(x.texto) &&
        (x.minha == null || typeof x.minha === 'boolean') &&
        (x.favorita == null || typeof x.favorita === 'boolean') &&
        (x.vezes == null || (Number.isInteger(x.vezes) && x.vezes >= 0)) &&
        (x.ultimaVez == null || ehData(x.ultimaVez))) ||
      !c.registos.every(g => g && ehId(g.id) && ehData(g.data) &&
        (g.ritualId == null || ehId(g.ritualId)) &&
        (g.surpresaId == null || ehId(g.surpresaId)) &&
        ehNota(g.nota) &&
        (g.correu == null || (Number.isInteger(g.correu) && g.correu >= 1 && g.correu <= 3))))
    return { erro: 'Os dados do Calor da chama no backup estão corrompidos.' };
  if (!Number.isInteger(c.rev)) c.rev = 0;

  if (!lista(d.registos) || !semRepetidos(d.registos) ||
      !d.registos.every(g => g && ehId(g.id) && ehId(g.tipo) && ehInstante(g.inicio) &&
        (g.fim == null || (ehInstante(g.fim) && g.fim >= g.inicio)) &&
        (g.tipo !== 'sono' || g.fim > g.inicio)))
    return { erro: 'O registo diário no backup está corrompido.' };

  const resumo = {
    membros: def.membros.length,
    tarefas: d.tarefas.length,
    eventos: d.eventos.length,
    registosChama: c.registos.length,
    sonos: d.registos.filter(g => g.tipo === 'sono').length,
    diasComRegistos: new Set(Object.values(d.conclusoes).flatMap(Object.keys)).size,
    exportadoEm: obj.exportadoEm || null
  };
  return { dados: d, resumo };
}

const CHAVES_BACKUP = ['definicoes', 'tarefas', 'conclusoes', 'eventos', 'chama', 'registos'];

// Fundir: união por id (o ficheiro ganha nos conflitos);
// definições só preenchem o que estiver vazio neste dispositivo.
function fundir(atual, dados) {
  const def = atual.definicoes;
  if (!def.nomeCrianca) def.nomeCrianca = dados.definicoes.nomeCrianca;
  if (!def.dataNascimento) def.dataNascimento = dados.definicoes.dataNascimento;
  if (!def.licenca) def.licenca = dados.definicoes.licenca || '';
  const unir = (lista, novos) => {
    for (const item of novos) {
      const i = lista.findIndex(x => x.id === item.id);
      if (i >= 0) lista[i] = item; else lista.push(item);
    }
  };
  unir(def.membros, dados.definicoes.membros);
  unir(atual.tarefas, dados.tarefas);
  for (const [tarefaId, porDia] of Object.entries(dados.conclusoes)) {
    atual.conclusoes[tarefaId] = { ...(atual.conclusoes[tarefaId] || {}), ...porDia };
  }
  unir(atual.eventos, dados.eventos);
  for (const chave of ['rituais', 'surpresas', 'registos']) unir(atual.chama[chave], dados.chama[chave]);
  // Os dois pais podem ter registado o mesmo sono, cada um no seu telemóvel e
  // com ids diferentes. A fusão não apaga nada: quem conta as horas é que não
  // conta duas vezes o mesmo intervalo (ver uniao() em js/sono.js).
  unir(atual.registos, dados.registos);
  return atual;
}

// Aplica um backup já validado. modo: 'substituir' | 'fundir'.
// Tudo ou nada: o estado novo monta-se à parte e escrevem-se as seis chaves; se
// uma falhar a meio, repõem-se as que já tinham sido escritas e o estado em
// memória fica como estava. Devolve false quando nada mudou.
export function aplicarBackup(dados, modo) {
  const atual = Object.fromEntries(CHAVES_BACKUP.map(k => [k, estado[k]]));
  const novo = modo === 'substituir' ? structuredClone(dados) : fundir(structuredClone(atual), dados);
  // O rev só pode subir: é ele que invalida a cache dos marcos do calendário.
  novo.chama.rev = Math.max(estado.chama.rev || 0, novo.chama.rev || 0) + 1;

  let antes;
  try {
    antes = CHAVES_BACKUP.map(k => localStorage.getItem(PREFIXO + k));
  } catch {
    return false; // armazenamento bloqueado: nem dá para ler
  }
  for (let i = 0; i < CHAVES_BACKUP.length; i++) {
    try {
      localStorage.setItem(PREFIXO + CHAVES_BACKUP[i], JSON.stringify(novo[CHAVES_BACKUP[i]]));
    } catch {
      // Repor o que estava. Repor ocupa no máximo o espaço que já ocupava.
      for (let j = 0; j < i; j++) {
        try {
          if (antes[j] == null) localStorage.removeItem(PREFIXO + CHAVES_BACKUP[j]);
          else localStorage.setItem(PREFIXO + CHAVES_BACKUP[j], antes[j]);
        } catch { /* sem mais nada a tentar */ }
      }
      return false;
    }
  }
  for (const k of CHAVES_BACKUP) estado[k] = novo[k];
  return true;
}

// Remove conclusões com mais de `dias` dias (o histórico útil é curto).
export function podarConclusoes(dias = 60) {
  const limite = dataLocalISO(new Date(Date.now() - dias * 86400000));
  let mudou = false;
  for (const [tarefaId, porDia] of Object.entries(estado.conclusoes)) {
    for (const data of Object.keys(porDia)) {
      if (data < limite) { delete porDia[data]; mudou = true; }
    }
    if (!Object.keys(porDia).length) { delete estado.conclusoes[tarefaId]; mudou = true; }
  }
  if (mudou) guardarConclusoes();
}

// Remove registos da chama com mais de `dias` dias. Ao contrário das conclusões,
// o histórico aqui é longo: um ritual anual tem de sobreviver a um ano inteiro.
export function podarChama(dias = 730) {
  const limite = dataLocalISO(new Date(Date.now() - dias * 86400000));
  const antes = estado.chama.registos.length;
  estado.chama.registos = estado.chama.registos.filter(r => r.data >= limite);
  if (estado.chama.registos.length !== antes) guardarChama();
}

// Remove registos diários com mais de `dias` dias: o guia cobre dois anos, e é
// esse o histórico que faz sentido guardar.
export function podarRegistos(dias = 730) {
  const limite = Date.now() - dias * 86400000;
  const antes = estado.registos.length;
  estado.registos = estado.registos.filter(g => (g.fim ?? g.inicio) >= limite);
  if (estado.registos.length !== antes) guardarRegistos();
}
