# Vozes do Trucatro

Ficha de voz de cada personagem, para gerar as falas com IA (ElevenLabs, OpenAI TTS, Google, Azure ou XTTS).

**Como usar no ElevenLabs:** vá em *Voices → Voice Design*, cole o **Prompt** do personagem, gere três opções e salve a melhor com o nome do personagem. Depois use essa voz para gerar cada fala da lista. Use o modelo multilíngue e o idioma **Português (Brasil)**.

**Ajustes:** *Estabilidade* baixa deixa a voz mais emotiva e variada; alta deixa mais constante. *Estilo* alto exagera a interpretação. Os valores abaixo são um ponto de partida (0 a 100).

**Nomes dos arquivos:** `<id>_<momento>_<n>.mp3` (exemplo: `seu_joaquim_pedir_1.mp3`). Com esse padrão eu consigo ligar os áudios no jogo depois.

**Dica geral:** gritos de truco ficam melhores com o texto em MAIÚSCULAS e ponto de exclamação. Reticências criam pausas ("Hm... sorte.").

## Resumo

| Personagem | Onde aparece | Voz | Idade | Sotaque |
|---|---|---|---|---|
| 🧔 Seu Joaquim | Mesa do Bar | masculina, grave | 68 | paulistano antigo, de imigrante português |
| 👩‍🍳 Dona Neide | Mesa do Bar | feminina, médio-agudo | 55 | paulistana da zona leste |
| 🚐 Zé da Kombi | Mesa do Bar | masculina, médio | 40 | paulistano de periferia, gírias de rua |
| 👵 Dona Lurdinha | Mesa do Bar | feminina, agudo | 78 | interior paulista suave |
| 🧑 Juninho | Mesa do Bar | masculina, claro | 21 | paulistano jovem, fala de internet |
| 👴 Seu Oswaldo | Mesa do Bar | masculina, grave | 72 | paulistano antigo |
| 🥩 Tonhão | Mesa do Bar | masculina, muito grave | 45 | paulistano da Mooca |
| 🛢️ Baixinho do Gás | Mesa do Bar | masculina, agudo | 35 | paulistano de periferia |
| 🚚 Marcão Bigode | Mesa do Fundo | masculina, grave | 52 | caipira do interior |
| 💇‍♀️ Rita Navalha | Mesa do Fundo | feminina, médio | 38 | paulistana, fala cortante |
| 📐 Professor Girafa | Mesa do Fundo | masculina, médio | 50 | paulistano formal |
| 🎩 Tião Malandragem | Mesa do Fundo | masculina, médio-grave | 45 | carioca radicado em SP |
| 🍀 Dona Zefa | Mesa do Fundo | feminina, agudo | 65 | nordestina |
| 🎤 Careca do Bingo | Mesa do Fundo | masculina, médio | 55 | paulistano |
| 💁‍♀️ Loira do Fiado | Mesa do Fundo | feminina, médio | 42 | paulistana |
| 👮 Cabo Ronaldo | Mesa do Fundo | masculina, médio-grave | 36 | paulistano |
| 🗣️ Dona Cotinha | Chefão | feminina, agudo | 70 | paulistana de vila |
| 🕶️ O Gringo | Chefão | masculina, médio | 40 | americano falando português |
| 👊 Mão de Pilão | Chefão | masculina, gravíssimo | 50 | paulistano |
| 🕵️ Delegado Nogueira | Chefão | masculina, grave | 66 | paulistano formal |
| 🕷️ Viúva Negra | Chefão | feminina, médio-grave | 60 | paulistana de salão |
| 🌙 Seu Lunático | Chefão | masculina, médio | 63 | paulistano boêmio |
| 🧶 Tia Zulmira | Chefão | feminina, agudo | 80 | interior paulista |
| 👑 Rei do Truco | Chefão | masculina, gravíssimo | ? | neutro, sem sotaque |
| ✏️ Marcador de Giz | Comparsa | masculina, médio-grave | 70 | paulistano antigo |
| 📻 Torcedor Sofredor | Comparsa | masculina, médio | 58 | paulistano da zona norte |
| 💪 Brigão da Esquina | Comparsa | masculina, grave | 34 | paulistano de periferia |
| ⚽ Técnico da Várzea | Comparsa | masculina, rouco | 55 | paulistano da zona sul |
| 🎱 Rei da Sinuca | Comparsa | masculina, grave e macio | 60 | paulistano boêmio do centro |

## Mesas do Bar

### 🧔 Seu Joaquim, dono do boteco

> Abre o boteco às seis da manhã e fecha quando o último freguês desiste. Joga truco desde que o balcão era de madeira.

- **Voz:** masculina, uns 68 anos
- **Sotaque:** paulistano antigo, de imigrante português ("ora pois" escapa às vezes)
- **Timbre:** grave, rouco de fumaça, quente
- **Jeito de falar:** calmo, paciente, ri baixinho pelo nariz; fala como quem já viu de tudo atrás do balcão
- **Ajustes:** estabilidade 55, estilo 20

**Prompt (Voice Design):**

```text
A 68-year-old Brazilian man who owns an old neighborhood bar in São Paulo. Deep, warm, slightly raspy voice with a faint Portuguese-immigrant lilt. Calm, patient, amused, speaks slowly like a grandfather telling stories. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `seu_joaquim_entrada_1.mp3` | Senta aí, freguês. A primeira é por conta da casa. |
| Entrada | `seu_joaquim_entrada_2.mp3` | Ô, chegou mais um! Vai um truquinho? |
| Pede truco | `seu_joaquim_pedir_1.mp3` | Truco, freguês! |
| Pede truco | `seu_joaquim_pedir_2.mp3` | Truco, que o boteco é meu! |
| Ganhou a rodada | `seu_joaquim_venceuVaza_1.mp3` | Essa fica no caderninho. |
| Ganhou a rodada | `seu_joaquim_venceuVaza_2.mp3` | Casa ganha! |
| Perdeu a rodada | `seu_joaquim_perdeuVaza_1.mp3` | Tá bom, tá bom... |
| Perdeu a rodada | `seu_joaquim_perdeuVaza_2.mp3` | Ô sorte! |
| Perdeu a Mesa | `seu_joaquim_derrota_1.mp3` | Pode ir, mas volta amanhã! |

### 👩‍🍳 Dona Neide, a do torresmo

> Faz o melhor torresmo do bairro e não perdoa quem joga carta errada.

- **Voz:** feminina, uns 55 anos
- **Sotaque:** paulistana da zona leste
- **Timbre:** médio-agudo, firme, voz de cozinha cheia
- **Jeito de falar:** mandona e carinhosa ao mesmo tempo; dá bronca rindo; fala alto como quem chama alguém do fogão
- **Ajustes:** estabilidade 45, estilo 35

**Prompt (Voice Design):**

```text
A 55-year-old Brazilian woman from the east side of São Paulo who runs the fried-pork-rind counter. Bright, loud, firm mid-high voice, bossy but affectionate, scolds while laughing. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `dona_neide_entrada_1.mp3` | Pega um torresmo, meu filho. Mas cuidado com a gordura nas cartas. |
| Pede truco | `dona_neide_pedir_1.mp3` | Truco, meu filho! |
| Pede truco | `dona_neide_pedir_2.mp3` | Truco! E come direito! |
| Ganhou a rodada | `dona_neide_venceuVaza_1.mp3` | Aprendeu? |
| Ganhou a rodada | `dona_neide_venceuVaza_2.mp3` | Essa é da Neide. |
| Perdeu a rodada | `dona_neide_perdeuVaza_1.mp3` | Ai, meu Deus. |
| Perdeu a rodada | `dona_neide_perdeuVaza_2.mp3` | Hmm, tá esperto hoje. |
| Perdeu a Mesa | `dona_neide_derrota_1.mp3` | Leva um torresmo pra viagem. |

### 🚐 Zé da Kombi, motorista de lotação

> Só tem quinze minutos de almoço e quer resolver o truco antes de a Kombi sair.

- **Voz:** masculina, uns 40 anos
- **Sotaque:** paulistano de periferia, gírias de rua
- **Timbre:** médio, meio anasalado
- **Jeito de falar:** apressado, atropela as palavras, sempre olhando o relógio; fala rápido e corta as frases
- **Ajustes:** estabilidade 40, estilo 40

**Prompt (Voice Design):**

```text
A 40-year-old Brazilian van driver from the outskirts of São Paulo, always in a hurry. Medium, slightly nasal voice, speaks very fast, clipped and impatient, street slang. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `ze_da_kombi_entrada_1.mp3` | Rapidinho que a Kombi sai às duas! |
| Pede truco | `ze_da_kombi_pedir_1.mp3` | Truco, rapidinho! |
| Pede truco | `ze_da_kombi_pedir_2.mp3` | Truco, que eu tô com pressa! |
| Ganhou a rodada | `ze_da_kombi_venceuVaza_1.mp3` | Próxima parada! |
| Ganhou a rodada | `ze_da_kombi_venceuVaza_2.mp3` | Pagou a passagem. |
| Perdeu a rodada | `ze_da_kombi_perdeuVaza_1.mp3` | Perdi o ponto... |
| Perdeu a rodada | `ze_da_kombi_perdeuVaza_2.mp3` | Eita, buraco na pista. |
| Perdeu a Mesa | `ze_da_kombi_derrota_1.mp3` | Vou nessa, a Kombi tá buzinando! |

### 👵 Dona Lurdinha, aposentada distraída

> Esquece os óculos em casa e segura as cartas viradas pra mesa sem perceber.

- **Voz:** feminina, uns 78 anos
- **Sotaque:** interior paulista suave
- **Timbre:** agudo, fininho, tremido
- **Jeito de falar:** doce e distraída; se perde no meio da frase, faz pausas, ri sem graça
- **Ajustes:** estabilidade 50, estilo 30

**Prompt (Voice Design):**

```text
A 78-year-old sweet, absent-minded Brazilian grandmother. High, thin, slightly shaky voice, gentle and confused, trails off mid-sentence and giggles. Brazilian Portuguese, soft countryside accent.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `dona_lurdinha_entrada_1.mp3` | Ai, cadê meus óculos? Senta, querido. |
| Pede truco | `dona_lurdinha_pedir_1.mp3` | Truco... é assim que fala? |
| Pede truco | `dona_lurdinha_pedir_2.mp3` | Truco, viu! |
| Ganhou a rodada | `dona_lurdinha_venceuVaza_1.mp3` | Olha só, ganhei! |
| Ganhou a rodada | `dona_lurdinha_venceuVaza_2.mp3` | Hihi. |
| Perdeu a rodada | `dona_lurdinha_perdeuVaza_1.mp3` | Ué, essa não era boa? |
| Perdeu a rodada | `dona_lurdinha_perdeuVaza_2.mp3` | Ai, ai. |
| Perdeu a Mesa | `dona_lurdinha_derrota_1.mp3` | Volta domingo, que tem bolo. |

### 🧑 Juninho, estagiário empolgado

> Aprendeu truco num vídeo e pede truco em toda mão. Corre na primeira cara feia.

- **Voz:** masculina, uns 21 anos
- **Sotaque:** paulistano jovem, fala de internet
- **Timbre:** claro, juvenil, meio agudo
- **Jeito de falar:** empolgadíssimo, exagerado, tudo é "mano", "brabo", "é tetra"; quando perde, a voz murcha na hora
- **Ajustes:** estabilidade 30, estilo 60

**Prompt (Voice Design):**

```text
A 21-year-old Brazilian intern, hyper-excited gamer type. Bright, youthful, slightly high voice, over-the-top enthusiasm, internet slang, voice cracks when nervous. Brazilian Portuguese, São Paulo accent.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `juninho_entrada_1.mp3` | Bora, bora! Eu vi um vídeo, tô preparado! |
| Pede truco | `juninho_pedir_1.mp3` | TRUCO!! Hehe. |
| Pede truco | `juninho_pedir_2.mp3` | Truco, mano! |
| Pede truco | `juninho_pedir_3.mp3` | Truco, truco, truco! |
| Aumenta | `juninho_aumentar_1.mp3` | SEIS! Acho que é assim. |
| Corre | `juninho_correr_1.mp3` | Ixi, corri. |
| Corre | `juninho_correr_2.mp3` | Tô fora, tô fora! |
| Ganhou a rodada | `juninho_venceuVaza_1.mp3` | Isso! Tutorial funcionou! |
| Perdeu a rodada | `juninho_perdeuVaza_1.mp3` | Pera, como assim? |
| Perdeu a Mesa | `juninho_derrota_1.mp3` | Vou ver mais vídeo e volto. |

### 👴 Seu Oswaldo, rei do dominó

> Prefere dominó, mas aceita um truco enquanto a turma não chega. Deixa você embaralhar à vontade.

- **Voz:** masculina, uns 72 anos
- **Sotaque:** paulistano antigo
- **Timbre:** grave, arrastado, sonolento
- **Jeito de falar:** tranquilo demais, fala devagar, suspira, sempre comparando com o dominó
- **Ajustes:** estabilidade 65, estilo 15

**Prompt (Voice Design):**

```text
A 72-year-old Brazilian retiree who prefers dominoes. Low, slow, drowsy voice, very relaxed, sighs between sentences, mildly grumpy but kind. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `seu_oswaldo_entrada_1.mp3` | Enquanto a turma do dominó não chega, vamo nessa. |
| Pede truco | `seu_oswaldo_pedir_1.mp3` | Truco. Bati! |
| Pede truco | `seu_oswaldo_pedir_2.mp3` | Truco, rapaz. |
| Ganhou a rodada | `seu_oswaldo_venceuVaza_1.mp3` | Carroça! |
| Ganhou a rodada | `seu_oswaldo_venceuVaza_2.mp3` | Pedra boa. |
| Perdeu a rodada | `seu_oswaldo_perdeuVaza_1.mp3` | Passo. |
| Perdeu a rodada | `seu_oswaldo_perdeuVaza_2.mp3` | Hum. |
| Perdeu a Mesa | `seu_oswaldo_derrota_1.mp3` | Amanhã é dominó, viu? |

### 🥩 Tonhão, o do açougue

> Bate a carta na mesa com tanta força que a mão já começa valendo truco.

- **Voz:** masculina, uns 45 anos
- **Sotaque:** paulistano da Mooca
- **Timbre:** muito grave, encorpado, peito
- **Jeito de falar:** bruto e simpático; fala alto e curto, bate a mão na mesa quando fala
- **Ajustes:** estabilidade 45, estilo 45

**Prompt (Voice Design):**

```text
A 45-year-old big Brazilian butcher from Mooca, São Paulo. Very deep, booming chest voice, loud and blunt but friendly, short punchy sentences. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `tonhao_entrada_1.mp3` | Aqui é tudo no peso, parceiro. |
| Pede truco | `tonhao_pedir_1.mp3` | SEIS NA CARA! |
| Pede truco | `tonhao_pedir_2.mp3` | Pesa a mão aí! |
| Ganhou a rodada | `tonhao_venceuVaza_1.mp3` | Picadinho! |
| Ganhou a rodada | `tonhao_venceuVaza_2.mp3` | Na faca! |
| Perdeu a rodada | `tonhao_perdeuVaza_1.mp3` | Grrr. |
| Perdeu a rodada | `tonhao_perdeuVaza_2.mp3` | Osso duro. |
| Perdeu a Mesa | `tonhao_derrota_1.mp3` | Leva um quilo de alcatra, campeão. |

### 🛢️ Baixinho do Gás, entregador de gás

> Chega tocando a musiquinha do caminhão e aposta o troco do botijão.

- **Voz:** masculina, uns 35 anos
- **Sotaque:** paulistano de periferia
- **Timbre:** agudo, esganiçado, ligeiro
- **Jeito de falar:** brincalhão e elétrico; cantarola a musiquinha do caminhão de gás, ri alto
- **Ajustes:** estabilidade 35, estilo 55

**Prompt (Voice Design):**

```text
A 35-year-old short, wiry Brazilian gas-cylinder delivery man. High, squeaky, quick voice, playful and energetic, hums jingles and laughs loudly. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `baixinho_do_gas_entrada_1.mp3` | Ó o gás! Bora um truco rapidinho? |
| Pede truco | `baixinho_do_gas_pedir_1.mp3` | Truco, ó o gás! |
| Pede truco | `baixinho_do_gas_pedir_2.mp3` | Truco, que o botijão tá cheio! |
| Ganhou a rodada | `baixinho_do_gas_venceuVaza_1.mp3` | Entregue! |
| Ganhou a rodada | `baixinho_do_gas_venceuVaza_2.mp3` | Tá na mão. |
| Perdeu a rodada | `baixinho_do_gas_perdeuVaza_1.mp3` | Vazou... |
| Perdeu a rodada | `baixinho_do_gas_perdeuVaza_2.mp3` | Eita. |
| Perdeu a Mesa | `baixinho_do_gas_derrota_1.mp3` | Toma o troco, freguês. |

## Mesas do Fundo

### 🚚 Marcão Bigode, caminhoneiro

> Atravessou o país três vezes e jura que nunca perdeu um truco num posto de gasolina.

- **Voz:** masculina, uns 52 anos
- **Sotaque:** caipira do interior (r puxado)
- **Timbre:** grave, rouco de estrada
- **Jeito de falar:** contador de causo, fala arrastada e orgulhosa, sempre "lá em Goiás..."
- **Ajustes:** estabilidade 50, estilo 35

**Prompt (Voice Design):**

```text
A 52-year-old Brazilian truck driver with a thick countryside "caipira" accent and rolled r sounds. Deep, gravelly road-worn voice, proud storyteller, drawls his words. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `marcao_bigode_entrada_1.mp3` | Senta, que a estrada é longa. |
| Pede truco | `marcao_bigode_pedir_1.mp3` | Truco, na banguela! |
| Pede truco | `marcao_bigode_pedir_2.mp3` | Truco, piloto! |
| Ganhou a rodada | `marcao_bigode_venceuVaza_1.mp3` | Pé na tábua! |
| Ganhou a rodada | `marcao_bigode_venceuVaza_2.mp3` | Ultrapassei. |
| Perdeu a rodada | `marcao_bigode_perdeuVaza_1.mp3` | Pneu furado. |
| Perdeu a rodada | `marcao_bigode_perdeuVaza_2.mp3` | Freio de mão... |
| Perdeu a Mesa | `marcao_bigode_derrota_1.mp3` | Boa viagem, piloto. |

### 💇‍♀️ Rita Navalha, cabeleireira

> Corta cabelo, corta conversa e corta suas trocas.

- **Voz:** feminina, uns 38 anos
- **Sotaque:** paulistana, fala cortante
- **Timbre:** médio, seco, afiado
- **Jeito de falar:** irônica e rápida, responde com uma frase só, sorriso de canto na voz
- **Ajustes:** estabilidade 45, estilo 45

**Prompt (Voice Design):**

```text
A 38-year-old sharp-tongued Brazilian hairdresser. Medium, dry, crisp voice, sarcastic and fast, delivers one-liners with a smirk. Brazilian Portuguese, São Paulo accent.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `rita_navalha_entrada_1.mp3` | Senta na cadeira, que hoje é corte rente. |
| Pede truco | `rita_navalha_pedir_1.mp3` | Truco, querido! |
| Pede truco | `rita_navalha_pedir_2.mp3` | Truco, e não reclama. |
| Ganhou a rodada | `rita_navalha_venceuVaza_1.mp3` | Tesourada! |
| Ganhou a rodada | `rita_navalha_venceuVaza_2.mp3` | Ficou lindo. |
| Perdeu a rodada | `rita_navalha_perdeuVaza_1.mp3` | Hum, desfiou. |
| Perdeu a rodada | `rita_navalha_perdeuVaza_2.mp3` | Ah, é? |
| Perdeu a Mesa | `rita_navalha_derrota_1.mp3` | Volta pra fazer a escova. |

### 📐 Professor Girafa, professor de matemática

> Calcula probabilidade de cabeça e só pede truco quando tem certeza.

- **Voz:** masculina, uns 50 anos
- **Sotaque:** paulistano formal
- **Timbre:** médio, nasal, professoral
- **Jeito de falar:** didático e pedante; pronuncia tudo certinho, cita porcentagens, pigarreia antes de falar
- **Ajustes:** estabilidade 60, estilo 25

**Prompt (Voice Design):**

```text
A 50-year-old Brazilian math teacher, tall and lanky. Medium nasal voice, precise and pedantic diction, lectures with percentages, clears throat before speaking. Brazilian Portuguese, formal.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `professor_girafa_entrada_1.mp3` | Vamos à prova. Sem cola. |
| Pede truco | `professor_girafa_pedir_1.mp3` | Truco. Matematicamente. |
| Pede truco | `professor_girafa_pedir_2.mp3` | Truco: probabilidade a meu favor. |
| Ganhou a rodada | `professor_girafa_venceuVaza_1.mp3` | Como previsto. |
| Ganhou a rodada | `professor_girafa_venceuVaza_2.mp3` | Q.E.D. |
| Perdeu a rodada | `professor_girafa_perdeuVaza_1.mp3` | Erro de arredondamento. |
| Perdeu a rodada | `professor_girafa_perdeuVaza_2.mp3` | Interessante... |
| Perdeu a Mesa | `professor_girafa_derrota_1.mp3` | Nota dez. Aprovado. |

### 🎩 Tião Malandragem, malandro de chapéu

> Nunca correu de um truco na vida. Nem quando devia.

- **Voz:** masculina, uns 45 anos
- **Sotaque:** carioca radicado em SP (s chiado)
- **Timbre:** médio-grave, malemolente
- **Jeito de falar:** malandro boa-praça, fala cantado, cheio de ginga, nunca demonstra medo
- **Ajustes:** estabilidade 40, estilo 50

**Prompt (Voice Design):**

```text
A 45-year-old Brazilian street-smart rascal with a Rio de Janeiro accent (hissing s sounds). Smooth, sing-song, laid-back mid-low voice, charming and cocky. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `tiao_malandragem_entrada_1.mp3` | Malandro que é malandro não corre. |
| Pede truco | `tiao_malandragem_pedir_1.mp3` | Truco, otário! |
| Pede truco | `tiao_malandragem_pedir_2.mp3` | Truco, meu chapa. |
| Aceita | `tiao_malandragem_aceitar_1.mp3` | Desce, que malandro não corre. |
| Aceita | `tiao_malandragem_aceitar_2.mp3` | Vem! |
| Ganhou a rodada | `tiao_malandragem_venceuVaza_1.mp3` | Malandragem pura. |
| Ganhou a rodada | `tiao_malandragem_venceuVaza_2.mp3` | Hehe, aprendeu. |
| Perdeu a rodada | `tiao_malandragem_perdeuVaza_1.mp3` | Foi sorte. |
| Perdeu a rodada | `tiao_malandragem_perdeuVaza_2.mp3` | Tranquilo. |
| Perdeu a Mesa | `tiao_malandragem_derrota_1.mp3` | Hoje não foi meu dia, parceiro. |

### 🍀 Dona Zefa, pé-quente da quermesse

> Ganha todo bingo da quermesse. Diz que ouro atrai ouro.

- **Voz:** feminina, uns 65 anos
- **Sotaque:** nordestina (pernambucana) que mora em SP
- **Timbre:** agudo, cantado, alegre
- **Jeito de falar:** supersticiosa e animada, benze tudo, solta "oxe" e "visse"
- **Ajustes:** estabilidade 40, estilo 50

**Prompt (Voice Design):**

```text
A 65-year-old cheerful Brazilian woman from Pernambuco living in São Paulo. High, melodic, sing-song northeastern accent, superstitious and lively, says "oxe". Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `dona_zefa_entrada_1.mp3` | Bate na madeira e senta. |
| Pede truco | `dona_zefa_pedir_1.mp3` | Truco, que hoje eu tô com sorte! |
| Pede truco | `dona_zefa_pedir_2.mp3` | Truco, cruz-credo! |
| Ganhou a rodada | `dona_zefa_venceuVaza_1.mp3` | Pé-quente! |
| Ganhou a rodada | `dona_zefa_venceuVaza_2.mp3` | Bingo! |
| Perdeu a rodada | `dona_zefa_perdeuVaza_1.mp3` | Bate na madeira. |
| Perdeu a rodada | `dona_zefa_perdeuVaza_2.mp3` | Vixe. |
| Perdeu a Mesa | `dona_zefa_derrota_1.mp3` | Leva meu trevo, você precisa mais. |

### 🎤 Careca do Bingo, locutor do bingo

> Canta as pedras do bingo e acha mão de onze coisa de amador.

- **Voz:** masculina, uns 55 anos
- **Sotaque:** paulistano
- **Timbre:** médio, projetado, voz de locutor
- **Jeito de falar:** anuncia tudo como pedra de bingo, eco de alto-falante, exagerado e teatral
- **Ajustes:** estabilidade 35, estilo 60

**Prompt (Voice Design):**

```text
A 55-year-old Brazilian bingo announcer. Projected, booming radio-announcer voice, theatrical, announces everything like calling bingo numbers. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `careca_do_bingo_entrada_1.mp3` | Atenção, pedra cantada: começou o truco! |
| Pede truco | `careca_do_bingo_pedir_1.mp3` | Truco! Pedra B-cinco! |
| Pede truco | `careca_do_bingo_pedir_2.mp3` | Truco na cartela! |
| Ganhou a rodada | `careca_do_bingo_venceuVaza_1.mp3` | Linha! |
| Ganhou a rodada | `careca_do_bingo_venceuVaza_2.mp3` | Pedra boa! |
| Perdeu a rodada | `careca_do_bingo_perdeuVaza_1.mp3` | Pedra torta. |
| Perdeu a rodada | `careca_do_bingo_perdeuVaza_2.mp3` | Cadê minha cartela? |
| Perdeu a Mesa | `careca_do_bingo_derrota_1.mp3` | Bingo pra você, campeão. |

### 💁‍♀️ Loira do Fiado, cobradora do bairro

> Sabe quanto cada um deve no bairro, até os centavos.

- **Voz:** feminina, uns 42 anos
- **Sotaque:** paulistana
- **Timbre:** médio, doce por fora e frio por dentro
- **Jeito de falar:** cobradora educada e implacável; fala devagar e anota tudo
- **Ajustes:** estabilidade 55, estilo 30

**Prompt (Voice Design):**

```text
A 42-year-old Brazilian woman who collects neighborhood debts. Medium, sweet-sounding but icy voice, polite and relentless, speaks slowly and precisely about money. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `loira_do_fiado_entrada_1.mp3` | Antes de tudo: cadê os dois réis que você me deve? |
| Pede truco | `loira_do_fiado_pedir_1.mp3` | Truco, e anota aí. |
| Pede truco | `loira_do_fiado_pedir_2.mp3` | Truco, devedor! |
| Ganhou a rodada | `loira_do_fiado_venceuVaza_1.mp3` | Tá na conta. |
| Ganhou a rodada | `loira_do_fiado_venceuVaza_2.mp3` | Pago à vista! |
| Perdeu a rodada | `loira_do_fiado_perdeuVaza_1.mp3` | Vou cobrar isso. |
| Perdeu a rodada | `loira_do_fiado_perdeuVaza_2.mp3` | Tá devendo. |
| Perdeu a Mesa | `loira_do_fiado_derrota_1.mp3` | Toma o troco. Mas volta, hein? |

### 👮 Cabo Ronaldo, policial de folga

> De folga, mas não larga a mania de revistar as cartas de Espadas.

- **Voz:** masculina, uns 36 anos
- **Sotaque:** paulistano
- **Timbre:** médio-grave, firme, militar
- **Jeito de falar:** fala em tom de ordem mesmo de folga, frases curtas, desconfiado
- **Ajustes:** estabilidade 55, estilo 35

**Prompt (Voice Design):**

```text
A 36-year-old off-duty Brazilian police corporal. Firm, mid-low, commanding voice, short orders, suspicious tone even when relaxed. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `cabo_ronaldo_entrada_1.mp3` | Documento e baralho, por favor. |
| Pede truco | `cabo_ronaldo_pedir_1.mp3` | Truco! Mão na cabeça! |
| Pede truco | `cabo_ronaldo_pedir_2.mp3` | Truco, é uma abordagem. |
| Ganhou a rodada | `cabo_ronaldo_venceuVaza_1.mp3` | Apreendida. |
| Ganhou a rodada | `cabo_ronaldo_venceuVaza_2.mp3` | Teje preso! |
| Perdeu a rodada | `cabo_ronaldo_perdeuVaza_1.mp3` | Liberado... por enquanto. |
| Perdeu a rodada | `cabo_ronaldo_perdeuVaza_2.mp3` | Hmm. |
| Perdeu a Mesa | `cabo_ronaldo_derrota_1.mp3` | Pode circular, cidadão. |

## Chefões

### 🗣️ Dona Cotinha, a fofoqueira da vila

> Sabe da vida de todo mundo e não tem coração para ninguém.

- **Voz:** feminina, uns 70 anos
- **Sotaque:** paulistana de vila
- **Timbre:** agudo, cochichado, venenoso
- **Jeito de falar:** fofoqueira: alterna cochicho e escândalo; voz doce que esconde maldade
- **Ajustes:** estabilidade 35, estilo 65

**Prompt (Voice Design):**

```text
A 70-year-old Brazilian village gossip. High, whispery, sugary-sweet voice that hides malice, switches between hushed whispers and dramatic gasps. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `dona_cotinha_entrada_1.mp3` | Hmm, então você que é o tal? Já ouvi falar... |
| Pede truco | `dona_cotinha_pedir_1.mp3` | Truco! E todo mundo vai ficar sabendo. |
| Pede truco | `dona_cotinha_pedir_2.mp3` | Truco, fofura. |
| Ganhou a rodada | `dona_cotinha_venceuVaza_1.mp3` | Vou contar pra vila inteira! |
| Ganhou a rodada | `dona_cotinha_venceuVaza_2.mp3` | Hihihi. |
| Perdeu a rodada | `dona_cotinha_perdeuVaza_1.mp3` | Isso não vai sair daqui, ouviu? |
| Perdeu a rodada | `dona_cotinha_perdeuVaza_2.mp3` | Hunf! |
| Perdeu a Mesa | `dona_cotinha_derrota_1.mp3` | Amanhã a vila toda vai saber... que você ganhou. |
| Cena de entrada | `dona_cotinha_intro_1.mp3` | A vila inteira já sabe que você tá ganhando de todo mundo. |
| Cena de entrada | `dona_cotinha_intro_2.mp3` | Sabe como eu sei? Eu sei de tudo, meu filho. |
| Cena de entrada | `dona_cotinha_intro_3.mp3` | Senta aí. Quero ver se é verdade o que andam falando. |

### 🕶️ O Gringo, turista que aprendeu ontem (será?)

> Diz que é a primeira vez que joga. Ninguém acredita.

- **Voz:** masculina, uns 40 anos
- **Sotaque:** americano falando português (mistura inglês)
- **Timbre:** médio, simpático, sotaque forte
- **Jeito de falar:** finge inocência, erra o gênero das palavras de propósito, mas na hora do truco fica frio
- **Ajustes:** estabilidade 45, estilo 45

**Prompt (Voice Design):**

```text
A 40-year-old American tourist speaking Brazilian Portuguese with a strong English accent, mixing English words. Friendly, mid voice, fake-innocent, turns cold and calculating at key moments.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `o_gringo_entrada_1.mp3` | Hello, friend! Truco é... como joga mesmo? |
| Pede truco | `o_gringo_pedir_1.mp3` | Truco, my friend! |
| Pede truco | `o_gringo_pedir_2.mp3` | Tru-co! Is right? |
| Ganhou a rodada | `o_gringo_venceuVaza_1.mp3` | Oh, beginner's luck! |
| Ganhou a rodada | `o_gringo_venceuVaza_2.mp3` | Very nice! |
| Perdeu a rodada | `o_gringo_perdeuVaza_1.mp3` | Oh no! |
| Perdeu a rodada | `o_gringo_perdeuVaza_2.mp3` | Hmm, interesting. |
| Perdeu a Mesa | `o_gringo_derrota_1.mp3` | Okay, okay. You are the king of truco! |
| Cena de entrada | `o_gringo_intro_1.mp3` | Hello, amigo! Eu aprendi esse jogo ontem, very fácil. |
| Cena de entrada | `o_gringo_intro_2.mp3` | Truco... é quando grita, right? |
| Cena de entrada | `o_gringo_intro_3.mp3` | Vamos ver quem é o turista aqui. |

### 👊 Mão de Pilão, ex-lutador de telecatch

> Quebrou a última mesa em que alguém gritou truco. Desde então, ninguém grita.

- **Voz:** masculina, uns 50 anos
- **Sotaque:** paulistano
- **Timbre:** gravíssimo, rouco, enorme
- **Jeito de falar:** ex-lutador de telecatch: fala como anúncio de luta, rosna, ri com eco
- **Ajustes:** estabilidade 40, estilo 70

**Prompt (Voice Design):**

```text
A 50-year-old former Brazilian pro-wrestler. Extremely deep, gravelly, huge voice, growls, speaks like a wrestling promo, booming laugh. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `mao_de_pilao_entrada_1.mp3` | Aqui ninguém grita truco. Entendeu? |
| Ganhou a rodada | `mao_de_pilao_venceuVaza_1.mp3` | PÁ! |
| Ganhou a rodada | `mao_de_pilao_venceuVaza_2.mp3` | Nocaute. |
| Perdeu a rodada | `mao_de_pilao_perdeuVaza_1.mp3` | Grrr... |
| Perdeu a rodada | `mao_de_pilao_perdeuVaza_2.mp3` | Tá me provocando? |
| Perdeu a Mesa | `mao_de_pilao_derrota_1.mp3` | Respeito. Pode ir. |
| Cena de entrada | `mao_de_pilao_intro_1.mp3` | Vinte anos de telecatch. Nunca caí na lona. |
| Cena de entrada | `mao_de_pilao_intro_2.mp3` | Essa mesa aqui já quebrou três vezes. Comigo batendo carta. |
| Cena de entrada | `mao_de_pilao_intro_3.mp3` | Pode pedir truco. Eu gosto de barulho. |

### 🕵️ Delegado Nogueira, delegado aposentado

> Aposentou o distintivo, mas não a desconfiança de quem tem manilha demais.

- **Voz:** masculina, uns 66 anos
- **Sotaque:** paulistano formal
- **Timbre:** grave, seco, autoritário
- **Jeito de falar:** interrogador: frases lentas, pausas longas, ironia gelada
- **Ajustes:** estabilidade 65, estilo 30

**Prompt (Voice Design):**

```text
A 66-year-old retired Brazilian police chief. Deep, dry, authoritative voice, speaks slowly like an interrogation, long pauses, icy irony. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `delegado_nogueira_entrada_1.mp3` | Sente-se. Isso é só uma conversa. |
| Pede truco | `delegado_nogueira_pedir_1.mp3` | Truco. Pode confessar. |
| Pede truco | `delegado_nogueira_pedir_2.mp3` | Truco, suspeito. |
| Ganhou a rodada | `delegado_nogueira_venceuVaza_1.mp3` | Caso encerrado. |
| Ganhou a rodada | `delegado_nogueira_venceuVaza_2.mp3` | Flagrante. |
| Perdeu a rodada | `delegado_nogueira_perdeuVaza_1.mp3` | Vou investigar isso. |
| Perdeu a rodada | `delegado_nogueira_perdeuVaza_2.mp3` | Suspeito... |
| Perdeu a Mesa | `delegado_nogueira_derrota_1.mp3` | Está liberado. Por falta de provas. |
| Cena de entrada | `delegado_nogueira_intro_1.mp3` | Boa noite. Documento, por favor. |
| Cena de entrada | `delegado_nogueira_intro_2.mp3` | Brincadeira. Mas eu tô de olho em cada carta que você joga. |
| Cena de entrada | `delegado_nogueira_intro_3.mp3` | Nessa mesa não tem malandragem. Só tem eu. |

### 🕷️ Viúva Negra, dona do salão de festas

> Três maridos, três salões de festa e nenhuma derrota no truco.

- **Voz:** feminina, uns 60 anos
- **Sotaque:** paulistana de salão
- **Timbre:** médio-grave, aveludado, sedutor
- **Jeito de falar:** elegante e ameaçadora, fala baixinho e arrasta as vogais, risada curta
- **Ajustes:** estabilidade 55, estilo 50

**Prompt (Voice Design):**

```text
A 60-year-old elegant Brazilian widow who owns a party hall. Velvety, low, seductive and menacing voice, speaks softly and drawls vowels, short cold laugh. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `viuva_negra_entrada_1.mp3` | Que gracinha. Senta, querido. |
| Pede truco | `viuva_negra_pedir_1.mp3` | Truco, meu bem. |
| Pede truco | `viuva_negra_pedir_2.mp3` | Truco. Vai correr? |
| Ganhou a rodada | `viuva_negra_venceuVaza_1.mp3` | Que pena pra você. |
| Ganhou a rodada | `viuva_negra_venceuVaza_2.mp3` | Mais um pra coleção. |
| Perdeu a rodada | `viuva_negra_perdeuVaza_1.mp3` | Hm. Atrevido. |
| Perdeu a rodada | `viuva_negra_perdeuVaza_2.mp3` | Interessante. |
| Perdeu a Mesa | `viuva_negra_derrota_1.mp3` | Você é diferente dos outros... |
| Cena de entrada | `viuva_negra_intro_1.mp3` | Bem-vindo ao meu salão, querido. |
| Cena de entrada | `viuva_negra_intro_2.mp3` | Os últimos três que sentaram aí... nunca mais jogaram truco. |
| Cena de entrada | `viuva_negra_intro_3.mp3` | Fica à vontade. Vai ser a sua última festa. |

### 🌙 Seu Lunático, astrólogo da praça

> Lê o futuro nas cartas, de cabeça para baixo.

- **Voz:** masculina, uns 63 anos
- **Sotaque:** paulistano boêmio
- **Timbre:** médio, etéreo, sonhador
- **Jeito de falar:** místico: fala devagar como quem lê o horóscopo, sussurra previsões, ri sozinho
- **Ajustes:** estabilidade 40, estilo 55

**Prompt (Voice Design):**

```text
A 63-year-old Brazilian street astrologer. Airy, dreamy, mid voice, mystical and slow like reading a horoscope, whispers predictions, chuckles to himself. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `seu_lunatico_entrada_1.mp3` | Mercúrio está retrógrado. As cartas também. |
| Pede truco | `seu_lunatico_pedir_1.mp3` | Truco! Os astros mandaram. |
| Pede truco | `seu_lunatico_pedir_2.mp3` | Truco, sob a lua cheia! |
| Ganhou a rodada | `seu_lunatico_venceuVaza_1.mp3` | Estava escrito. |
| Ganhou a rodada | `seu_lunatico_venceuVaza_2.mp3` | As estrelas não mentem. |
| Perdeu a rodada | `seu_lunatico_perdeuVaza_1.mp3` | Lua em Escorpião... |
| Perdeu a rodada | `seu_lunatico_perdeuVaza_2.mp3` | Hmm, eclipse. |
| Perdeu a Mesa | `seu_lunatico_derrota_1.mp3` | Seu signo venceu hoje. |
| Cena de entrada | `seu_lunatico_intro_1.mp3` | Mercúrio está retrógrado. Péssimo dia pra você. |
| Cena de entrada | `seu_lunatico_intro_2.mp3` | As estrelas me contaram cada carta da sua mão. |
| Cena de entrada | `seu_lunatico_intro_3.mp3` | Mas pode jogar. O destino já está escrito. |

### 🧶 Tia Zulmira, tricoteira implacável

> Tricota durante o jogo inteiro e não deixa ninguém mexer nas cartas.

- **Voz:** feminina, uns 80 anos
- **Sotaque:** interior paulista
- **Timbre:** agudo, firme, de vó brava
- **Jeito de falar:** vovó implacável: doce na primeira frase, ríspida na segunda; conta os pontos do tricô em voz alta
- **Ajustes:** estabilidade 50, estilo 45

**Prompt (Voice Design):**

```text
An 80-year-old stern Brazilian grandma who knits nonstop. High but firm voice, sweet in one sentence and sharp in the next, counts knitting stitches out loud. Brazilian Portuguese, countryside accent.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `tia_zulmira_entrada_1.mp3` | Carta que veio, fica. Não mexe, menino. |
| Pede truco | `tia_zulmira_pedir_1.mp3` | Truco, e não me desconcentra. |
| Pede truco | `tia_zulmira_pedir_2.mp3` | Truco. Ponto, laçada, truco. |
| Ganhou a rodada | `tia_zulmira_venceuVaza_1.mp3` | Mais uma carreira. |
| Ganhou a rodada | `tia_zulmira_venceuVaza_2.mp3` | Hm-hm. |
| Perdeu a rodada | `tia_zulmira_perdeuVaza_1.mp3` | Perdi o ponto do tricô... |
| Perdeu a rodada | `tia_zulmira_perdeuVaza_2.mp3` | Ai, ai. |
| Perdeu a Mesa | `tia_zulmira_derrota_1.mp3` | Toma, fiz um cachecol pra você. |
| Cena de entrada | `tia_zulmira_intro_1.mp3` | Senta, menino. Quer um bolinho? Não? Melhor. |
| Cena de entrada | `tia_zulmira_intro_2.mp3` | Eu tricoto e jogo ao mesmo tempo há cinquenta anos. |
| Cena de entrada | `tia_zulmira_intro_3.mp3` | Cada ponto que eu dou, você perde um. |

### 👑 Rei do Truco, o big boss: dono de todos os botecos

> Ninguém sabe o nome verdadeiro dele. Só que nunca perdeu uma partida.

- **Voz:** masculina, idade desconhecida
- **Sotaque:** neutro, sem sotaque (ninguém sabe de onde ele é)
- **Timbre:** gravíssimo, profundo, com reverberação
- **Jeito de falar:** o big boss: calmo, lento, cada palavra pesa; nunca grita, a não ser no TRUCO
- **Ajustes:** estabilidade 70, estilo 40

**Prompt (Voice Design):**

```text
A mysterious Brazilian crime-boss figure, age unknown. Very deep, resonant, slow and calm voice with natural reverb, every word heavy and menacing, never shouts except when calling truco. Brazilian Portuguese, neutral accent.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Entrada | `rei_do_truco_entrada_1.mp3` | Então você chegou até aqui. Senta. Vai ser rápido. |
| Pede truco | `rei_do_truco_pedir_1.mp3` | TRUCO. Ajoelha. |
| Pede truco | `rei_do_truco_pedir_2.mp3` | Truco, plebeu. |
| Aumenta | `rei_do_truco_aumentar_1.mp3` | DOZE. Sempre doze. |
| Aumenta | `rei_do_truco_aumentar_2.mp3` | Aumenta. O trono é meu. |
| Ganhou a rodada | `rei_do_truco_venceuVaza_1.mp3` | Como sempre. |
| Ganhou a rodada | `rei_do_truco_venceuVaza_2.mp3` | Previsível. |
| Perdeu a rodada | `rei_do_truco_perdeuVaza_1.mp3` | Hm. Sorte. |
| Perdeu a rodada | `rei_do_truco_perdeuVaza_2.mp3` | Isso não se repete. |
| Perdeu a Mesa | `rei_do_truco_derrota_1.mp3` | O trono é seu. Por enquanto. |
| Cena de entrada | `rei_do_truco_intro_1.mp3` | Oito bairros. Oito botecos. Todos são meus. |
| Cena de entrada | `rei_do_truco_intro_2.mp3` | Ninguém nunca chegou até a minha mesa. |
| Cena de entrada | `rei_do_truco_intro_3.mp3` | Ajoelha, pega suas cartas... e reza. |

## Comparsas

Os Comparsas falam uma vez quando disparam e dão pontos (balão saindo do slot). As falas ficam em `data/falas-comparsas.json`; o jogo sorteia uma. Arquivos: `<id>_dispara_<n>.mp3`.

### ✏️ Marcador de Giz, o homem da lousa que conta os tentos

> Fica de pé do lado da lousa do boteco desde os anos 70, com um toco de giz atrás da orelha. Nunca errou uma conta.

- **Voz:** masculina, uns 70 anos
- **Sotaque:** paulistano antigo
- **Timbre:** médio-grave, seco, um pouco anasalado
- **Jeito de falar:** metódico e satisfeito, fala como quem anota; pausa curta antes de dar o veredito
- **Ajustes:** estabilidade 60, estilo 25

**Prompt (Voice Design):**

```text
A 70-year-old Brazilian man who keeps score on a chalkboard in an old São Paulo bar. Dry, slightly nasal mid-low voice, precise and methodical, quietly pleased with himself, like an old bookkeeper announcing a tally. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Dispara | `marcador_de_giz_dispara_1.mp3` | Risquei mais um aqui na lousa! |
| Dispara | `marcador_de_giz_dispara_2.mp3` | Anotado. Quem conta não erra. |
| Dispara | `marcador_de_giz_dispara_3.mp3` | Cada tento dele vira giz pra você! |
| Dispara | `marcador_de_giz_dispara_4.mp3` | Tá na lousa, tá valendo! |

### 📻 Torcedor Sofredor, o do radinho de pilha

> Radinho colado na orelha, camisa do time desbotada. Sofre o jogo inteiro e comemora como final de campeonato.

- **Voz:** masculina, uns 58 anos
- **Sotaque:** paulistano da zona norte
- **Timbre:** médio, sobe para o agudo quando grita
- **Jeito de falar:** aflito, suspira, e de repente explode de alegria; gritos de gol nas palavras fortes
- **Ajustes:** estabilidade 25, estilo 70

**Prompt (Voice Design):**

```text
A 58-year-old Brazilian football fan from São Paulo holding a pocket radio to his ear. Mid voice that cracks into high-pitched shouting, anxious and sighing one moment, exploding in joyful celebration the next, like a fan after a last-minute goal. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Dispara | `torcedor_sofredor_dispara_1.mp3` | Sofri, mas valeu! É NA RAÇA! |
| Dispara | `torcedor_sofredor_dispara_2.mp3` | Ai, meu coração... GANHAMOS! |
| Dispara | `torcedor_sofredor_dispara_3.mp3` | Quase enfartei! Foi no sufoco! |
| Dispara | `torcedor_sofredor_dispara_4.mp3` | Aumenta o radinho, é NA RAÇA! |

### 💪 Brigão da Esquina, o valentão do bairro

> Encostado no poste da esquina, regata e corrente no pescoço. Adora quando alguém aceita o desafio.

- **Voz:** masculina, uns 34 anos
- **Sotaque:** paulistano de periferia, gíria de rua
- **Timbre:** grave, encorpado, peito estufado
- **Jeito de falar:** provocador, ri com desdém, fala alto e devagar para intimidar
- **Ajustes:** estabilidade 40, estilo 55

**Prompt (Voice Design):**

```text
A 34-year-old tough guy from the outskirts of São Paulo who hangs out on the street corner. Deep, chesty, loud voice, taunting and cocky, with a mocking laugh, speaks slowly to intimidate. Brazilian Portuguese with street slang.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Dispara | `brigao_da_esquina_dispara_1.mp3` | Aceitou? Então segura, meu chapa! |
| Dispara | `brigao_da_esquina_dispara_2.mp3` | Topou a briga? Agora aguenta! |
| Dispara | `brigao_da_esquina_dispara_3.mp3` | Ninguém encara a esquina à toa! |
| Dispara | `brigao_da_esquina_dispara_4.mp3` | Aceitou o truco? Que coragem, hein! |

### ⚽ Técnico da Várzea, o professor do time do bairro

> Boné, apito no pescoço e prancheta riscada. Jura que toda jogada foi ensaiada no treino de quinta.

- **Voz:** masculina, uns 55 anos
- **Sotaque:** paulistano da zona sul
- **Timbre:** rouco de tanto gritar na beira do campo
- **Jeito de falar:** gritado e ritmado, como quem orienta o time de longe; orgulhoso quando a jogada sai
- **Ajustes:** estabilidade 35, estilo 60

**Prompt (Voice Design):**

```text
A 55-year-old amateur football coach from a São Paulo neighborhood league. Hoarse, worn-out voice from shouting on the sidelines, rhythmic and commanding, proud when a rehearsed play works. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Dispara | `tecnico_da_varzea_dispara_1.mp3` | Jogada ensaiada, igual no treino! |
| Dispara | `tecnico_da_varzea_dispara_2.mp3` | Toca, toca! Tá tudo no esquema! |
| Dispara | `tecnico_da_varzea_dispara_3.mp3` | Prancheta não mente, moleque! |
| Dispara | `tecnico_da_varzea_dispara_4.mp3` | Treinamos isso a semana toda! |

### 🎱 Rei da Sinuca, o sinuqueiro do salão

> Taco próprio no estojo, chapéu panamá e giz azul no bolso. Diz que encaçapa as quatro manilhas como quem mata a bola sete.

- **Voz:** masculina, uns 60 anos
- **Sotaque:** paulistano boêmio do centro
- **Timbre:** grave, macio, aveludado
- **Jeito de falar:** sem pressa, elegante, confiante; fala baixo como quem não precisa provar nada
- **Ajustes:** estabilidade 65, estilo 30

**Prompt (Voice Design):**

```text
A 60-year-old Brazilian pool shark from downtown São Paulo pool halls. Deep, smooth, velvety voice, unhurried and elegant, quietly confident, like a bohemian who never misses a shot. Brazilian Portuguese.
```

**Falas do jogo:**

| Momento | Arquivo | Fala |
|---|---|---|
| Dispara | `rei_da_sinuca_dispara_1.mp3` | Encaçapei mais uma manilha! |
| Dispara | `rei_da_sinuca_dispara_2.mp3` | Taco, giz e caçapa. Próxima! |
| Dispara | `rei_da_sinuca_dispara_3.mp3` | Tacada limpa, meu jovem. |
| Dispara | `rei_da_sinuca_dispara_4.mp3` | Canta a caçapa: essa é do canto! |

## Você (o jogador)

As falas do jogador mudam conforme o item equipado no Bazar (grito de truco, fala de vitória e de derrota). Sugestão: gerar duas vozes e deixar o jogador escolher.

- **Masculina:** `A 30-year-old Brazilian man from São Paulo, confident and playful card player. Clear mid voice, cheeky, shouts with energy when calling truco. Brazilian Portuguese.` (estabilidade 40, estilo 50)
- **Feminina:** `A 30-year-old Brazilian woman from São Paulo, confident and playful card player. Clear, bright mid voice, teasing, shouts with energy when calling truco. Brazilian Portuguese.` (estabilidade 40, estilo 50)

## Efeitos sonoros (para gerar com IA)

| Som | Descrição para a IA |
|---|---|
| Carta na mesa | single playing card slapped onto a wooden bar table, close mic |
| Embaralhar | old paper playing cards being shuffled by hand, riffle shuffle |
| Grito de TRUCO | crowd in a small Brazilian bar reacting "uuuh!" after someone shouts truco |
| Tampinha | metal bottle caps dropping and rattling on a wooden table |
| Moeda | a few old coins clinking into a glass jar |
| Raio do Comparsa | short electric zap with a crackle and a rising shimmer |
| Total da rodada | cash register "ka-ching" with a bright bell |
| Ambiente do bar | busy Brazilian neighborhood bar at night, distant chatter, glasses clinking, a TV with football in the background |
| Chuva (evento Toró) | heavy tropical rain on a tin roof, muffled from inside a bar |
| Faltou luz | electricity cutting out with a buzz, crowd groaning in the dark |
| Roleta | old wooden prize wheel spinning with clicking pegs, slowing down |
| Entrada do Chefão | low cinematic boom with a door creaking open and a single bar lamp buzzing |
