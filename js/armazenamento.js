// Persistência local (localStorage) e export/import de dados.
//
// Todos os dados do utilizador vivem SÓ neste dispositivo, sob chaves "papaya.*".
// O backup exportado é um JSON com schema/versao para validação na importação.

const PREFIXO = 'papaya.';
const SCHEMA_BACKUP = 'papaya-backup';
const VERSAO_BACKUP = 1;

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
  definicoes: carregar('definicoes', { nomeCrianca: '', dataNascimento: '', membros: [] }),
  tarefas: carregar('tarefas', []),      // [{id, titulo, membroId|null, dias:[0-6], ativa}]
  conclusoes: carregar('conclusoes', {}) // { tarefaId: { 'AAAA-MM-DD': true } }
};

export const guardarDefinicoes = () => guardar('definicoes', estado.definicoes);
export const guardarTarefas = () => guardar('tarefas', estado.tarefas);
export const guardarConclusoes = () => guardar('conclusoes', estado.conclusoes);

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
      conclusoes: estado.conclusoes
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
  if (obj.versao !== VERSAO_BACKUP) return { erro: `Versão de backup não suportada (${obj.versao}).` };
  const d = obj.dados;
  if (!d || typeof d !== 'object') return { erro: 'O backup não tem a secção de dados.' };

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

  const resumo = {
    membros: def.membros.length,
    tarefas: d.tarefas.length,
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
  } else {
    // Fundir: união por id (o ficheiro ganha nos conflitos);
    // definições só preenchem o que estiver vazio neste dispositivo.
    const def = estado.definicoes;
    if (!def.nomeCrianca) def.nomeCrianca = dados.definicoes.nomeCrianca;
    if (!def.dataNascimento) def.dataNascimento = dados.definicoes.dataNascimento;
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
  }
  guardarDefinicoes();
  guardarTarefas();
  guardarConclusoes();
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
