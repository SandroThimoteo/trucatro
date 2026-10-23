import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ARQUIVOS_DADOS, montarDados } from '../src/core/dados.js';
import { Jogo } from '../src/core/run.js';
import { SeededRng } from '../src/core/rng.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

export function carregarDados() {
  const raw = {};
  for (const nome of ARQUIVOS_DADOS) raw[nome] = JSON.parse(readFileSync(join(raiz, 'data', `${nome}.json`), 'utf8'));
  return montarDados(raw);
}

export const c = (rank, suit, extra = {}) => ({ id: `c-${rank}${suit}`, rank, suit, bonusFichas: 0, melhoria: null, selo: null, ...extra });
export const o = (rank, suit) => ({ id: `o-${rank}${suit}`, rank, suit, bonusFichas: 0, melhoria: null, selo: null });

// Bot simples para testes de propriedade: escolhe ações com um rng próprio.
export function jogarRunComBot(dados, seed, { maxPassos = 5000, baralhoId = 'boteco' } = {}) {
  const jogo = Jogo.novaRun(dados, { seed, baralhoId });
  const bot = new SeededRng(`bot-${seed}`).stream('bot');
  const r = jogo.run;
  let passos = 0;
  while (passos++ < maxPassos) {
    if (r.fase === 'derrota' || r.fase === 'vitoria') break;
    if (r.fase === 'mapa') {
      jogo.iniciarMesa();
    } else if (r.fase === 'mesa') {
      const rd = jogo.rodada;
      if (rd.fase === 'vira') jogo.escolherVira(0);
      else if (rd.fase === 'troca') {
        if (r.mesa.trocasRestantes > 0 && bot.chance(0.3)) jogo.trocar([r.mesa.mao[0]]);
        else if (jogo.podePedirTruco() && bot.chance(0.2)) jogo.pedirTruco();
        else if (jogo.podeAbrirParaIA()) jogo.comecarRodada();
        else jogo.jogarCarta(r.mesa.mao[0]);
      } else if (rd.fase === 'jogo') {
        const st = rd.mao;
        if (jogo.iaPrecisaAgir()) jogo.passoIA();
        else if (st.pedido && st.pedido.por === 1) jogo.responderTruco(bot.pick(['aceitar', 'aceitar', 'correr', 'aumentar'].filter((x) => x !== 'aumentar' || st.valores.indexOf(st.pedido.valor) < st.valores.length - 1)));
        else if (jogo.podePedirTruco() && bot.chance(0.1)) jogo.pedirTruco();
        else jogo.jogarCarta(st.maos[0][0].id);
      } else if (rd.fase === 'fim') {
        jogo.proximaMao();
      }
    } else if (r.fase === 'recompensa') {
      jogo.irAoBoteco();
    } else if (r.fase === 'boteco') {
      const i = r.loja.itens.findIndex((it) => !it.vendido && it.preco <= r.reis && (it.tipo !== 'comparsa' || r.comparsas.length < r.slotsComparsa) && (it.tipo === 'comparsa' || it.tipo === 'carta' || r.consumiveis.length < r.slotsConsumivel));
      if (i >= 0) jogo.comprar(i);
      else {
        // usa simpatias guardadas
        const s = r.consumiveis.findIndex((x) => x.tipo === 'simpatia');
        if (s >= 0) jogo.usarConsumivel(s);
        jogo.sairDoBoteco();
      }
    }
  }
  return { jogo, passos };
}
