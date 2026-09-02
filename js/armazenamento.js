// Persistência local (localStorage) e export/import de dados.
//
// Todos os dados do utilizador vivem SÓ neste dispositivo, sob chaves "papaya.*".
// O backup exportado é um JSON com schema/versao para validação na importação.

const PREFIXO = 'papaya.';
const SCHEMA_BACKUP = 'papaya-backup';
const VERSAO_BACKUP = 3; // v3 acrescentou o Calor da chama; ainda aceita importar v1 e v2

function carregar(chave, defeito) {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIXO + chave));
    return v ?? defeito;
  } catch {
    return defeito;
  }
}

function guardar(chave, valor) {
  localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
}

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
  chama: carregar('chama', { rituais: [], surpresas: [], registos: [], rev: 0 })
};

export const guardarDefinicoes = () => guardar('definicoes', estado.definicoes);
export const guardarTarefas = () => guardar('tarefas', estado.tarefas);
export const guardarConclusoes = () => guardar('conclusoes', estado.conclusoes);
export const guardarEventos = () => guardar('eventos', estado.eventos);
export const guardarChama = () => { estado.chama.rev++; guardar('chama', estado.chama); };

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
      chama: estado.chama
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

const ehTexto = v => typeof v === 'string';
const ehData = v => ehTexto(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Valida a estrutura de um backup. Devolve { erro } ou { dados, resumo }.
export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object') return { erro: 'O ficheiro não contém JSON válido.' };
  if (obj.schema !== SCHEMA_BACKUP) return { erro: 'Este ficheiro não é um backup da Papaya.' };
  if (obj.versao !== 1 && obj.versao !== 2 && obj.versao !== VERSAO_BACKUP)
    return { erro: `Versão de backup não suportada (${obj.versao}).` };
  const d = obj.dados;
  if (!d || typeof d !== 'object') return { erro: 'O backup não tem a secção de dados.' };
  if (d.eventos == null) d.eventos = []; // backups v1 não tinham eventos
  if (d.chama == null) d.chama = { rituais: [], surpresas: [], registos: [], rev: 0 }; // v1 e v2

  const def = d.definicoes;
  if (!def || typeof def !== 'object' || !ehTexto(def.nomeCrianca ?? '') ||
      (def.dataNascimento !== '' && def.dataNascimento != null && !ehData(def.dataNascimento)) ||
      !Array.isArray(def.membros) ||
      !def.membros.every(m => m && ehTexto(m.id) && ehTexto(m.nome) && ehTexto(m.cor)))
    return { erro: 'As definições no backup estão corrompidas.' };

  if (!Array.isArray(d.tarefas) ||
      !d.tarefas.every(t => t && ehTexto(t.id) && ehTexto(t.titulo) &&
        (t.membroId == null || ehTexto(t.membroId)) &&
        Array.isArray(t.dias) && t.dias.every(x => Number.isInteger(x) && x >= 0 && x <= 6) &&
        typeof t.ativa === 'boolean'))
    return { erro: 'As tarefas no backup estão corrompidas.' };

  if (!d.conclusoes || typeof d.conclusoes !== 'object' ||
      !Object.values(d.conclusoes).every(porDia =>
        porDia && typeof porDia === 'object' &&
        Object.keys(porDia).every(ehData)))
    return { erro: 'O histórico de conclusões no backup está corrompido.' };

  if (!Array.isArray(d.eventos) ||
      !d.eventos.every(e => e && ehTexto(e.id) && ehTexto(e.titulo) && ehData(e.data) &&
        (e.hora == null || (ehTexto(e.hora) && /^\d{2}:\d{2}$/.test(e.hora))) &&
        (e.notas == null || ehTexto(e.notas))))
    return { erro: 'Os eventos do calendário no backup estão corrompidos.' };

  const c = d.chama;
  if (!c || typeof c !== 'object' ||
      !Array.isArray(c.rituais) || !Array.isArray(c.surpresas) || !Array.isArray(c.registos) ||
      !c.rituais.every(r => r && ehTexto(r.id) && typeof r.ativo === 'boolean' &&
        (r.diaSemana == null || (Number.isInteger(r.diaSemana) && r.diaSemana >= 0 && r.diaSemana <= 6)) &&
        (r.semanas == null || (Array.isArray(r.semanas) &&
          r.semanas.every(x => Number.isInteger(x) && x >= 1 && x <= 5))) &&
        (r.mes == null || (Number.isInteger(r.mes) && r.mes >= 1 && r.mes <= 12)) &&
        (r.hora == null || (ehTexto(r.hora) && /^\d{2}:\d{2}$/.test(r.hora))) &&
        (r.pausadoAte == null || ehData(r.pausadoAte)) &&
        (r.adiadoAte == null || ehData(r.adiadoAte))) ||
      !c.surpresas.every(x => x && ehTexto(x.id) && ehTexto(x.titulo) &&
        (x.texto == null || ehTexto(x.texto)) &&
        (x.minha == null || typeof x.minha === 'boolean') &&
        (x.favorita == null || typeof x.favorita === 'boolean') &&
        (x.vezes == null || Number.isInteger(x.vezes)) &&
        (x.ultimaVez == null || ehData(x.ultimaVez))) ||
      !c.registos.every(g => g && ehTexto(g.id) && ehData(g.data) &&
        (g.ritualId == null || ehTexto(g.ritualId)) &&
        (g.surpresaId == null || ehTexto(g.surpresaId)) &&
        (g.nota == null || ehTexto(g.nota)) &&
        (g.correu == null || (Number.isInteger(g.correu) && g.correu >= 1 && g.correu <= 3))))
    return { erro: 'Os dados do Calor da chama no backup estão corrompidos.' };
  if (!Number.isInteger(c.rev)) c.rev = 0;

  const resumo = {
    membros: def.membros.length,
    tarefas: d.tarefas.length,
    eventos: d.eventos.length,
    registosChama: c.registos.length,
    diasComRegistos: new Set(Object.values(d.conclusoes).flatMap(Object.keys)).size,
    exportadoEm: obj.exportadoEm || null
  };
  return { dados: d, resumo };
}

// Aplica um backup já validado. modo: 'substituir' | 'fundir'.
export function aplicarBackup(dados, modo) {
  if (modo === 'substituir') {
    estado.definicoes = dados.definicoes;
    estado.tarefas = dados.tarefas;
    estado.conclusoes = dados.conclusoes;
    estado.eventos = dados.eventos;
    estado.chama = dados.chama;
  } else {
    // Fundir: união por id (o ficheiro ganha nos conflitos);
    // definições só preenchem o que estiver vazio neste dispositivo.
    const def = estado.definicoes;
    if (!def.nomeCrianca) def.nomeCrianca = dados.definicoes.nomeCrianca;
    if (!def.dataNascimento) def.dataNascimento = dados.definicoes.dataNascimento;
    if (!def.licenca) def.licenca = dados.definicoes.licenca || '';
    for (const m of dados.definicoes.membros) {
      const i = def.membros.findIndex(x => x.id === m.id);
      if (i >= 0) def.membros[i] = m; else def.membros.push(m);
    }
    for (const t of dados.tarefas) {
      const i = estado.tarefas.findIndex(x => x.id === t.id);
      if (i >= 0) estado.tarefas[i] = t; else estado.tarefas.push(t);
    }
    for (const [tarefaId, porDia] of Object.entries(dados.conclusoes)) {
      estado.conclusoes[tarefaId] = { ...(estado.conclusoes[tarefaId] || {}), ...porDia };
    }
    for (const e of dados.eventos) {
      const i = estado.eventos.findIndex(x => x.id === e.id);
      if (i >= 0) estado.eventos[i] = e; else estado.eventos.push(e);
    }
    for (const chave of ['rituais', 'surpresas', 'registos']) {
      for (const item of dados.chama[chave]) {
        const i = estado.chama[chave].findIndex(x => x.id === item.id);
        if (i >= 0) estado.chama[chave][i] = item; else estado.chama[chave].push(item);
      }
    }
  }
  guardarDefinicoes();
  guardarTarefas();
  guardarConclusoes();
  guardarEventos();
  guardarChama();
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
