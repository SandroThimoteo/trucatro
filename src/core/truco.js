// Motor puro de uma mão de truco entre dois jogadores (0 e 1).
// O estado é JSON puro; o contexto de força (vira, regras) é passado em cada jogada.

import { comparar } from './cards.js';

export const TRUCO_VALORES = [1, 3, 6, 9, 12];

export function proximoValor(valor, valores = TRUCO_VALORES) {
  return valores[valores.indexOf(valor) + 1] ?? null;
}

const outro = (j) => 1 - j;

// resultados: lista de 0 | 1 | 'empate'. Retorna { fim, vencedor (0 | 1 | null) }.
export function resolverMao(resultados, numVazas = 3) {
  const vit = [0, 0];
  for (const r of resultados) if (r !== 'empate') vit[r]++;
  const primeira = resultados.find((r) => r !== 'empate') ?? null;
  const precisa = Math.floor(numVazas / 2) + 1;
  if (vit[0] >= precisa) return { fim: true, vencedor: 0 };
  if (vit[1] >= precisa) return { fim: true, vencedor: 1 };
  const n = resultados.length;

  if (numVazas === 3) {
    const [r1, r2, r3] = resultados;
    if (n === 2) {
      // Cangou a 1ª → vence quem ganhar a 2ª. Ganhou a 1ª e cangou a 2ª → vence quem ganhou a 1ª.
      if (r1 === 'empate' && r2 !== 'empate') return { fim: true, vencedor: r2 };
      if (r1 !== 'empate' && r2 === 'empate') return { fim: true, vencedor: r1 };
    }
    if (n === 3) {
      if (r1 === 'empate' && r2 === 'empate') return { fim: true, vencedor: r3 === 'empate' ? null : r3 };
      // 1x1 e cangou a 3ª → vence quem ganhou a 1ª
      return { fim: true, vencedor: primeira };
    }
    return { fim: false, vencedor: null };
  }

  const restantes = numVazas - n;
  if (vit[0] > vit[1] + restantes) return { fim: true, vencedor: 0 };
  if (vit[1] > vit[0] + restantes) return { fim: true, vencedor: 1 };
  if (restantes === 0) {
    if (vit[0] !== vit[1]) return { fim: true, vencedor: vit[0] > vit[1] ? 0 : 1 };
    return { fim: true, vencedor: primeira };
  }
  return { fim: false, vencedor: null };
}

export function criarMao({ maos, vira, iniciante = 0, valor = 1, numVazas = 3, trucoPermitido = true, valores = TRUCO_VALORES }) {
  return {
    maos: maos.map((m) => m.map((c) => ({ ...c }))),
    vira,
    numVazas,
    valores,
    vazas: [],
    mesa: [], // cartas da vaza em andamento: { jogador, carta }
    vez: iniciante,
    iniciadorVaza: iniciante,
    valorInicial: valor,
    valor,
    pedido: null, // { por, valor }
    ultimoAumento: null,
    trucoPermitido,
    fim: false,
    vencedor: null,
    correu: null,
    pontos: 0,
  };
}

function encerrar(st, vencedor) {
  st.fim = true;
  st.vencedor = vencedor;
  st.pontos = vencedor === null ? 0 : st.valor;
  return { tipo: 'OnMaoFinalizada', vencedor, pontos: st.pontos, correu: st.correu };
}

export function podePedirTruco(st, j) {
  return !st.fim && st.trucoPermitido && !st.pedido && st.vez === j && st.ultimoAumento !== j
    && proximoValor(st.valor, st.valores) !== null;
}

export function podeAumentar(st, j) {
  return !!st.pedido && st.pedido.por !== j && proximoValor(st.pedido.valor, st.valores) !== null;
}

export function pedirTruco(st, j) {
  if (!podePedirTruco(st, j)) throw new Error('Não dá pra pedir truco agora');
  st.pedido = { por: j, valor: proximoValor(st.valor, st.valores) };
  return [{ tipo: 'OnTrucoPedido', jogador: j, valor: st.pedido.valor }];
}

// Aumentar aceita o pedido atual e devolve um pedido maior para o outro.
// Correr dá ao outro o valor que já estava aceito.
export function responderTruco(st, j, resposta) {
  if (!st.pedido || st.pedido.por === j) throw new Error('Não há truco para responder');
  const { por, valor } = st.pedido;
  const eventos = [];
  if (resposta === 'aceitar') {
    st.valor = valor;
    st.ultimoAumento = por;
    st.pedido = null;
    eventos.push({ tipo: 'OnTrucoRespondido', jogador: j, resposta, valor });
  } else if (resposta === 'correr') {
    st.pedido = null;
    st.correu = j;
    eventos.push({ tipo: 'OnTrucoRespondido', jogador: j, resposta, valor: st.valor });
    eventos.push(encerrar(st, por));
  } else if (resposta === 'aumentar') {
    if (!podeAumentar(st, j)) throw new Error('Não dá pra aumentar mais');
    st.valor = valor;
    st.ultimoAumento = por;
    st.pedido = { por: j, valor: proximoValor(valor, st.valores) };
    eventos.push({ tipo: 'OnTrucoRespondido', jogador: j, resposta, valor: st.pedido.valor });
  } else {
    throw new Error(`Resposta inválida: ${resposta}`);
  }
  return eventos;
}

export function jogarCarta(st, j, cartaId, ctx) {
  if (st.fim) throw new Error('A mão já acabou');
  if (st.pedido) throw new Error('Responda o truco primeiro');
  if (st.vez !== j) throw new Error('Não é sua vez');
  const i = st.maos[j].findIndex((c) => c.id === cartaId);
  if (i < 0) throw new Error('Carta não está na mão');
  const [carta] = st.maos[j].splice(i, 1);
  st.mesa.push({ jogador: j, carta });
  const eventos = [{ tipo: 'OnCartaJogada', jogador: j, carta }];
  if (st.mesa.length < 2) {
    st.vez = outro(j);
    return eventos;
  }

  const [a, b] = st.mesa;
  const cmp = comparar(a.carta, b.carta, ctx);
  let vencedor = cmp > 0 ? a.jogador : cmp < 0 ? b.jogador : 'empate';
  let empateConvertido = false;
  if (vencedor === 'empate' && ctx.resolverEmpate) {
    const r = ctx.resolverEmpate(a, b);
    if (r === 0 || r === 1) {
      vencedor = r;
      empateConvertido = true;
    }
  }
  const cartas = [];
  cartas[a.jogador] = a.carta;
  cartas[b.jogador] = b.carta;
  const vaza = { indice: st.vazas.length, cartas, iniciador: st.iniciadorVaza, vencedor, empateConvertido };
  st.vazas.push(vaza);
  st.mesa = [];
  eventos.push({ tipo: 'OnVazaResolvida', vaza });
  // Quem vence a vaza abre a próxima; se cangou, quem abriu abre de novo.
  if (vencedor !== 'empate') st.iniciadorVaza = vencedor;
  st.vez = st.iniciadorVaza;

  const r = resolverMao(st.vazas.map((v) => v.vencedor), st.numVazas);
  if (r.fim) eventos.push(encerrar(st, r.vencedor));
  return eventos;
}
