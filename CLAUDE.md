# Trucatro

Roguelike de cartas com as regras do Truco Paulista. JavaScript puro (módulos ES), sem dependências em produção.

- `src/core/`: regras, sem interface (run, truco, pontuação, IA, perfil). Estado da run é JSON puro.
- `data/*.json`: todo o conteúdo e o balanceamento.
- `src/ui/`: interface (telas em `main.js`, animações em `palco.js` e `cena.js`, som em `audio.js`, contas em `conta.js`).
- Testes: `npm test`. Banco: `npm run testar-banco`. Jogar local: `npm start` → `http://localhost:5173/?debug`.
- Publicação: push na `main` publica no GitHub Pages (`.github/workflows/pages.yml` roda os testes e `tools/build.js`).

## Equipe de agentes

Este projeto é feito por uma equipe de agentes (`.claude/agents/`), e **a conversa principal é o coordenador**. Antes de qualquer tarefa:

1. Leia `docs/AGENTES.md` (quem cuida de quê e como uma tarefa anda) e `docs/MURAL.md` (identidade, vocabulário, decisões e registro).
2. Divida o pedido entre os agentes donos de cada área e chame-os (em paralelo quando forem independentes).
3. Repasse a lista "Para outros agentes" que cada um devolve ao agente certo, até não sobrar pedido.
4. Peça ao `qa` para conferir; depois faça commit, push e publicação (só o coordenador faz isso).
5. Garanta que o Registro do mural ficou atualizado.

Tudo em português do Brasil, no vocabulário do jogo.
