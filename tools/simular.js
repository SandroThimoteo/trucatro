// Simulação de balanceamento: um bot razoável joga N runs e mostra até onde chega.
// Uso: node tools/simular.js [runs]

import { Jogo, TIPOS_MESA } from '../src/core/run.js';
import { forca, comparar } from '../src/core/cards.js';
import { forcaSituacional } from '../src/core/ai.js';
import { carregarDados } from '../tests/helpers.js';

const dados = carregarDados();
const N = Number(process.argv[2] ?? 300);

function escolherCarta(jogo) {
  const st = jogo.rodada.mao;
  const ctx = jogo.ctxForca();
  const mao = [...st.maos[0]].sort((a, b) => forca(a, ctx) - forca(b, ctx));
  const aBater = st.mesa[0]?.carta;
  if (aBater) return (mao.find((c) => comparar(c, aBater, ctx) > 0) ?? mao[0]).id;
  return mao[mao.length - 1].id;
}

function jogar(seed) {
  const jogo = Jogo.novaRun(dados, { seed });
  const r = jogo.run;
  let guard = 0;
  while (guard++ < 20000 && !['derrota', 'vitoria'].includes(r.fase)) {
    if (r.fase === 'mapa') jogo.iniciarMesa();
    else if (r.fase === 'recompensa') jogo.irAoBoteco();
    else if (r.fase === 'boteco') {
      const i = r.loja.itens.findIndex((it) => !it.vendido && it.preco <= r.reis
        && (it.tipo !== 'comparsa' || r.comparsas.length < r.slotsComparsa)
        && (it.tipo !== 'causo') && (it.tipo !== 'simpatia' || r.consumiveis.length < r.slotsConsumivel));
      if (i >= 0) jogo.comprar(i);
      else {
        while (r.consumiveis.some((x) => x.tipo === 'simpatia')) jogo.usarConsumivel(r.consumiveis.findIndex((x) => x.tipo === 'simpatia'));
        jogo.sairDoBoteco();
      }
    } else {
      const rd = jogo.rodada;
      if (rd.fase === 'vira') jogo.escolherVira(0);
      else if (rd.fase === 'troca') {
        if (jogo.podeAbrirParaIA()) jogo.comecarRodada();
        else jogo.comecarRodada();
      } else if (rd.fase === 'fim') jogo.proximaMao();
      else if (jogo.iaPrecisaAgir()) jogo.passoIA();
      else {
        const st = rd.mao;
        const ctx = jogo.ctxForca();
        const f = forcaSituacional({ ...st, maos: [st.maos[1], st.maos[0]], vazas: st.vazas.map((v) => ({ ...v, vencedor: v.vencedor === 'empate' ? 'empate' : 1 - v.vencedor })), mesa: st.mesa.map((m) => ({ ...m, jogador: 1 - m.jogador })) }, 1, ctx);
        if (st.pedido) jogo.responderTruco(f > 0.55 ? 'aceitar' : 'correr');
        else if (jogo.podePedirTruco() && f > 0.7) jogo.pedirTruco();
        else jogo.jogarCarta(escolherCarta(jogo));
      }
    }
  }
  return r;
}

const chegou = {};
let vitorias = 0;
for (let i = 0; i < N; i++) {
  const r = jogar(`sim-${i}`);
  const chave = r.vitoria ? 'vitória' : `B${r.bairro} ${TIPOS_MESA[r.mesaIdx]}`;
  chegou[chave] = (chegou[chave] ?? 0) + 1;
  if (r.vitoria) vitorias++;
}
console.log(`${N} runs — vitórias: ${vitorias} (${((vitorias / N) * 100).toFixed(1)}%)`);
for (const [k, v] of Object.entries(chegou).sort()) console.log(`${k.padEnd(14)} ${'#'.repeat(Math.ceil((v / N) * 60))} ${v}`);
