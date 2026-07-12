# Papaya — Guia dos Pais (0 aos 2 anos)

App web estática, 100% client-side, para acompanhar o crescimento de uma criança dos 0 aos 2 anos:

- **Hoje** — dicas de saúde, marcos de desenvolvimento e próximas consultas/vacinas adequadas à idade (calculada a partir da data de nascimento), mais a dica Montessori do dia;
- **Guia** — o guia completo, capítulo a capítulo;
- **Pesquisa** — pesquisa em todo o conteúdo, tolerante a acentos e gralhas (Fuse.js);
- **Tarefas** — tarefas recorrentes da família, com membros a cores, marcadas por dia e histórico de 7 dias;
- **Montessori** — dica do dia, princípios e atividades para a idade atual, com ligação ao capítulo completo do guia.

Sem backend, sem contas: os dados vivem só no dispositivo (localStorage), com export/import em JSON para partilhar entre dispositivos (opção substituir ou fundir). Funciona offline e é instalável como PWA.

O mesmo conteúdo (`conteudo/*.md`) alimenta também o PDF do guia — ver `gerar_pdf.py` duas pastas acima.

## Estrutura

```
Papaya/
├── index.html            shell da app
├── css/estilo.css
├── js/
│   ├── app.js            arranque, navegação (#hoje, #guia/..., #pesquisa, #tarefas), definições
│   ├── armazenamento.js  localStorage + export/import com validação
│   ├── conteudo.js       carregamento e parser do Markdown do guia
│   ├── pesquisa.js       índice Fuse.js, acentos, excertos destacados
│   ├── idade.js          ecrã Hoje (dicas por faixa etária)
│   ├── tarefas.js        tarefas da família e histórico
│   ├── montessori.js     separador Montessori e dica do dia
│   ├── ui.js             folha inferior e utilitários
│   └── vendor/fuse.min.mjs
├── conteudo/*.md         o conteúdo do guia (a fonte única — também gera o PDF)
├── dados/
│   ├── capitulos.json    lista ordenada dos capítulos
│   ├── faixas-etarias.json  dicas do ecrã Hoje, por idade
│   └── montessori.json   dicas diárias, princípios e atividades Montessori
├── sw.js                 service worker (offline)
└── manifest.webmanifest  manifest da PWA
```

## Como adicionar ou editar conteúdo (sem tocar em código)

### Editar um capítulo
Edita o `.md` em `conteudo/`. Sintaxe suportada (a mesma do PDF): `# capítulo`, `## secção`, `### subsecção`, listas `-`/`1.`, caixas de destaque `>`, `**negrito**`, `*itálico*`, `` `código` `` e tabelas `| ... |`. Sem emojis (a fonte do PDF não os desenha).

### Adicionar um capítulo novo
1. Cria `conteudo/13-nome.md`, a começar com `# Título do capítulo`.
2. Acrescenta `"13-nome.md"` à lista em `dados/capitulos.json` (a ordem da lista é a ordem na app).
3. Sobe a versão no `sw.js` (ver abaixo).

O capítulo fica automaticamente pesquisável — cada secção `##` é um resultado possível.

### Adicionar dicas ao ecrã Hoje
Acrescenta entradas a `dados/faixas-etarias.json`:

```json
{ "mesesMin": 6, "mesesMax": 9, "categoria": "saude",
  "titulo": "Título curto", "texto": "A dica em si.",
  "capitulo": "05-alimentacao", "seccao": "Título exato da secção ##" }
```

- `mesesMin`/`mesesMax`: faixa etária em meses completos, inclusive.
- `categoria`: `desenvolvimento`, `estimulacao`, `saude`, `alerta` (mostradas enquanto a idade está na faixa) ou `consulta`, `vacina` (pontuais: usa `mesesMin` = `mesesMax` = idade do marco; a app mostra as deste mês e as do marco seguinte).
- `capitulo`/`seccao` (opcionais): criam o link "Ler mais no guia".

### Adicionar dicas e atividades Montessori
Edita `dados/montessori.json`:

- `dicas`: a dica do dia roda automaticamente pela data (a mesma para todos os dispositivos no mesmo dia). Dicas com `mesesMin`/`mesesMax` só entram na rotação quando a idade da criança está na faixa. `seccao` (opcional) é o título exato de uma secção `##` de `conteudo/12-montessori.md` e cria o link "Ler mais".
- `atividades`: sugestões por faixa etária (`mesesMin`–`mesesMax`), mostradas no separador Montessori para a idade atual.
- `principios`: a lista fixa "Os seis princípios".

### Depois de qualquer alteração: subir a versão do service worker
Em `sw.js`, muda `const VERSAO = 'papaya-v1'` para `v2`, `v3`, ... É isto que faz as apps já instaladas irem buscar o conteúdo novo.

## Partilhar dados entre dispositivos

Definições (⚙) → **Exportar dados** gera `papaya-backup-AAAA-MM-DD.json`. Envia o ficheiro para o outro dispositivo (email, mensagem...) e lá usa **Importar dados**:

- **Substituir** — o dispositivo fica exatamente com os dados do ficheiro;
- **Fundir** — junta os dois conjuntos (membros/tarefas por id, histórico dia a dia); em conflito ganha o ficheiro.

O ficheiro é validado antes de aplicar qualquer alteração.

## Nota

Conteúdo informativo baseado em fontes oficiais (DGS/SNS, AAP, NHS, OMS — ver capítulo Fontes). Não substitui aconselhamento médico.
