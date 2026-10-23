// IA do adversário: determinística dado o stream de rng, configurada só por perfil.

import { forca, comparar } from './cards.js';
import { podePedirTruco, podeAumentar } from './truco.js';

function forcaNormalizada(carta, ctx) {
  const f = forca(carta, ctx);
  if (f >= 99) return 0.8 + ((f - 99) / 4) * 0.2;
  return (f / 9) * 0.7;
}

// Força da mão de 0 a 1: média ponderada, a melhor carta pesa mais.
export function forcaMao(cartas, ctx) {
  if (!cartas.length) return 0;
  const vals = cartas.map((c) => forcaNormalizada(c, ctx)).sort((a, b) => b - a);
  const pesos = [0.5, 0.3, 0.2, 0.1];
  let soma = 0;
  let pesoTotal = 0;
  vals.forEach((v, i) => {
    const p = pesos[i] ?? 0.05;
    soma += v * p;
    pesoTotal += p;
  });
  return soma / pesoTotal;
}

// Ajusta a força pela situação da mão (vazas já vencidas/perdidas).
export function forcaSituacional(st, jogador, ctx) {
  let f = forcaMao(st.maos[jogador], ctx);
  for (const v of st.vazas) {
    if (v.vencedor === jogador) f += 0.18;
    else if (v.vencedor !== 'empate') f -= 0.18;
  }
  const naMesa = st.mesa[0];
  if (naMesa && naMesa.jogador !== jogador) {
    const vence = st.maos[jogador].some((c) => comparar(c, naMesa.carta, ctx) > 0);
    f += vence ? 0.08 : -0.12;
  }
  return Math.max(0, Math.min(1, f));
}

export function decidirResposta(perfil, f, rng, podeAumentar) {
  const limiarAumentar = perfil.limiarAumentar ?? 0.8;
  if (podeAumentar && f >= limiarAumentar && rng.next() < perfil.agressividade) return 'aumentar';
  if (f >= perfil.coragem || rng.next() < perfil.blefe) return 'aceitar';
  return 'correr';
}

export function decidirPedido(perfil, f, rng) {
  const limiarPedir = perfil.limiarPedir ?? 0.65;
  if (f >= limiarPedir && rng.next() < perfil.agressividade) return true;
  return rng.next() < perfil.blefe * 0.5;
}

const porForca = (ctx) => (a, b) => forca(a, ctx) - forca(b, ctx);

// aBater: carta já jogada pelo outro nesta vaza (ou null se a IA abre).
export function escolherCarta(perfil, mao, aBater, ctx, rng, opcoes = {}) {
  const ordenada = [...mao].sort(porForca(ctx));
  const fraca = ordenada[0];
  const forte = ordenada[ordenada.length - 1];

  if (perfil.estrategiaCarta === 'aleatoria') return rng.pick(mao);

  if (aBater) {
    if (opcoes.marcada) return fraca;
    const vencedoras = ordenada.filter((c) => comparar(c, aBater, ctx) > 0);
    const empatam = ordenada.filter((c) => comparar(c, aBater, ctx) === 0);
    // Já ganhou a 1ª vaza: cangar garante a mão.
    if (opcoes.ganhouPrimeira && empatam.length) return empatam[0];
    if (vencedoras.length) return vencedoras[0];
    if (empatam.length && opcoes.cangarAjuda) return empatam[0];
    return fraca;
  }

  if (perfil.estrategiaCarta === 'forte_primeiro') return forte;
  // econômica: abre com a mais fraca, guardando as boas
  return mao.length > 1 ? fraca : forte;
}

// Decide a próxima ação do jogador 1 numa mão.
// memoria: objeto JSON da rodada, evita pensar em pedir truco duas vezes no mesmo ponto.
export function decidirAcao(st, perfil, ctx, rng, memoria = {}, opcoes = {}) {
  const j = 1;
  const f = forcaSituacional(st, j, ctx);
  if (st.pedido && st.pedido.por !== j) {
    const pode = podeAumentar(st, j);
    if (opcoes.aumentaSempre) return { tipo: 'responder', resposta: pode ? 'aumentar' : 'aceitar' };
    return { tipo: 'responder', resposta: decidirResposta(perfil, f, rng, pode) };
  }
  const chave = `${st.vazas.length}:${st.valor}`;
  if (!memoria[chave] && podePedirTruco(st, j)) {
    memoria[chave] = true;
    if (decidirPedido(perfil, f, rng)) return { tipo: 'pedir' };
  }
  const aBater = st.mesa[0]?.carta ?? null;
  const carta = escolherCarta(perfil, st.maos[j], aBater, ctx, rng, {
    marcada: aBater?.melhoria === 'marcada',
    ganhouPrimeira: st.numVazas === 3 && st.vazas.length === 1 && st.vazas[0].vencedor === j,
  });
  return { tipo: 'jogar', cartaId: carta.id };
}
