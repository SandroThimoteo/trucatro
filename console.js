// Modo console: Truco clássico contra a IA no terminal. Uso: node console.js [seed]

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { PartidaClassica } from './src/core/partida.js';
import { nomeCarta } from './src/core/cards.js';
import { podePedirTruco, proximoValor } from './src/core/truco.js';
import { randomSeed } from './src/core/rng.js';
import { carregarDados } from './tests/helpers.js';

const dados = carregarDados();
const seed = process.argv[2] ?? randomSeed();
const p = new PartidaClassica({ seed, perfil: dados.perfisPorId.classico });
const rl = createInterface({ input: stdin, output: stdout });
console.log(`Truco clássico · seed ${seed}`);

while (p.fase !== 'fim') {
  const st = p.mao;
  const ctx = p.ctx;
  if (p.fase === 'fimMao') {
    const r = p.ultimoResultado;
    console.log(`\nMão para ${r.vencedor === 0 ? 'você' : r.vencedor === 1 ? 'o adversário' : 'ninguém'} (+${r.pontos}). Placar: Nós ${p.placar[0]} × ${p.placar[1]} Eles`);
    p.proximaMao();
    continue;
  }
  if (p.fase === 'onze') {
    console.log(`\nMão de onze! Suas cartas: ${st.maos[0].map((c) => nomeCarta(c, ctx)).join('  ')}`);
    const r = await rl.question('Jogar (j) ou correr (c)? ');
    p.decidirOnze(0, r.trim() !== 'c');
    continue;
  }
  if (p.iaPrecisaAgir()) {
    const maoAntes = [...st.maos[1]];
    const acao = p.passoIA();
    if (acao.tipo === 'pedir') console.log('Adversário: TRUCO!');
    if (acao.tipo === 'responder') console.log(`Adversário: ${acao.resposta}`);
    if (acao.tipo === 'jogar') console.log(`Adversário jogou ${nomeCarta(maoAntes.find((c) => c.id === acao.cartaId), ctx)}`);
    continue;
  }
  console.log(`\nVira: ${nomeCarta(st.vira)} · valendo ${st.valor} · placar ${p.placar[0]} × ${p.placar[1]}${p.ferro ? ' · mão de ferro' : ''}`);
  if (st.mesa[0]) console.log(`Na mesa: ${nomeCarta(st.mesa[0].carta, ctx)}`);
  if (st.pedido) {
    const r = await rl.question(`Pediram ${st.pedido.valor}. (a)ceitar, (c)orrer${proximoValor(st.pedido.valor) ? ', a(u)mentar' : ''}? `);
    p.responder({ a: 'aceitar', c: 'correr', u: 'aumentar' }[r.trim()] ?? 'aceitar');
    continue;
  }
  const opcoes = st.maos[0].map((c, i) => `${i + 1}) ${p.ferro ? '??' : nomeCarta(c, ctx)}`).join('  ');
  const r = await rl.question(`${opcoes}${podePedirTruco(st, 0) ? '  t) truco' : ''}\n> `);
  try {
    if (r.trim() === 't') p.truco();
    else p.jogar(st.maos[0][Number(r) - 1]?.id);
  } catch (e) {
    console.log(e.message);
  }
}
console.log(`\n${p.vencedor === 0 ? 'Você venceu' : 'Você perdeu'}! ${p.placar[0]} × ${p.placar[1]}`);
rl.close();
