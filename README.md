# Papaya — Guia dos Pais (0 aos 2 anos)

App web estática, 100% client-side, para acompanhar o crescimento de uma criança dos 0 aos 2 anos:

- **Hoje** — a visão geral do dia: a idade em destaque sobre a **régua dos 0 aos 24 meses** (com o próximo compromisso), o calendário (semana que expande para o mês) com consultas/vacinas do PNV e lembretes, as **tarefas de hoje** para marcar, a **dica do dia** e as dicas adequadas à idade, arrumadas em **gavetas** que abrem e fecham ("Nesta idade" e "Sinais a vigiar" abertas por omissão; a app lembra-se do que cada pessoa abre);
- **Guia** — o guia completo, com a **pesquisa no topo** (tolerante a acentos e gralhas, Fuse.js), os **números de emergência** a um toque e os capítulos **agrupados por tema**; cada capítulo abre com o seu índice;
- **Tarefas** — gestão das tarefas recorrentes da família, com membros a cores e histórico de 7 dias;
- **Montessori** — dica do dia, princípios e atividades para a idade atual, com ligação ao capítulo completo do guia;
- **Calor da chama** — o ecrã do casal: surpresas pequenas em rotação diária e três rituais (conversa, jantar a dois, viagem) com cadência configurável.

A navegação é uma **barra fixa em baixo** com os cinco separadores: **Hoje**, **Guia**, **Tarefas**, **Montessori** e **Chama**. Não tapa conteúdo: a página reserva-lhe o espaço. Em ecrãs largos (≥ 900 px) a barra passa a **calha lateral** à esquerda.

O **temporizador de mamada** não ocupa um lugar na barra: arranca-se no ecrã Hoje e, enquanto conta, aparece como uma **faixa por cima da barra** em todos os separadores (ver "Temporizador de mamada").

O **registo do sono** também não: o botão **Adormeceu** está no Hoje, o **Acordou** numa faixa por cima da barra enquanto o bebé dorme, e o registo completo num ecrã próprio (`#sono`), a que se chega pela linha "Sono" do Hoje (ver "Registo do sono").

## Identidade visual

A app parece o **boletim de saúde do bebé visto à luz de presença**: papel sobre musselina, tinta cor de semente de papaia e um só acento, a polpa. Os títulos vêm em serifa (a voz de um guia impresso) e a interface em sans — sempre com as fontes do sistema, para não haver nada a descarregar e tudo funcionar offline.

Dois motivos repetem-se e são o que distingue a Papaya:

- **a régua** — os 0 aos 24 meses que o guia cobre, no topo do Hoje, com as consultas e vacinas marcadas e a posição de hoje; e a linha no topo de um capítulo, que mostra quanto já se leu;
- **a semente** — a oval inclinada que marca o separador ativo, a idade na régua, os compromissos de cada dia no calendário e as tarefas feitas no histórico.

Os nomes das cores no `css/estilo.css` vêm desse mundo (`--musselina`, `--papel`, `--semente`, `--polpa`); as regras de espaço, raios e profundidade estão no comentário do topo desse ficheiro. Os ícones são um conjunto próprio de traço único, definido uma vez no `index.html` e usado com `icone('nome')` (em `js/ui.js`) — **não usar emojis na interface**: variam de telemóvel para telemóvel.

O tema segue o do sistema; nas Definições pode forçar-se **Claro** ou **Escuro** (fica só neste dispositivo, fora do backup).

Sem backend, sem contas: os dados vivem só no dispositivo (localStorage), com export/import em JSON para partilhar entre dispositivos (opção substituir ou fundir). Funciona offline e é instalável como PWA.

O mesmo conteúdo (`conteudo/*.md`) alimenta também o PDF do guia — ver `gerar_pdf.py` duas pastas acima.

## Estrutura

```
Papaya/
├── index.html            shell da app
├── css/estilo.css
├── js/
│   ├── app.js            arranque, navegação (#hoje, #guia/..., #pesquisa, #tarefas, #chama, #sono), definições
│   ├── armazenamento.js  localStorage + export/import com validação
│   ├── conteudo.js       carregamento e parser do Markdown do guia
│   ├── pesquisa.js       índice Fuse.js, acentos, excertos destacados
│   ├── idade.js          ecrã Hoje (dicas por faixa etária)
│   ├── tarefas.js        tarefas da família e histórico
│   ├── montessori.js     separador Montessori e dica do dia
│   ├── calendario.js     calendário do Hoje (semana/mês, lembretes)
│   ├── chama.js          Calor da chama (painel, cartões do Hoje, marcos do calendário)
│   ├── temporizador.js   temporizador de mamada (botão no Hoje, faixa por cima da barra)
│   ├── sono.js           registo do sono (linha no Hoje, faixa por cima da barra, ecrã #sono)
│   ├── ui.js             folha inferior e utilitários
│   └── vendor/fuse.min.mjs
├── conteudo/*.md         o conteúdo do guia (a fonte única — também gera o PDF)
├── dados/
│   ├── capitulos.json    lista ordenada dos capítulos e os grupos da lista do Guia
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
2. Acrescenta `"13-nome.md"` à lista `capitulos` em `dados/capitulos.json` (a ordem da lista dá o número do capítulo, igual ao do PDF).
3. Acrescenta o mesmo nome a um dos `grupos` do mesmo ficheiro, para escolheres em que parte da lista do Guia aparece. Se te esqueceres, nada se perde: o capítulo aparece no fim, num grupo "Outros".
4. Acrescenta o caminho ao `ASSETS` do `sw.js` e sobe a versão (ver abaixo).

### Arrumar a lista do Guia
A lista do Guia mostra os capítulos por grupos (Urgente, Primeiros dias, Dia a dia...). Os grupos estão em `dados/capitulos.json`, em `grupos`: cada um tem um `titulo` e a lista de ficheiros. Para mudar um capítulo de grupo, muda o nome do ficheiro de uma lista para a outra; para criar um grupo, copia um bloco e muda-lhe o título. `"urgente": true` põe os títulos desse grupo a vermelho. No topo da lista ficam sempre os três números de emergência (112, SNS 24, Antivenenos), que ligam com um toque.

Dentro de cada capítulo, a app gera sozinha o índice "Neste capítulo" a partir das secções `##` (em capítulos com três ou mais).

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
No topo do ecrã Hoje: toca no nome do mês para expandir a vista mensal e navegar entre meses; toca num dia para ver os eventos dele. As **consultas e vacinas do PNV** aparecem automaticamente (data estimada: data de nascimento + idade do marco em `faixas-etarias.json`; sementes âmbar/verde-água). Cada dia mostra no máximo três sementes, uma por tipo de compromisso, e um lembrete criado à mão tem sempre a sua. Os **lembretes** criados com "Lembrete neste dia" (sementes roxas) têm dia, hora e notas opcionais, ficam no localStorage e entram no export/import.

Nas Definições podes ainda escolher a **modalidade da licença parental** (120, 150, 120+30 ou 150+30). O calendário passa a marcar (pontos rosa) as datas-chave calculadas a partir da data de nascimento: início das licenças, prazo dos 7 dias para comunicar ao empregador, dia 42 (fim do período obrigatório da mãe / limite dos 28+7 do pai), fim de cada bloco e regressos ao trabalho — com link para o capítulo Licença parental do guia.

### Calor da chama

O ecrã do casal, no separador **Chama** da barra. Abre com a surpresa do dia; os rituais ligados aparecem em cartão e os desligados recolhem a uma linha com o botão "Ligar". Tem três camadas, da mais leve para a mais pesada:

- **Surpresa de hoje** — um gesto pequeno, em rotação automática pela data: os dois telemóveis mostram a mesma sugestão no mesmo dia, para qualquer um dos dois poder pegar nela. "Outra" salta para a seguinte; "Já fiz" conta a vez. As ideias que resultaram guardam-se em **As nossas surpresas** (com favorita e contador de vezes), e podem escrever-se de raiz em "+ Acrescentar surpresa".
- **Os nossos rituais** — conversa sem distrações (semanal), jantar a dois (quinzenal) e viagem só dos dois (anual). Cada um liga-se à parte e configura-se: dia da semana, hora e, no anual, o mês. Tudo é opcional — um ritual desligado não aparece em lado nenhum.
- **Registo** — "Já fizemos" guarda a data. Serve para a app saber quando toca outra vez, e para o casal ver o histórico dos últimos meses.

**No ecrã Hoje** aparecem cartões (secção "Calor da chama") quando um ritual está na hora, mais a surpresa do dia. Cada cartão tem "Já fizemos", "Adiar" (cala o cartão uns dias, sem mexer no ritual) e "Agendar" (cria um lembrete real com dia e hora). **No calendário** os rituais ativos deixam pontos framboesa nas datas previstas; agendar um deles substitui o ponto previsto pelo evento real.

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
No ecrã Hoje, por baixo da régua, há o botão **Temporizador de mamada**. Ao tocar, abre uma folha onde defines o tempo até à próxima mamada (atalhos 2h/2h30/3h/3h30 ou minutos exatos) e anotas quantos ml o bebé bebeu. Enquanto o temporizador conta, o botão do Hoje dá lugar a uma **faixa por cima da barra de navegação**, visível em todos os separadores, com a hora da próxima mamada e o tempo que falta; quando termina, a faixa fica em alerta e avisa (vibração e, se autorizada, notificação). Tocar na faixa abre a folha para começar a mamada seguinte ou parar. O estado fica só neste dispositivo (não entra no backup, por ser transitório).

### Registo do sono
No ecrã Hoje, por baixo da régua, a linha **Sono** tem o botão **Adormeceu**: um toque e começa a contar, sem folha nem confirmação. Enquanto o bebé dorme aparece uma **faixa por cima da barra de navegação**, em todos os separadores, com o tempo que leva e o botão **Acordou**. Um toque fecha o sono e mostra o que ficou registado.

Nenhum toque pede confirmação; em troca, tudo se desfaz:

- **Acordou por engano** — a folha que aparece tem "Ainda está a dormir", que retoma a contagem da mesma hora.
- **Adormeceu por engano** — tocar na faixa (do lado do tempo) abre a folha do sono a decorrer, com "Anular". Dois toques com menos de um minuto de intervalo nem chegam a ser registados.
- **Só te lembraste mais tarde** — na mesma folha acerta-se a hora a que adormeceu; depois de acordar, "Corrigir horas".

O ecrã do registo (`#sono`, pela linha "Sono" do Hoje) mostra:

- **Hoje** — o total desde a meia-noite e a **régua do dia** (das 0 às 24 horas, com o sono a cheio e a semente na hora atual);
- **Últimos 7 dias** — uma régua por dia, o total de cada um e a média;
- **a leitura contra a idade** — a média comparada com as horas por dia que o guia indica para a idade (capítulo Sono, "O que esperar em cada fase"). Só aparece com três dias inteiros de registos; um dia conta como inteiro quando a véspera também tem registos (o dia em que se começa a registar fica a meio);
- **Registos** — os sonos dia a dia. Tocar num abre-o para corrigir ou apagar; **Acrescentar um sono que já passou** serve para o que ficou por registar.

Como se fazem as contas: um sono que atravessa a meia-noite conta em cada dia a parte que lhe cabe, e intervalos que se sobrepõem contam uma vez só.

Os registos guardados entram no backup (são dados da família). O sono **a decorrer** não: é estado deste telemóvel, como o temporizador da mamada — quem tocou em "Adormeceu" é quem tem de tocar em "Acordou".

⚠ **As horas de referência estão em dois sítios.** A tabela "O que esperar em cada fase" de `conteudo/06-sono.md` e a constante `FAIXAS` no topo de `js/sono.js` têm de dizer o mesmo. Se mudares a tabela do guia, muda também a constante.

### Depois de qualquer alteração: subir a versão do service worker
Em `sw.js`, muda `const VERSAO = 'papaya-v1'` para `v2`, `v3`, ... É isto que faz as apps já instaladas irem buscar o conteúdo novo.

## Partilhar dados entre dispositivos

Definições → **Exportar** gera `papaya-backup-AAAA-MM-DD.json`. Envia o ficheiro para o outro dispositivo (email, mensagem...) e lá usa **Importar**:

- **Substituir** — o dispositivo fica exatamente com os dados do ficheiro;
- **Fundir** — junta os dois conjuntos (membros/tarefas por id, histórico dia a dia); em conflito ganha o ficheiro.

O ficheiro é validado antes de aplicar qualquer alteração.

O backup vai na **versão 4**, que acrescentou o registo diário (os sonos). A versão 3 tinha acrescentado o Calor da chama: configuração dos rituais, surpresas do casal e registos do que já foi feito. Ficheiros exportados nas versões **1, 2 e 3 continuam a ser aceites** — entram sem os dados que ainda não existiam. O contrário não funciona: um telemóvel com a app antiga recusa um ficheiro da versão 4, por isso atualiza a app nos dois antes de trocar ficheiros.

**Sonos registados nos dois telemóveis.** Se os dois pais registarem o mesmo sono, cada um no seu telemóvel, a fusão fica com os dois registos — não apaga nada. As contas não o contam a dobrar e a lista mostra só um (dois registos com início e fim a menos de dez minutos um do outro são o mesmo sono); corrigir ou apagar esse leva o outro atrás. Um sono apagado num telemóvel volta se depois se fundir um ficheiro antigo do outro: é o mesmo limite que os lembretes do calendário já têm.

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
