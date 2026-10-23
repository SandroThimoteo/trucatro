// Motor puro de uma mão de truco: 1x1 (jogadores 0 e 1) ou em dupla 2x2 (jogadores 0 a 3).
// Na dupla, os lugares seguem a ordem da mesa: 0 você, 1 adversário, 2 seu parceiro, 3 adversário.
// O time de um jogador é j % 2: o time 0 é o seu. Vazas, truco e vencedor são sempre por time,
// então pedido.por, ultimoAumento, correu, vencedor e vaza.vencedor valem 0 ou 1 nos dois modos.
// O estado é JSON puro; o contexto de força (vira, regras) é passado em cada jogada.

import { comparar, forca } from './cards.js';

export const TRUCO_VALORES = [1, 3, 6, 9, 12];

export function proximoValor(valor, valores = TRUCO_VALORES) {
  return valores[valores.indexOf(valor) + 1] ?? null;
}

export const timeDe = (j) => j % 2;
const proximo = (st, j) => (j + 1) % st.maos.length;

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
    jogadores: maos.length,
    vira,
    numVazas,
    valores,
    vazas: [],
    mesa: [], // cartas da vaza em andamento: { jogador, carta }
    vez: iniciante,
    iniciadorVaza: iniciante,
    valorInicial: valor,
    valor,
    pedido: null, // { por (time), valor, jogador (quem pediu) }
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
  return !st.fim && st.trucoPermitido && !st.pedido && st.vez === j && st.ultimoAumento !== timeDe(j)
    && proximoValor(st.valor, st.valores) !== null;
}

export function podeAumentar(st, j) {
  return !!st.pedido && st.pedido.por !== timeDe(j) && proximoValor(st.pedido.valor, st.valores) !== null;
}

// Na dupla, quem responde pelo outro time: você responde pelo seu time; do outro lado, o
// adversário sentado logo depois de quem pediu.
export function quemResponde(st) {
  if (!st.pedido) return null;
  if (st.pedido.por === 1) return 0;
  return st.jogadores === 4 ? proximo(st, st.pedido.jogador) | 1 : 1;
}

export function pedirTruco(st, j) {
  if (!podePedirTruco(st, j)) throw new Error('Não dá pra pedir truco agora');
  st.pedido = { por: timeDe(j), jogador: j, valor: proximoValor(st.valor, st.valores) };
  return [{ tipo: 'OnTrucoPedido', jogador: j, time: timeDe(j), valor: st.pedido.valor }];
}

// Aumentar aceita o pedido atual e devolve um pedido maior para o outro.
// Correr dá ao outro o valor que já estava aceito.
export function responderTruco(st, j, resposta) {
  if (!st.pedido || st.pedido.por === timeDe(j)) throw new Error('Não há truco para responder');
  const { por, valor } = st.pedido;
  const meuTime = timeDe(j);
  const eventos = [];
  if (resposta === 'aceitar') {
    st.valor = valor;
    st.ultimoAumento = por;
    st.pedido = null;
    eventos.push({ tipo: 'OnTrucoRespondido', jogador: j, time: meuTime, resposta, valor });
  } else if (resposta === 'correr') {
    st.pedido = null;
    st.correu = meuTime;
    eventos.push({ tipo: 'OnTrucoRespondido', jogador: j, time: meuTime, resposta, valor: st.valor });
    eventos.push(encerrar(st, por));
  } else if (resposta === 'aumentar') {
    if (!podeAumentar(st, j)) throw new Error('Não dá pra aumentar mais');
    st.valor = valor;
    st.ultimoAumento = por;
    st.pedido = { por: meuTime, jogador: j, valor: proximoValor(valor, st.valores) };
    eventos.push({ tipo: 'OnTrucoRespondido', jogador: j, time: meuTime, resposta, valor: st.pedido.valor });
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
  if (st.mesa.length < st.jogadores) {
    st.vez = proximo(st, j);
    return eventos;
  }
  if (st.jogadores === 4) return [...eventos, ...fecharVazaDupla(st, ctx)];

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

// Dupla: a maior carta da mesa leva a vaza para o time de quem jogou. Se a maior carta empata
// entre os dois times, cangou. Quem fez a vaza abre a próxima; se cangou, quem abriu abre de novo.
function fecharVazaDupla(st, ctx) {
  const eventos = [];
  const fs = st.mesa.map((m) => ({ ...m, f: forcaDe(m.carta, ctx) }));
  const maior = Math.max(...fs.map((x) => x.f));
  const topo = fs.filter((x) => x.f === maior);
  const times = new Set(topo.map((x) => timeDe(x.jogador)));
  let vencedor = times.size === 1 ? timeDe(topo[0].jogador) : 'empate';
  let empateConvertido = false;
  if (vencedor === 'empate' && ctx.resolverEmpate) {
    const meu = topo.find((x) => timeDe(x.jogador) === 0);
    const deles = topo.find((x) => timeDe(x.jogador) === 1);
    const r = ctx.resolverEmpate(meu, deles);
    if (r === 0 || r === 1) {
      vencedor = r;
      empateConvertido = true;
    }
  }
  const cartas = [];
  for (const m of st.mesa) cartas[m.jogador] = m.carta;
  const autor = vencedor === 'empate' ? null : topo.find((x) => timeDe(x.jogador) === vencedor).jogador;
  const vaza = { indice: st.vazas.length, cartas, iniciador: st.iniciadorVaza, vencedor, empateConvertido, autor };
  st.vazas.push(vaza);
  st.mesa = [];
  eventos.push({ tipo: 'OnVazaResolvida', vaza });
  if (autor !== null) st.iniciadorVaza = autor;
  st.vez = st.iniciadorVaza;
  const r = resolverMao(st.vazas.map((v) => v.vencedor), st.numVazas);
  if (r.fim) eventos.push(encerrar(st, r.vencedor));
  return eventos;
}

const forcaDe = (carta, ctx) => forca(carta, ctx);
