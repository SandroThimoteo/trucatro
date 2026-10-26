// Pipeline de pontuação. Cada etapa registra um "passo" para a UI animar.
// Vaza: Fichas base → Jogada → Cangada anterior → Melhorias/Selos → Comparsas (+Fichas, +Mult, ×Mult) → Chefão.
// Mão: soma das vazas → bônus de mão → Comparsas de mão → × valor do truco.

import { comparar, forca, isManilha, isZap } from './cards.js';
import { aplicarFase } from './comparsas.js';

export function valoresJogada(dados, niveis, id) {
  const j = dados.jogadas[id];
  const n = (niveis?.[id] ?? 1) - 1;
  return {
    nome: j.nome,
    fichas: j.fichas + n * j.fichasPorNivel,
    mult: j.mult + n * j.multPorNivel,
    multProxima: (j.multProxima ?? 0) + n * (j.multProximaPorNivel ?? 0),
  };
}

export function fichasBase(carta, ctxForca, dados) {
  if (isZap(carta, ctxForca)) return dados.cartas.fichasZap;
  if (isManilha(carta, ctxForca)) return dados.cartas.fichasManilha;
  return dados.cartas.fichasCarta[carta.rank];
}

// maoAntes: cartas que o jogador tinha quando escolheu esta carta.
export function identificarJogada({ carta, cartaAdv, maoAntes, ctx, empateConvertido }) {
  if (empateConvertido) return 'cangada';
  if (isZap(carta, ctx)) return 'zapada';
  if (isManilha(carta, ctx)) return 'manilhada';
  const vencedoras = maoAntes.filter((c) => comparar(c, cartaAdv, ctx) > 0);
  if (vencedoras.length > 1) {
    const maisFraca = Math.min(...vencedoras.map((c) => forca(c, ctx)));
    if (forca(carta, ctx) === maisFraca) return 'matar_seco';
  }
  return 'vaza_simples';
}

export class ScoreContext {
  constructor(base) {
    Object.assign(this, base);
    this.fichas = 0;
    this.mult = 0;
    this.passos = [];
    this.reis = 0;
  }

  registrar(tipo, valor, origem, comparsa) {
    this.passos.push({ tipo, valor, origem, comparsa: comparsa ?? null, fichas: this.fichas, mult: this.mult });
  }

  addFichas(v, origem, comparsa) {
    if (!v) return;
    this.fichas += v;
    this.registrar('fichas', v, origem, comparsa);
  }

  addMult(v, origem, comparsa) {
    if (!v) return;
    this.mult += v;
    this.registrar('mult', v, origem, comparsa);
  }

  mulMult(v, origem, comparsa) {
    if (v === 1) return;
    this.mult = Math.round(this.mult * v * 100) / 100;
    this.registrar('xmult', v, origem, comparsa);
  }

  get total() {
    return Math.floor(this.fichas * this.mult);
  }
}

// pessoa: personagem da Mesa (chefão ou não), com nome e regras (manha). "chefao" é o nome antigo.
export function pontuarVaza({ dados, carta, jogada, ctxForca, niveis, comparsas = [], pessoa = null, chefao = pessoa, bonusMult = 0, xMultFinal = null, info = {} }) {
  const ctx = new ScoreContext({
    fase: 'vaza', carta, jogada,
    manilha: isManilha(carta, ctxForca),
    zap: isZap(carta, ctxForca),
    vazaIndice: 0, vazasVencidasAntes: 0, maoIndice: 0, causosUsados: 0,
    ...info,
  });
  const vezes = carta.selo === 'vermelho' ? 2 : 1;
  const base = fichasBase(carta, ctxForca, dados) + (carta.bonusFichas || 0);
  for (let k = 0; k < vezes; k++) ctx.addFichas(base, k ? 'Selo Vermelho' : 'Carta');

  const vj = valoresJogada(dados, niveis, jogada);
  ctx.addFichas(vj.fichas, vj.nome);
  ctx.addMult(vj.mult, vj.nome);
  if (bonusMult) ctx.addMult(bonusMult, 'Cangada anterior');

  // Manha da Mesa (personagem): bônus antes das melhorias e dos Comparsas
  const rm = chefao?.regras ?? {};
  if (rm.fichasPorVaza) ctx.addFichas(rm.fichasPorVaza, chefao.nome);
  if (rm.naipeBonus?.naipe === carta.suit) {
    if (rm.naipeBonus.fichas) ctx.addFichas(rm.naipeBonus.fichas, chefao.nome);
    if (rm.naipeBonus.mult) ctx.addMult(rm.naipeBonus.mult, chefao.nome);
  }

  const mel = carta.melhoria ? dados.cartas.melhorias[carta.melhoria] : null;
  for (let k = 0; k < vezes && mel; k++) {
    if (mel.xmult) ctx.mulMult(mel.xmult, mel.nome);
    if (mel.reis) ctx.reis += mel.reis;
  }

  for (const fase of ['fichas', 'mult', 'xmult']) aplicarFase(ctx, fase, comparsas, dados);
  // Poder do personagem (Reza Forte): multiplica no fim, depois dos Comparsas
  if (xMultFinal) ctx.mulMult(xMultFinal.valor, xMultFinal.origem);

  let fator = 1;
  if (rm.naipeAnulado === carta.suit) {
    fator = 0;
    ctx.registrar('anula', 0, chefao.nome);
  } else if (rm.naipeFator?.naipe === carta.suit) {
    fator = rm.naipeFator.fator;
    ctx.registrar('metade', fator, chefao.nome);
  } else if (rm.manilhadaMetade && jogada === 'manilhada') {
    fator = 0.5;
    ctx.registrar('metade', 0.5, chefao.nome);
  }
  ctx.totalFinal = Math.floor(ctx.total * fator);
  return ctx;
}

export class MaoContext {
  constructor(base) {
    Object.assign(this, base);
    this.total = 0;
    this.passos = [];
  }

  somar(v, origem, extra = {}) {
    this.total += v;
    this.passos.push({ tipo: 'soma', valor: v, origem, total: this.total, ...extra });
  }

  multiplicar(x, origem, comparsa) {
    this.total = Math.floor(this.total * x);
    this.passos.push({ tipo: 'x', valor: x, origem, comparsa: comparsa ?? null, total: this.total });
  }
}

export function pontuarMao({ dados, niveis, vazas, bonus = [], valor = 1, comparsas = [], info = {} }) {
  const ctx = new MaoContext({ fase: 'mao', aumentos: 0, ...info });
  ctx.somar(vazas.reduce((s, v) => s + v.total, 0), 'Rodadas');
  for (const id of bonus) {
    const vj = valoresJogada(dados, niveis, id);
    ctx.somar(vj.fichas * vj.mult, vj.nome, { fichas: vj.fichas, mult: vj.mult });
  }
  aplicarFase(ctx, 'mao', comparsas, dados);
  if (valor !== 1) ctx.multiplicar(valor, `Truco valendo ${valor}`);
  return ctx;
}
