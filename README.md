# Papaya — Guia dos Pais (0 aos 2 anos)

App web estática, 100% client-side, para acompanhar o crescimento de uma criança dos 0 aos 2 anos:

- **Hoje** — calendário no topo (barra da semana que expande para o mês) com as consultas/vacinas do PNV marcadas automaticamente e lembretes teus; dicas de saúde, marcos de desenvolvimento e próximas consultas/vacinas adequadas à idade (calculada a partir da data de nascimento), mais a dica Montessori do dia;
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
│   ├── calendario.js     calendário do Hoje (semana/mês, lembretes)
│   ├── temporizador.js   temporizador de mamada (botão flutuante do Hoje)
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

### Calendário e lembretes
No topo do ecrã Hoje: toca no nome do mês para expandir a vista mensal e navegar entre meses; toca num dia para ver os eventos dele. As **consultas e vacinas do PNV** aparecem automaticamente (data estimada: data de nascimento + idade do marco em `faixas-etarias.json`; pontos âmbar/verde-água). Os **lembretes** criados com "+ Lembrete neste dia" (pontos roxos) têm dia, hora e notas opcionais, ficam no localStorage e entram no export/import.

Nas Definições (⚙) podes ainda escolher a **modalidade da licença parental** (120, 150, 120+30 ou 150+30). O calendário passa a marcar (pontos rosa) as datas-chave calculadas a partir da data de nascimento: início das licenças, prazo dos 7 dias para comunicar ao empregador, dia 42 (fim do período obrigatório da mãe / limite dos 28+7 do pai), fim de cada bloco e regressos ao trabalho — com link para o capítulo Licença parental do guia.

### Temporizador de mamada
No ecrã Hoje há um **botão flutuante à esquerda** (🍼). Ao tocar, abre uma folha onde defines o tempo até à próxima mamada (atalhos 2h/2h30/3h/3h30 ou minutos exatos) e anotas quantos ml o bebé bebeu. O botão mostra a contagem decrescente e, quando termina, fica em alerta e avisa (vibração e, se autorizada, notificação). O temporizador continua a contar mesmo noutros separadores; o estado fica só neste dispositivo (não entra no backup, por ser transitório).

### Depois de qualquer alteração: subir a versão do service worker
Em `sw.js`, muda `const VERSAO = 'papaya-v1'` para `v2`, `v3`, ... É isto que faz as apps já instaladas irem buscar o conteúdo novo.

## Partilhar dados entre dispositivos

Definições (⚙) → **Exportar dados** gera `papaya-backup-AAAA-MM-DD.json`. Envia o ficheiro para o outro dispositivo (email, mensagem...) e lá usa **Importar dados**:

- **Substituir** — o dispositivo fica exatamente com os dados do ficheiro;
- **Fundir** — junta os dois conjuntos (membros/tarefas por id, histórico dia a dia); em conflito ganha o ficheiro.

O ficheiro é validado antes de aplicar qualquer alteração.

# Testar localmente

Os módulos ES e o `fetch` não funcionam abrindo o `index.html` diretamente — precisa de um servidor:

```
cd GitPage/Papaya
python -m http.server 8000
```

e abre http://localhost:8000. (Para testar alterações com o service worker ativo, faz hard-refresh — Ctrl+Shift+R — ou desativa o SW nas DevTools.)


## Nota

Conteúdo informativo baseado em fontes oficiais (DGS/SNS, AAP, NHS, OMS — ver capítulo Fontes). Não substitui aconselhamento médico.
