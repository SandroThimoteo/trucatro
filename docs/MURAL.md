# Mural da equipe

Todo agente lê este mural antes de trabalhar e escreve no **Registro** (no fim) quando termina. É assim que um sabe o que o outro decidiu.

## Identidade (não mudar sem o dono do projeto)

- **O jogo:** roguelike de cartas em cima do **Truco Paulista**, no estilo Balatro: cada rodada vencida pontua **Fichas × Mult**, e o truco multiplica a mão.
- **O mundo:** São Paulo, botecos de bairro, 8 bairros até o **Rei do Truco**. Moeda da run: **réis**. Moeda que fica entre as runs: **Tampinhas** (só os Chefões deixam cair), gasta no **Bazar das Tampinhas**.
- **Não copiamos** nomes, personagens, textos ou arte de outros jogos (inclusive o Malandro, que só serviu de referência de mecânica).

## Vocabulário (use sempre estes termos)

| Termo | Significado |
|---|---|
| Mesa | Uma partida contra um personagem, com meta de pontos e número de mãos |
| Mão | 3 cartas, melhor de 3 **rodadas** (nunca "vaza" no texto do jogo) |
| Tentos | Pontos de truco do adversário; se chegar a 12, você perde a Mesa |
| Jogada | Tipo de vitória que pontua: de rodada (Rodada Simples, Matar Seco, Manilhada, Zapada, Cangada) ou de mão (Queda Limpa, Virada, Na Raça, No Empate, Fujão, Mão de Onze) |
| Comparsa | Item passivo (o "curinga"); a ordem dos Comparsas importa: soma antes, multiplica depois |
| Causo | Consumível que mexe nas cartas |
| Simpatia | Consumível que sobe o nível de uma Jogada |
| Manha | Regra especial de cada personagem da Mesa |
| Personagem | Quem você joga; tem um **poder** com usos grátis por Mesa |
| Evento | Acontecimento entre Mesas (Faltou luz, Fiado, Roleta, Mesa Dupla…) |

## Decisões em vigor

- **Dois relógios:** você vence batendo a meta; perde se acabarem as mãos **ou** se o adversário chegar a 12 tentos. Com 11 tentos dele, a mão é de onze.
- **Balanceamento atual (out/2026):** Bairro 1 com metas 200 / 320 / 500; o bot de teste precisa de ~3 das 4 mãos para vencer uma Mesa; tentos causam ~24% das derrotas do bot.
- **Personagens jogáveis:** Chico Baralho, Vó Cida e Bigode Grosso grátis; Zé Fiado (30) e Dona Glória (45) no Bazar. No Desafio do dia todos jogam com o Chico.
- **Cores das manilhas:** Pica-fumo azul, Espadilha verde, Copas laranja, Zap vermelho. A carta que perdeu a rodada fica cinza.
- **Modo de testes do admin:** run que usa os testes não vale para o ranking do Desafio do dia.
- **Emojis:** evitar emojis que não aparecem no Windows 10 (ex.: 🥸). Testar o avatar no navegador antes.
- **Cache do site:** o build põe `?v=` em todos os endereços; não tirar.

## Como testar

- `npm test`: todos os testes (precisam passar).
- `npm run testar-banco`: o SQL do Supabase num Postgres local.
- `npm start` e abrir `http://localhost:5173/?debug`: o jogo com `window.trucatro` para testar pelo console, e o botão 🛠️ Testes (admin) na Mesa.
- Larguras para conferir a tela: 375 (celular), 1231 e 1901.

## Pedidos abertos

_(Agente escreve aqui quando precisa de algo de outra área e ainda não foi feito. O coordenador risca quando entregar.)_

- ~~@coordenador (pedido do qa, 2026-10-26): donos de arquivos sem área~~ entregue (ver registro abaixo).

## Registro

### 2026-10-26 · coordenador · equipe criada
- Decidi: 8 agentes (regras, itens, falas, temas, estilo, audio, online, qa), com o coordenador passando os recados e este mural como memória comum.
- Mudei: `.claude/agents/*.md`, `docs/AGENTES.md`, `docs/MURAL.md`, `CLAUDE.md`
- Pedidos: nenhum

### 2026-10-26 · qa · conferência da divisão de áreas
- Decidi: sem dono em nenhum lugar: `data/online.json`, `src/core/perfil.js` (a tabela tira ele do `regras` e ninguém pega), `tools/simular.js` e a parte não-tela de `src/ui/main.js`. Dono só pela tabela (falta no `regras.md`): `src/core/cards.js`, `dados.js`, `events.js`, `rng.js`. Nenhum arquivo com dois donos. `npm test`: 112 passaram, 0 falharam.
- Mudei: `docs/MURAL.md` (só este registro e o pedido aberto)
- Pedidos: @coordenador definir os donos acima (ver "Pedidos abertos")

### 2026-10-26 · coordenador · donos dos arquivos sem área
- Decidi: `data/online.json` e `src/core/perfil.js` → online; `tools/simular.js` → regras; `src/ui/main.js` inteiro → estilo (outras áreas pedem botão/ação nova a ele); `cards.js`, `dados.js`, `events.js`, `rng.js` entram na lista do regras.
- Mudei: `.claude/agents/regras.md`, `estilo.md`, `online.md`, `docs/AGENTES.md`
- Pedidos: nenhum
