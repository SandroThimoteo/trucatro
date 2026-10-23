# Trucatro

Roguelike deckbuilder com as regras do Truco Paulista. Versão web (alternativa prevista no documento de design), sem dependências.

```
node server.js          # joga em http://localhost:5173 (com login por nome e senha)
node --test             # suíte de testes (regras, pontuação, Comparsas, IA, runs)
node console.js         # truco clássico no terminal
node tools/simular.js   # simulação de balanceamento com bot
```

## Estrutura

```
src/core/     regras puras, zero dependência de UI (equivale ao Trucatro.Core)
  rng.js        SeededRng com sub-streams (baralho, loja, ia, vira...)
  cards.js      cartas, ordem de força, vira e manilhas
  truco.js      motor de uma mão: vazas, cangadas, truco (aceitar/correr/aumentar)
  partida.js    modo Truco clássico até 12, mão de onze e mão de ferro
  ai.js         IA por perfil (força da mão, decisão de truco, escolha de carta)
  scoring.js    pipeline Fichas × Mult com passos para a UI animar
  comparsas.js  efeitos dos Comparsas (fases de pontuação + observadores de eventos)
  events.js     GameEventBus
  run.js        Run → Bairro → Mesa → Boteco, economia, Causos, Simpatias, personagens e manhas
  perfil.js     progresso entre runs: Tampinhas, compras do Bazar, recordes, opções
data/         todo o conteúdo e balanceamento em JSON (equivale ao Trucatro.Data)
src/ui/       interface: só lê o estado e envia comandos
  audio.js      música (baião), ambiente de bar, efeitos e vozes, tudo sintetizado
  conta.js      onde o perfil é salvo: conta do Claude, servidor local ou só o navegador
server.js     arquivos do jogo + API de contas (senhas com scrypt, dados em .contas/)
tests/        node:test
```

## Decisões que diferem do documento

- **Fuga:** quando o adversário corre do seu truco, sua melhor carta na mão pontua como uma vaza vencida (× valor anterior). Sem isso, pedir truco antes da 1ª vaza só queimava a mão. Desligável em `data/regras.json` (`truco.fugaPontuaMelhorCarta`).
- **Mão de onze na run:** a última mão de cada Mesa é a mão de onze (vale 3, sem truco) e dá o bônus da Jogada "Mão de Onze".
- **Penalidade do blefe:** só quando o *seu* truco (ou aumento) foi aceito e você perdeu a mão.
- Comparsas com texto ambíguo foram reescritos para a descrição bater com o efeito: Pica-fumo Pirata, A Benzedeira (revela a mão do adversário), Zap Duplo (manilha de Espadas vale Zap), Carteado Fantasma (agora ×2 Mult em toda vaza vencida, já que a mão é sempre de 3 cartas). "O Rei do Truco" (Comparsa) virou **Herdeiro do Rei** para não confundir com o chefão final.
- Chefão extra para fechar 8: **Tia Zulmira** (sem trocas na Mesa). Chefões agora ficam em `data/personagens.json`.
- **Mão de 3 cartas em todos os modos.** Antes da 1ª vaza dá para trocar 1, 2 ou as 3 cartas; cada troca gasta 1 das trocas da Mesa.

## Personagens, manhas e Tampinhas

- Cada Mesa é uma pessoa (`data/personagens.json`): 8 no bar, 8 no fundo e 8 chefões. Cada uma tem título, bio, voz, falas próprias e uma **manha** (regra só daquela Mesa: réis por vaza, +Fichas, troca a mais ou a menos, mão valendo 3, cartas à mostra...). A seed decide quem senta em cada bairro.
- **Tampinhas** são a moeda que fica entre as runs. Só chefões deixam cair (`drop` de cada um + 1 por bairro; +10 ao vencer o Rei do Truco). Gaste no **Bazar** (`data/bazar.json`): verso e frente das cartas, toalha, grito de truco e falas de vitória/derrota.
- Todo Comparsa, Causo, Simpatia, melhoria, selo e pessoa tem um botão **i** com a explicação completa e exemplo.

## Conta e progresso

- **No claude.ai (Artifact):** entra com a conta do Claude; o perfil fica no banco privado do artifact (`data/users/<id>/perfil`).
- **Com `node server.js`:** tela de login com nome e senha. Senhas com scrypt, sessões por token; dados em `.contas/` (nunca servida). Mude a pasta com `TRUCATRO_CONTAS`.
- **Sem conta:** salva só no navegador. Ao entrar numa conta nova, o progresso do aparelho vai junto.
- A run é salva a cada jogada; fechou no meio da Mesa, "Continuar run" volta no mesmo ponto.

## Online: GitHub Pages + Supabase (convites e admin)

O site no GitHub Pages é público para quem tem o link, mas **só joga quem tem conta**, e conta nova só com **convite**.

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No projeto: **SQL Editor → New query**, cole todo o `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie a *Project URL* e a chave pública (*anon* / *publishable*) para `data/online.json`:
   ```json
   { "supabaseUrl": "https://xxxx.supabase.co", "supabaseChave": "sua-chave-publica" }
   ```
   Essa chave é feita para ficar no site: as tabelas ficam fechadas e o site só usa as funções `trucatro_*`, que conferem senha, token e admin.
4. Faça push. O workflow `.github/workflows/pages.yml` roda os testes e publica.
5. Abra o site e **crie a primeira conta: ela vira admin** (não precisa de convite). Faça isso logo depois de publicar.

**Painel do admin** (botão no menu, só para admin):
- **Convites:** escolha quantos criar (1 a 100 de uma vez), com observação opcional. Cada convite vira um link `.../?convite=XXXX-XXXX` que abre o cadastro já preenchido e serve para **uma** conta. Convites livres podem ser apagados.
- **Jogadores:** veja todos e mude as **Tampinhas** e os **réis da run em andamento**. Se a pessoa estiver jogando, o valor muda no próximo salvamento dela (com aviso na tela).

Teste do banco sem Supabase: `npm install && npm run testar-banco` (Postgres local via PGlite).
