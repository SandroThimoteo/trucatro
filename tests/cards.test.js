import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANKS, SUITS, manilhaRank, comparar, forca, isManilha, isZap, baralhoPadrao } from '../src/core/cards.js';
import { c } from './helpers.js';

test('baralho tem 40 cartas, sem 8, 9, 10', () => {
  const b = baralhoPadrao();
  assert.equal(b.length, 40);
  assert.ok(!b.some((x) => ['8', '9', '10'].includes(x.rank)));
  assert.equal(new Set(b.map((x) => x.id)).size, 40);
});

test('ordem das cartas comuns: 4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3', () => {
  const ctx = { vira: c('4', 'ouros') }; // manilha = 5, então testa sem o 5
  const ordem = ['6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
  for (let i = 1; i < ordem.length; i++) {
    assert.equal(comparar(c(ordem[i], 'copas'), c(ordem[i - 1], 'paus'), ctx), 1, `${ordem[i]} > ${ordem[i - 1]}`);
  }
  assert.equal(comparar(c('6', 'paus'), c('4', 'copas'), ctx), 1);
});

test('manilha é a carta seguinte à vira, para todas as 10 viras', () => {
  const esperado = { 4: '5', 5: '6', 6: '7', 7: 'Q', Q: 'J', J: 'K', K: 'A', A: '2', 2: '3', 3: '4' };
  for (const r of RANKS) assert.equal(manilhaRank(c(r, 'ouros')), esperado[r], `vira ${r}`);
});

test('manilhas vencem qualquer carta comum, para todas as viras', () => {
  for (const vr of RANKS) {
    const ctx = { vira: c(vr, 'copas') };
    const mr = manilhaRank(ctx.vira);
    for (const r of RANKS.filter((x) => x !== mr)) {
      for (const s of SUITS) assert.equal(comparar(c(mr, 'ouros'), c(r, s), ctx), 1);
    }
  }
});

test('manilhas por naipe: Ouros < Espadas < Copas < Paus (Zap)', () => {
  const ctx = { vira: c('7', 'copas') }; // manilha = Q
  const [pf, esp, cop, zap] = SUITS.map((s) => c('Q', s));
  assert.equal(comparar(esp, pf, ctx), 1);
  assert.equal(comparar(cop, esp, ctx), 1);
  assert.equal(comparar(zap, cop, ctx), 1);
  assert.ok(isZap(zap, ctx));
  assert.ok(!isZap(cop, ctx));
});

test('cartas comuns de mesmo valor empatam', () => {
  const ctx = { vira: c('4', 'ouros') };
  assert.equal(comparar(c('3', 'paus'), c('3', 'copas'), ctx), 0);
});

test('ordem invertida (Seu Lunático): 4 vence 3, manilha continua no topo', () => {
  const ctx = { vira: c('K', 'ouros'), invertida: true }; // manilha = A
  assert.equal(comparar(c('4', 'paus'), c('3', 'paus'), ctx), 1);
  assert.equal(comparar(c('A', 'ouros'), c('4', 'paus'), ctx), 1);
});

test('manilha extra e zap alias (Comparsas) entram na ordem certa', () => {
  const vira = c('7', 'ouros'); // manilha = Q
  const ctx = {
    vira,
    extraManilha: (x) => x.suit === 'ouros' && x.rank === '3',
    zapAlias: (x) => x.suit === 'espadas' && x.rank === 'Q',
  };
  assert.ok(isManilha(c('3', 'ouros'), ctx));
  assert.equal(comparar(c('Q', 'ouros'), c('3', 'ouros'), ctx), 1);
  assert.ok(forca(c('3', 'ouros'), ctx) > forca(c('3', 'paus'), ctx));
  assert.ok(isZap(c('Q', 'espadas'), ctx));
  assert.equal(comparar(c('Q', 'espadas'), c('Q', 'paus'), ctx), 0);
});
