# Papaya — Guia dos Pais (0 aos 2 anos)

App web estática, 100% client-side, para acompanhar o crescimento de uma criança dos 0 aos 2 anos:

- **Hoje** — a visão geral do dia: calendário no topo (semana que expande para o mês) com consultas/vacinas do PNV e lembretes, as **tarefas de hoje** para marcar, a **dica do dia** e as dicas de saúde/desenvolvimento adequadas à idade;
- **Guia** — o guia completo, capítulo a capítulo, com a **pesquisa integrada no topo** (tolerante a acentos e gralhas, Fuse.js);
- **Tarefas** — gestão das tarefas recorrentes da família, com membros a cores e histórico de 7 dias;
- **Montessori** — dica do dia, princípios e atividades para a idade atual, com ligação ao capítulo completo do guia;
- **Calor da chama** — o ecrã do casal: surpresas pequenas em rotação diária e três rituais (conversa, jantar a dois, viagem) com cadência configurável.

A navegação são **botões flutuantes nas margens** (sem barra inferior): à esquerda **Hoje**, **Mamada** (temporizador) e **Chama**; à direita **Guia**, **Tarefas** e **Montessori**. O botão de mamada mostra a contagem decrescente e está sempre acessível.

Os botões flutuam **por cima** do conteúdo, para que o texto e os cartões usem quase toda a largura do ecrã. Para não estorvarem a leitura, **recolhem quando se rola para baixo** e voltam assim que se rola para cima ou a página fica parada. Em ecrãs largos (≥ 900 px) ficam sempre visíveis, porque há margem de sobra.

Sem backend, sem contas: os dados vivem só no dispositivo (localStorage), com export/import em JSON para partilhar entre dispositivos (opção substituir ou fundir). Funciona offline e é instalável como PWA.

O mesmo conteúdo (`conteudo/*.md`) alimenta também o PDF do guia — ver `gerar_pdf.py` duas pastas acima.

## Estrutura

```
Papaya/
├── index.html            shell da app
├── css/estilo.css
├── js/
│   ├── app.js            arranque, navegação (#hoje, #guia/..., #pesquisa, #tarefas, #chama), definições
│   ├── armazenamento.js  localStorage + export/import com validação
│   ├── conteudo.js       carregamento e parser do Markdown do guia
│   ├── pesquisa.js       índice Fuse.js, acentos, excertos destacados
│   ├── idade.js          ecrã Hoje (dicas por faixa etária)
│   ├── tarefas.js        tarefas da família e histórico
│   ├── montessori.js     separador Montessori e dica do dia
│   ├── calendario.js     calendário do Hoje (semana/mês, lembretes)
│   ├── chama.js          Calor da chama (painel, cartões do Hoje, marcos do calendário)
│   ├── temporizador.js   temporizador de mamada (botão flutuante do Hoje)
│   ├── ui.js             folha inferior e utilitários
│   └── vendor/fuse.min.mjs
├── conteudo/*.md         o conteúdo do guia (a fonte única — também gera o PDF)
├── dados/
│   ├── capitulos.json    lista ordenada dos capítulos
│   ├── faixas-etarias.json  dicas do ecrã Hoje, por idade
│   ├── montessori.json   dicas diárias, princípios e atividades Montessori
│   └── chama.json        surpresas e rituais do Calor da chama
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

O capítulo fica automaticamente pesquisável — cada secção `##` **e cada subsecção `###`** é um resultado possível, o que importa em capítulos longos: o resultado aponta para a subsecção exata.

### Palavras-chave de pesquisa
Uma linha `<!-- chaves: uma coisa, outra coisa -->` logo a seguir a um título acrescenta termos de pesquisa a essa secção, sem aparecer no texto (nem na app nem no PDF). Serve para o leitor encontrar a secção pelas palavras que usaria, mesmo que não estejam escritas lá dentro — por exemplo, "quando parar de esterilizar" encontra "Até que idade é preciso esterilizar biberões e tetinas". As chaves de uma secção valem também para as suas subsecções.

A pesquisa aceita **várias palavras** (todas têm de aparecer), ignora acentos e maiúsculas, tolera gralhas, e despreza palavras de ligação. Se a combinação não der resultados, mostra os do termo mais específico e avisa.

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
- Categorias disponíveis: `desenvolvimento`, `estimulacao`, `saude`, `seguranca`, `burocracia`, `preparacao`, `alerta` (mostradas enquanto a idade está na faixa) e `consulta`/`vacina` (pontuais).
- **Meses negativos** servem para o período antes do nascimento (ex.: `-9` a `-1`): aparecem no Hoje como "A preparar" enquanto o bebé ainda não nasceu.

### Adicionar dicas e atividades Montessori
Edita `dados/montessori.json`:

- `dicas`: a dica do dia roda automaticamente pela data (a mesma para todos os dispositivos no mesmo dia). Dicas com `mesesMin`/`mesesMax` só entram na rotação quando a idade da criança está na faixa. `seccao` (opcional) é o título exato de uma secção `##` de `conteudo/12-montessori.md` e cria o link "Ler mais".
- `atividades`: sugestões por faixa etária (`mesesMin`–`mesesMax`), mostradas no separador Montessori para a idade atual.
- `principios`: a lista fixa "Os seis princípios".

### Calendário e lembretes
No topo do ecrã Hoje: toca no nome do mês para expandir a vista mensal e navegar entre meses; toca num dia para ver os eventos dele. As **consultas e vacinas do PNV** aparecem automaticamente (data estimada: data de nascimento + idade do marco em `faixas-etarias.json`; pontos âmbar/verde-água). Os **lembretes** criados com "+ Lembrete neste dia" (pontos roxos) têm dia, hora e notas opcionais, ficam no localStorage e entram no export/import.

Nas Definições (⚙) podes ainda escolher a **modalidade da licença parental** (120, 150, 120+30 ou 150+30). O calendário passa a marcar (pontos rosa) as datas-chave calculadas a partir da data de nascimento: início das licenças, prazo dos 7 dias para comunicar ao empregador, dia 42 (fim do período obrigatório da mãe / limite dos 28+7 do pai), fim de cada bloco e regressos ao trabalho — com link para o capítulo Licença parental do guia.

### Calor da chama

O ecrã do casal, no botão flutuante 🔥 da margem esquerda (sempre acessível, como os outros separadores). Tem três camadas, da mais leve para a mais pesada:

- **Surpresa de hoje** — um gesto pequeno, em rotação automática pela data: os dois telemóveis mostram a mesma sugestão no mesmo dia, para qualquer um dos dois poder pegar nela. "Outra" salta para a seguinte; "Já fiz" conta a vez. As ideias que resultaram guardam-se em **As nossas surpresas** (com favorita ★ e contador de vezes), e podem escrever-se de raiz em "+ Acrescentar surpresa".
- **Os nossos rituais** — conversa sem distrações (semanal), jantar a dois (quinzenal) e viagem só dos dois (anual). Cada um liga-se à parte e configura-se: dia da semana, hora e, no anual, o mês. Tudo é opcional — um ritual desligado não aparece em lado nenhum.
- **Registo** — "Já fizemos" guarda a data. Serve para a app saber quando toca outra vez, e para o casal ver o histórico dos últimos meses.

**No ecrã Hoje** aparecem cartões (etiqueta 🔥) quando um ritual está na hora, mais a surpresa do dia. Cada cartão tem "Já fizemos", "Adiar" (cala o cartão uns dias, sem mexer no ritual) e "Agendar" (cria um lembrete real com dia e hora). **No calendário** os rituais ativos deixam pontos framboesa nas datas previstas; agendar um deles substitui o ponto previsto pelo evento real.

Duas opções deliberadas: um ritual atrasado diz *"está na hora"* e nunca uma contagem de falhas, e nos **primeiros 40 dias** de vida do bebé os rituais nem aparecem no Hoje (nessas semanas um jantar fora não está atrasado, está impossível) — só a surpresa do dia, que custa dez minutos.

#### Acrescentar surpresas sem programar

Edita `dados/chama.json`:

```json
{ "titulo": "Título curto", "texto": "O gesto em si, numa ou duas frases.", "etiqueta": "noite" }
```

- `surpresas`: a lista que roda no dia a dia. A `etiqueta` é opcional e só dá contexto de momento (`manhã`, `dia`, `tarde`, `noite`, `fim de semana`).
- `rituais`: o texto e o enquadramento dos três rituais. O `id` é usado no código e no armazenamento — **não mudar**. O campo `cadencia` é só o valor por omissão; a cadência real é a que cada casal configurar na app. `seccao` é o título exato de uma secção `##` de `conteudo/11-ser-pai.md` e cria o link "ler mais".
- ⚠ **O id de uma surpresa do catálogo vem do título** (`cat:<título em minúsculas com traços>`). Mudar o título cria uma surpresa nova aos olhos da app: perde o contador de vezes e os registos antigos, e volta a aparecer nas "Ideias" de quem já a tinha guardado. Corrigir gralhas no texto é seguro; nos títulos, só com essa consciência.
- Acrescentar surpresas é sempre seguro — entram na rotação na próxima vez que a app carregar.

### Temporizador de mamada
No ecrã Hoje há um **botão flutuante à esquerda** (🍼). Ao tocar, abre uma folha onde defines o tempo até à próxima mamada (atalhos 2h/2h30/3h/3h30 ou minutos exatos) e anotas quantos ml o bebé bebeu. O botão mostra a contagem decrescente e, quando termina, fica em alerta e avisa (vibração e, se autorizada, notificação). O temporizador continua a contar mesmo noutros separadores; o estado fica só neste dispositivo (não entra no backup, por ser transitório).

### Depois de qualquer alteração: subir a versão do service worker
Em `sw.js`, muda `const VERSAO = 'papaya-v1'` para `v2`, `v3`, ... É isto que faz as apps já instaladas irem buscar o conteúdo novo.

## Partilhar dados entre dispositivos

Definições (⚙) → **Exportar dados** gera `papaya-backup-AAAA-MM-DD.json`. Envia o ficheiro para o outro dispositivo (email, mensagem...) e lá usa **Importar dados**:

- **Substituir** — o dispositivo fica exatamente com os dados do ficheiro;
- **Fundir** — junta os dois conjuntos (membros/tarefas por id, histórico dia a dia); em conflito ganha o ficheiro.

O ficheiro é validado antes de aplicar qualquer alteração.

O backup vai na **versão 3**, que acrescentou o Calor da chama: além das definições, tarefas, conclusões e eventos do calendário, leva agora a configuração dos rituais, as surpresas do casal e os registos do que já foi feito. Ficheiros exportados nas versões **1 e 2 continuam a ser aceites** — entram sem dados da chama.

⚠ **Privacidade.** As surpresas do casal — incluindo as que forem escritas de raiz — viajam dentro do JSON exportado. É o que se quer (é assim que os dois pais partilham a mesma lista), mas o ficheiro costuma passar por email ou WhatsApp, onde fica guardado noutro sítio qualquer. Vale a pena ter isso presente antes de o enviar, e apagar a mensagem depois de importar do outro lado.

# Testar localmente

Os módulos ES e o `fetch` não funcionam abrindo o `index.html` diretamente — precisa de um servidor:

```
cd GitPage/Papaya
python -m http.server 8000
```

e abre http://localhost:8000. (Para testar alterações com o service worker ativo, faz hard-refresh — Ctrl+Shift+R — ou desativa o SW nas DevTools.)


## Nota

Conteúdo informativo baseado em fontes oficiais (DGS/SNS, AAP, NHS, OMS — ver capítulo Fontes). Não substitui aconselhamento médico.
