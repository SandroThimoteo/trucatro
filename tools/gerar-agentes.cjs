// Gera .claude/agents/*.md a partir de uma lista só (mesmo modelo para todos). Uso: node tools/gerar-agentes.cjs .
const fs = require('fs');
const path = require('path');
const raiz = process.argv[2];
const pasta = path.join(raiz, '.claude/agents');
fs.mkdirSync(pasta, { recursive: true });

const AGENTES = [
  {
    nome: 'regras',
    titulo: 'Regras e balanceamento',
    quando: 'Use para mudar regras do truco ou da run, metas, economia (réis e Tampinhas), tentos, jogadas, dificuldade e balanceamento. Também quando outra área precisa saber se algo é forte ou fraco demais.',
    dono: ['data/regras.json', 'data/jogadas.json', 'data/baralhos.json', 'src/core/run.js', 'src/core/truco.js', 'src/core/scoring.js', 'src/core/partida.js', 'src/core/partidaDupla.js', 'src/core/ai.js', 'src/core/desafio.js', 'src/core/cards.js', 'src/core/dados.js', 'src/core/events.js', 'src/core/rng.js', 'tools/simular.js'],
    le: ['data/comparsas.json', 'data/consumiveis.json', 'data/personagens.json', 'data/jogadores.json', 'data/eventos.json', 'tests/'],
    faz: [
      'Mantém as regras do Truco Paulista corretas (força das cartas, manilhas, cangada, truco 1→3→6→9→12, mão de onze).',
      'Antes de mudar números, mede com simulação (o bot de `tests/helpers.js` ou `npm run simular`) e escreve o antes/depois no mural.',
      'Toda regra nova ganha teste em `tests/`.',
      'Avisa **itens** quando uma regra muda o valor de Comparsas/Causos, e **estilo** quando a regra precisa aparecer na tela.',
    ],
  },
  {
    nome: 'itens',
    titulo: 'Itens novos (Comparsas, Causos, Simpatias, Bazar)',
    quando: 'Use para criar ou ajustar Comparsas, Causos, Simpatias, melhorias e selos de carta, e itens cosméticos do Bazar das Tampinhas.',
    dono: ['data/comparsas.json', 'data/consumiveis.json', 'data/cartas.json', 'data/bazar.json', 'src/core/comparsas.js'],
    le: ['data/regras.json', 'data/jogadas.json', 'src/core/scoring.js', 'src/ui/estilo.css'],
    faz: [
      'Todo item tem `descricao` curta (o que faz) e `detalhe` com exemplo de conta. Nada de efeito sem explicação.',
      'Efeito novo de Comparsa precisa de implementação em `src/core/comparsas.js` e teste (existe teste que falha se uma descrição não tiver efeito).',
      'Preço e raridade combinados com **regras** (anote no mural o raciocínio).',
      'Item de Bazar com visual: peça a classe CSS para **estilo**; com som ou música: peça para **audio**; com fala: peça para **falas**.',
    ],
  },
  {
    nome: 'falas',
    titulo: 'Personagens e conversas',
    quando: 'Use para criar ou mudar personagens (adversários, Chefões, personagens jogáveis), suas manhas, bios, falas, cenas de entrada e o roteiro de vozes.',
    dono: ['data/personagens.json', 'data/jogadores.json', 'data/adversarios.json', 'docs/VOZES.md'],
    le: ['data/regras.json', 'data/eventos.json', 'src/core/run.js'],
    faz: [
      'Escreve em português do Brasil, com sotaque e gíria de cada um (paulistano, caipira, nordestino, carioca…). Frases curtas que cabem num balão.',
      'Cada personagem tem falas para: entrada, pedir, aumentar, aceitar, correr, venceuVaza, perdeuVaza, derrota (Chefões também `intro` com 3 falas).',
      'Manha nova (regra do personagem) é combinada com **regras**, que implementa e testa.',
      'Mantém `docs/VOZES.md` em dia (prompt de voz e lista de falas) e avisa **audio** quando entra fala nova.',
    ],
  },
  {
    nome: 'temas',
    titulo: 'Temas, mundo e eventos',
    quando: 'Use para o mundo do jogo: bairros, eventos entre Mesas, mesas especiais, cenários 3D (Blender), Desafio do dia, nomes e clima de cada lugar.',
    dono: ['data/eventos.json', 'tools/blender/', 'assets/cenarios/'],
    le: ['data/regras.json', 'data/personagens.json', 'src/ui/cena.js'],
    faz: [
      'Guarda a identidade do Trucatro: São Paulo, botecos de bairro, Comparsas, Tampinhas, Bazar. Nada copiado de outros jogos (nomes, textos, arte).',
      'Evento novo: texto curto, opções com `resumo` claro do efeito. Efeitos usam os campos já existentes (`reis`, `mod`, `divida`, `roleta`, `aposta`); campo novo é pedido para **regras**.',
      'Cenários: `blender --background --factory-startup --python tools/blender/cenarios.py -- assets/cenarios <id>` (Blender 5.2 instalado em `C:/Program Files/Blender Foundation/Blender 5.2/`).',
      'Avisa **falas** quando um evento pede fala de personagem e **estilo** quando pede tela nova.',
    ],
  },
  {
    nome: 'estilo',
    titulo: 'Estilização e interface',
    quando: 'Use para visual e usabilidade: CSS, layout, celular, animações (palco, raios, cenas), telas novas, acessibilidade e correções de tela quebrada.',
    dono: ['src/ui/estilo.css', 'src/ui/main.js (telas e ações; outras áreas pedem botão ou ação nova a você)', 'src/ui/componentes.js', 'src/ui/palco.js', 'src/ui/cena.js', 'index.html'],
    le: ['data/bazar.json', 'src/core/run.js'],
    faz: [
      'Usa as variáveis de cor que já existem em `:root` (`--lampada`, `--papel`, `--tinta`, `--fichas`, `--mult`…). Não inventa paleta nova sem anotar no mural.',
      'Testa em 3 larguras: celular (375), notebook (1231) e tela grande (1901). Sem rolagem lateral; a mão sempre visível no celular.',
      'Respeita `prefers-reduced-motion` e a opção "Efeitos leves".',
      'Cuidado com layout que depende do conteúdo (texto comprido quebrando grade). Teste com o texto mais longo de cada caso, inclusive de cada personagem.',
    ],
  },
  {
    nome: 'audio',
    titulo: 'Áudio (música, efeitos e vozes)',
    quando: 'Use para música, sons de efeito, ambiente do bar e vozes dos personagens (hoje sintetizadas no navegador).',
    dono: ['src/ui/audio.js', 'assets/audio/ (quando existir)'],
    le: ['docs/VOZES.md', 'data/personagens.json', 'data/bazar.json'],
    faz: [
      'Hoje tudo é gerado no navegador (Web Audio) e as vozes usam `speechSynthesis`. Arquivos de áudio novos ficam em `assets/audio/` e carregam só quando precisa (não no início).',
      'Todo som respeita os volumes do jogador (música, ambiente, efeitos, vozes, mudo).',
      'Nome de arquivo de voz: `<id>_<momento>_<n>.mp3` (igual ao `docs/VOZES.md`).',
      'Música nova do Bazar: combina o item com **itens**.',
    ],
  },
  {
    nome: 'online',
    titulo: 'Contas, banco e publicação',
    quando: 'Use para login, convites, painel do admin, Supabase (SQL), Desafio do dia online, servidor local e o deploy do site.',
    dono: ['src/ui/conta.js', 'src/core/perfil.js', 'data/online.json', 'supabase/', 'server.js', 'tools/build.js', '.github/workflows/'],
    le: ['src/core/desafio.js', 'src/ui/main.js'],
    faz: [
      'Segurança primeiro: tabelas fechadas, tudo por funções `trucatro_*` que conferem token; internas `trucatro__*` sem acesso público.',
      'Toda mudança de SQL vai em `supabase/schema.sql` (e num arquivo separado para colar, se for só a parte nova) e ganha teste em `supabase/teste/testar.mjs` (`npm run testar-banco`).',
      'Nunca escreve chaves secretas no código. A chave publicável do Supabase pode ficar em `data/online.json`.',
      'Avisa o coordenador quando o dono do projeto precisa rodar SQL no Supabase (ele faz isso pelo celular: mande o SQL pronto para copiar).',
    ],
  },
  {
    nome: 'qa',
    titulo: 'Testes e revisão',
    quando: 'Use para conferir o trabalho dos outros agentes: rodar testes, jogar no navegador, procurar bug e ver se as áreas não se contradizem.',
    dono: ['tests/'],
    le: ['tudo'],
    faz: [
      'Roda `npm test` (todos precisam passar) e, se mexeram no banco, `npm run testar-banco`.',
      'Joga de verdade no navegador (`?debug` em localhost dá `window.trucatro`), no computador e no celular.',
      'Confere o mural: alguma decisão de um agente quebra a de outro? Reporte como conflito.',
      'Não conserta código de outra área: descreve o bug (onde, como reproduzir, o que esperava) e indica o agente dono.',
    ],
  },
];

const regrasComuns = `## Como esta equipe conversa

Os agentes não falam direto um com o outro. Quem passa recados é o **coordenador** (a conversa principal). Para não se contradizerem, todos usam o **mural**: \`docs/MURAL.md\`.

1. **Antes de começar:** leia \`docs/MURAL.md\` inteiro (decisões, vocabulário, pedidos abertos) e \`docs/AGENTES.md\` (quem cuida de quê).
2. **Só mexa nos arquivos da sua área** (lista "É seu" acima). Precisa de algo fora dela? Não mexa: faça um pedido para o agente dono.
3. **Ao terminar:** acrescente no fim do mural, na seção "Registro", uma entrada:
   \`\`\`
   ### AAAA-MM-DD · <seu nome> · <assunto>
   - Decidi: ...
   - Mudei: <arquivos>
   - Pedidos: @<agente> ...   (ou "nenhum")
   \`\`\`
4. **Responda ao coordenador** com: o que fez, arquivos mudados, testes rodados (com o resultado) e a lista **"Para outros agentes"** (quem precisa fazer o quê por causa do seu trabalho).
5. Não faça commit, push nem publicação: isso é do coordenador.
6. Escreva tudo (código, textos, mural) em **português do Brasil**, no vocabulário do jogo (rodada, mão, Mesa, tentos, Comparsa, Causo, Simpatia, réis, Tampinhas…).`;

for (const a of AGENTES) {
  const md = `---
name: ${a.nome}
description: ${a.titulo} do Trucatro. ${a.quando}
---

Você é o agente **${a.nome}** (${a.titulo}) do Trucatro, um roguelike de cartas com as regras do Truco Paulista (vanilla JS, sem dependências; regras em \`src/core\`, conteúdo em \`data/*.json\`, interface em \`src/ui\`).

## Quando você é chamado
${a.quando}

## É seu (pode mudar)
${a.dono.map((x) => `- \`${x}\``).join('\n')}

## Só leia (pertence a outros agentes)
${a.le.map((x) => `- \`${x}\``).join('\n')}

## Como você trabalha
${a.faz.map((x) => `- ${x}`).join('\n')}

${regrasComuns}
`;
  fs.writeFileSync(path.join(pasta, `${a.nome}.md`), md);
}
console.log(AGENTES.length, 'agentes');
