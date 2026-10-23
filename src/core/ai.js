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

// ---------- Truco em dupla ----------

// Sinais do truco paulista: o parceiro conta o que tem na mão sem falar.
export const SINAIS = {
  zap: { nome: 'Zap', gesto: 'piscou um olho', emoji: '😉', forca: 1 },
  copas: { nome: 'Copas', gesto: 'levantou as sobrancelhas', emoji: '🤨', forca: 0.95 },
  espadilha: { nome: 'Espadilha', gesto: 'fez biquinho', emoji: '😗', forca: 0.9 },
  picafumo: { nome: 'Pica-fumo', gesto: 'mostrou a ponta da língua', emoji: '😛', forca: 0.85 },
  tres: { nome: 'Um três', gesto: 'mordeu o canto da boca', emoji: '😬', forca: 0.6 },
  nada: { nome: 'Nada que preste', gesto: 'fechou os olhos devagar', emoji: '😑', forca: 0.15 },
};
const SINAL_DO_NAIPE = { paus: 'zap', copas: 'copas', espadas: 'espadilha', ouros: 'picafumo' };

// O melhor sinal que a mão permite fazer
export function sinalDaMao(mao, ctx) {
  const melhor = [...mao].sort(porForca(ctx)).pop();
  if (!melhor) return 'nada';
  if (forca(melhor, ctx) >= 100) return SINAL_DO_NAIPE[melhor.suit] ?? 'tres';
  return melhor.rank === '3' ? 'tres' : 'nada';
}

const PARCEIRO_DE = (j) => (j + 2) % 4;

// Carta que está levando a vaza agora (e de quem é)
function maiorNaMesa(st, ctx) {
  let top = null;
  for (const m of st.mesa) if (!top || forca(m.carta, ctx) > forca(top.carta, ctx)) top = m;
  return top;
}

// Decide a próxima ação do jogador j (1, 2 ou 3) numa mão em dupla.
// sinais: { [jogador]: chave de SINAIS } que cada um mostrou ao parceiro.
export function decidirAcaoDupla(st, j, perfil, ctx, rng, memoria = {}, opcoes = {}) {
  const time = j % 2;
  const sinal = SINAIS[opcoes.sinais?.[PARCEIRO_DE(j)]]?.forca ?? 0.4;
  let f = forcaMao(st.maos[j], ctx);
  f = Math.max(f, 0.55 * f + 0.45 * sinal);
  for (const v of st.vazas) {
    if (v.vencedor === time) f += 0.18;
    else if (v.vencedor !== 'empate') f -= 0.18;
  }
  f = Math.max(0, Math.min(1, f));

  if (st.pedido) {
    const pode = podeAumentar(st, j);
    if (opcoes.aumentaSempre) return { tipo: 'responder', resposta: pode ? 'aumentar' : 'aceitar' };
    return { tipo: 'responder', resposta: decidirResposta(perfil, f, rng, pode) };
  }
  const chave = `${j}:${st.vazas.length}:${st.valor}`;
  if (!opcoes.naoPede && !memoria[chave] && podePedirTruco(st, j)) {
    memoria[chave] = true;
    if (decidirPedido(perfil, f, rng)) return { tipo: 'pedir' };
  }

  const mao = st.maos[j];
  const ordenada = [...mao].sort(porForca(ctx));
  const fraca = ordenada[0];
  const top = maiorNaMesa(st, ctx);
  // O parceiro já está levando a vaza: guarda as boas e joga a mais fraca
  if (top && top.jogador % 2 === time) return { tipo: 'jogar', cartaId: fraca.id };
  if (top) {
    const vence = ordenada.find((c) => comparar(c, top.carta, ctx) > 0);
    // Se o parceiro ainda vai jogar e tem coisa boa, deixa com ele
    const parceiroDepois = st.mesa.length < 2 && sinal >= 0.85;
    if (vence && !parceiroDepois) return { tipo: 'jogar', cartaId: vence.id };
    return { tipo: 'jogar', cartaId: fraca.id };
  }
  // Abrindo a vaza: se o parceiro avisou que tem manilha, sai com a fraca
  if (sinal >= 0.85 || perfil.estrategiaCarta !== 'forte_primeiro') return { tipo: 'jogar', cartaId: mao.length > 1 ? fraca.id : ordenada[ordenada.length - 1].id };
  return { tipo: 'jogar', cartaId: ordenada[ordenada.length - 1].id };
}
