// Sem dependências: node tests/validar-backup.mjs
// Exercita validarBackup() e aplicarBackup() reais com ficheiros sintéticos:
// as versões antigas têm de entrar, os ficheiros adulterados têm de ficar à porta.
import assert from 'node:assert/strict';

const disco = new Map();
let falharEscrita = -1; // só a n-ésima escrita a partir de agora falha (memória cheia)
let bloqueado = false;  // todas as escritas falham (armazenamento bloqueado)
globalThis.localStorage = {
  getItem: k => disco.has(k) ? disco.get(k) : null,
  setItem: (k, v) => {
    if (bloqueado || falharEscrita-- === 0) throw new DOMException('cheio', 'QuotaExceededError');
    disco.set(k, String(v));
  },
  removeItem: k => disco.delete(k)
};
const {
  estado, validarBackup, aplicarBackup, guardarTarefas, quandoFalharGravacao
} = await import('../js/armazenamento.js');

const agora = Date.now();
const H = 3600000;
const v4 = () => ({
  schema: 'papaya-backup', versao: 4, exportadoEm: new Date(agora).toISOString(),
  dados: {
    definicoes: { nomeCrianca: 'Teste', dataNascimento: '2026-03-01', licenca: '150+30',
      membros: [{ id: 'mabc12', nome: 'Pai', cor: '#D96E34' }] },
    tarefas: [{ id: 't1x', titulo: 'Banho', membroId: 'mabc12', dias: [1, 3], ativa: true }],
    conclusoes: { t1x: { '2026-10-19': true } },
    eventos: [{ id: 'e1', data: '2024-02-29', hora: '09:30', titulo: 'Consulta', notas: 'Levar boletim' }],
    chama: {
      rituais: [{ id: 'conversa', ativo: true, diaSemana: 0, semanas: null, mes: null, hora: '21:00',
        pausadoAte: null, adiadoAte: null }],
      surpresas: [{ id: 'cat:um-bilhete', titulo: 'Um bilhete', minha: false, favorita: true, vezes: 2,
        ultimaVez: '2026-10-01' }],
      registos: [{ id: 'r1', ritualId: 'conversa', surpresaId: null, data: '2026-10-12', correu: 3 }],
      rev: 4
    },
    registos: [{ id: 's1', tipo: 'sono', inicio: agora - 3 * H, fim: agora - H }]
  }
});

const aceita = (obj, msg) => assert(!validarBackup(obj).erro, msg + ': ' + validarBackup(obj).erro);
let recusados = 0;
const recusa = (mexer, msg) => {
  recusados++;
  const obj = v4();
  mexer(obj.dados);
  assert(validarBackup(obj).erro, 'Devia recusar: ' + msg);
};

// Versões antigas: entram sem o que ainda não existia.
aceita(v4(), 'v4 completo');
for (const versao of [1, 2, 3]) {
  const b = v4();
  b.versao = versao;
  if (versao < 4) delete b.dados.registos;
  if (versao < 3) delete b.dados.chama;
  if (versao < 2) delete b.dados.eventos;
  aceita(b, 'v' + versao);
}
const semDefinicoesNovas = v4();
delete semDefinicoesNovas.dados.definicoes.licenca;
semDefinicoesNovas.dados.definicoes.dataNascimento = '';
aceita(semDefinicoesNovas, 'sem licença nem data de nascimento');

// Atributos com marcação (achado da avaliação de 20-10-2026).
recusa(d => { d.definicoes.membros[0].id = 'x" onclick="alert(1)'; }, 'id de membro com aspas');
recusa(d => { d.definicoes.membros[0].cor = 'red" onmouseover="alert(1)'; }, 'cor com atributo');
recusa(d => { d.definicoes.membros[0].cor = 'url(javascript:1)'; }, 'cor que não é #RRGGBB');
recusa(d => { d.tarefas[0].id = '<img>'; }, 'id de tarefa com marcação');
recusa(d => { d.tarefas[0].membroId = 'a b'; }, 'membroId com espaço');
recusa(d => { d.eventos[0].id = 'e"1'; }, 'id de evento com aspas');
recusa(d => { d.chama.rituais[0].id = 'x>'; }, 'id de ritual com marcação');
recusa(d => { d.chama.surpresas[0].id = 'cat:"x'; }, 'id de surpresa com aspas');
recusa(d => { d.registos[0].id = 's 1'; }, 'id de registo com espaço');
recusa(d => { d.conclusoes['t"x'] = { '2026-10-19': true }; }, 'id de tarefa nas conclusões');

// Datas e horas que têm a forma mas não existem.
recusa(d => { d.definicoes.dataNascimento = '2026-99-99'; }, 'data impossível');
recusa(d => { d.definicoes.dataNascimento = '2026-02-30'; }, '30 de fevereiro');
recusa(d => { d.definicoes.dataNascimento = '0001-01-01'; }, 'ano 1');
recusa(d => { d.eventos[0].data = '2025-02-29'; }, '29 de fevereiro fora de ano bissexto');
recusa(d => { d.eventos[0].hora = '25:00'; }, 'hora 25');
recusa(d => { d.chama.rituais[0].hora = '12:60'; }, 'minuto 60');
recusa(d => { d.conclusoes.t1x['2026-13-01'] = true; }, 'mês 13 nas conclusões');
recusa(d => { d.conclusoes.t1x['2026-10-20'] = 'sim'; }, 'conclusão que não é true');
recusa(d => { d.registos[0].inicio = 5; }, 'sono em 1970');
recusa(d => { d.registos[0].fim = agora + 400 * 24 * H; }, 'sono a acabar daqui a um ano');
recusa(d => { d.registos[0].fim = d.registos[0].inicio; }, 'sono sem duração');

// Valores fora da lista, repetidos ou grandes demais.
recusa(d => { d.definicoes.licenca = '999'; }, 'modalidade de licença inexistente');
recusa(d => { d.tarefas.push({ ...d.tarefas[0] }); }, 'tarefas com id repetido');
recusa(d => { d.definicoes.membros.push({ ...d.definicoes.membros[0] }); }, 'membros com id repetido');
recusa(d => { d.registos.push({ ...d.registos[0] }); }, 'registos com id repetido');
recusa(d => { d.eventos[0].titulo = 'x'.repeat(501); }, 'título gigante');
recusa(d => { d.eventos[0].notas = 'x'.repeat(10001); }, 'nota gigante');
recusa(d => { d.chama.surpresas[0].vezes = -1; }, 'contador negativo');
recusa(d => { d.tarefas[0].dias = [0, 1, 2, 3, 4, 5, 6, 0]; }, 'mais de sete dias');
recusa(d => { d.registos = Array.from({ length: 50001 }, (_, i) =>
  ({ id: 's' + i, tipo: 'sono', inicio: agora - 2 * H, fim: agora - H })); }, 'lista enorme');

// Um ficheiro recusado não mexe em nada.
const antes = JSON.stringify(estado);
recusa(d => { d.definicoes.membros[0].cor = 'x'; }, 'cor inválida');
assert.equal(JSON.stringify(estado), antes, 'Uma recusa alterou o estado');

// Substituir e fundir continuam a funcionar com um ficheiro válido.
aplicarBackup(validarBackup(v4()).dados, 'substituir');
assert.equal(estado.definicoes.nomeCrianca, 'Teste');
assert.equal(JSON.parse(disco.get('papaya.registos')).length, 1);
const outro = v4();
outro.dados.definicoes.nomeCrianca = 'Outro';
outro.dados.registos = [{ id: 's2', tipo: 'sono', inicio: agora - 6 * H, fim: agora - 5 * H }];
aplicarBackup(validarBackup(outro).dados, 'fundir');
assert.equal(estado.definicoes.nomeCrianca, 'Teste', 'Fundir não pode trocar o nome já preenchido');
assert.equal(estado.registos.length, 2);

// Memória cheia a meio de uma importação: nada muda, nem no disco nem em memória.
for (const modo of ['substituir', 'fundir']) {
  for (let n = 0; n < 6; n++) {
    const discoAntes = JSON.stringify([...disco]);
    const estadoAntes = JSON.stringify(estado);
    const terceiro = v4();
    terceiro.dados.definicoes.nomeCrianca = '';
    terceiro.dados.tarefas = [{ id: 'novaT', titulo: 'Nova', membroId: null, dias: [2], ativa: true }];
    falharEscrita = n;
    assert.equal(aplicarBackup(validarBackup(terceiro).dados, modo), false, `${modo}: falha na escrita ${n + 1}`);
    falharEscrita = -1;
    assert.equal(JSON.stringify([...disco]), discoAntes, `${modo}: o disco ficou a meio (escrita ${n + 1})`);
    assert.equal(JSON.stringify(estado), estadoAntes, `${modo}: o estado mudou (escrita ${n + 1})`);
  }
}

// O rev da chama sobe sempre, mesmo quando o ficheiro traz um rev mais baixo.
const revAntes = estado.chama.rev;
const revBaixo = v4();
revBaixo.dados.chama.rev = 0;
assert(aplicarBackup(validarBackup(revBaixo).dados, 'substituir'));
assert(estado.chama.rev > revAntes, 'O rev da chama desceu');

// Uma escrita normal que falha não rebenta, avisa uma vez e volta a avisar
// só depois de uma escrita bem-sucedida.
let avisos = 0;
quandoFalharGravacao(() => avisos++);
bloqueado = true;
assert.equal(guardarTarefas(), false);
assert.equal(guardarTarefas(), false);
assert.equal(avisos, 1, 'Avisou mais de uma vez seguida');
bloqueado = false;
assert.equal(guardarTarefas(), true);
bloqueado = true;
guardarTarefas();
assert.equal(avisos, 2, 'Não voltou a avisar depois de recuperar');

// Armazenamento bloqueado de todo: a importação recusa sem mexer em memória.
const emMemoria = JSON.stringify(estado);
assert.equal(aplicarBackup(validarBackup(v4()).dados, 'substituir'), false);
assert.equal(JSON.stringify(estado), emMemoria);
bloqueado = false;

console.log(`OK: backups v1 a v4 aceites; ${recusados} ficheiros adulterados recusados sem mexer no estado; substituir e fundir; importação tudo-ou-nada com memória cheia; aviso de falha de gravação.`);
