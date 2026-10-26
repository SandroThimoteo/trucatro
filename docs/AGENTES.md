# Equipe de agentes do Trucatro

O Trucatro é feito por uma equipe de agentes, cada um dono de uma área. A conversa principal do Claude é o **coordenador**: recebe o pedido do dono do projeto, divide o trabalho, chama os agentes, passa os recados de um para o outro, confere o resultado e publica.

Os arquivos de cada agente ficam em `.claude/agents/`. Qualquer sessão do Claude Code aberta na pasta `trucatro` enxerga essa equipe.

## Quem cuida de quê

| Agente | Área | Arquivos dele |
|---|---|---|
| `regras` | Regras do truco e da run, metas, economia, tentos, jogadas, IA, balanceamento | `data/regras.json`, `data/jogadas.json`, `data/baralhos.json`, `src/core/*.js` (menos `comparsas.js` e `perfil.js`), `tools/simular.js` |
| `itens` | Comparsas, Causos, Simpatias, melhorias e selos de carta, itens do Bazar | `data/comparsas.json`, `data/consumiveis.json`, `data/cartas.json`, `data/bazar.json`, `src/core/comparsas.js` |
| `falas` | Personagens, manhas, bios, falas, cenas de entrada, roteiro de vozes | `data/personagens.json`, `data/jogadores.json`, `data/adversarios.json`, `docs/VOZES.md` |
| `temas` | Bairros, eventos, mesas especiais, cenários 3D (Blender), clima e identidade | `data/eventos.json`, `tools/blender/`, `assets/cenarios/` |
| `estilo` | Visual, layout, celular, animações, telas, acessibilidade | `src/ui/estilo.css`, `src/ui/main.js` (telas e ações), `componentes.js`, `palco.js`, `cena.js`, `index.html` |
| `audio` | Música, efeitos, ambiente e vozes | `src/ui/audio.js`, `assets/audio/` |
| `online` | Contas, convites, admin, Supabase, Desafio online, deploy | `src/ui/conta.js`, `src/core/perfil.js`, `data/online.json`, `supabase/`, `server.js`, `tools/build.js`, `.github/workflows/` |
| `qa` | Testes, jogar no navegador, achar bug e conflito entre áreas | `tests/` (lê todo o resto) |

## Como uma tarefa anda (coordenador)

1. **Entender e dividir.** O coordenador lê o pedido e o `docs/MURAL.md`, e decide quais agentes entram e em que ordem. Exemplo, "um Comparsa novo que é um sanfoneiro": `itens` (efeito, preço) → `falas` (frase dele) → `estilo` (visual do raio, se tiver) → `audio` (som) → `qa`.
2. **Chamar os agentes.** Áreas que não dependem uma da outra vão juntas, em paralelo. Quando uma depende da outra, vai em sequência.
3. **Passar recados.** Cada agente devolve a lista "Para outros agentes". O coordenador entrega cada pedido ao agente certo, junto com o que o primeiro decidiu.
4. **Resolver conflito.** Se dois agentes discordam (exemplo: `itens` quer um Comparsa barato e `regras` acha forte demais), o coordenador decide, explica no mural e, se for gosto pessoal, pergunta ao dono do projeto.
5. **Conferir.** O `qa` roda os testes e joga no navegador. Só então o coordenador faz commit, push e publica no GitHub Pages e na versão do Claude.

## Regras da equipe (valem para todos)

- Antes de trabalhar, ler `docs/MURAL.md` e este arquivo.
- Mexer só nos próprios arquivos; o resto é pedido para o agente dono.
- Ao terminar, registrar no mural o que decidiu, o que mudou e os pedidos para os outros.
- Commit, push e publicação são só do coordenador.
- Tudo em português do Brasil, no vocabulário do jogo.
