import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jogo } from '../src/core/run.js';
import { carregarDados } from './helpers.js';

const dados = carregarDados();
const chave = (it) => (it.tipo === 'carta' ? null : `${it.tipo}:${it.id}`);

function noBoteco(seed) {
  const j = Jogo.novaRun(dados, { seed });
  j.run.fase = 'recompensa';
  j.run.reis = 999;
  j.irAoBoteco();
  return j;
}

test('loja nunca oferece o mesmo item duas vezes, nem Comparsa que você já tem', () => {
  for (let i = 0; i < 300; i++) {
    const j = Jogo.novaRun(dados, { seed: `L${i}` });
    j.adicionarComparsa('pinga_da_casa');
    j.adicionarComparsa('sanfoneiro');
    j.run.fase = 'recompensa';
    j.irAoBoteco();
    const ks = j.run.loja.itens.map(chave).filter(Boolean);
    assert.equal(new Set(ks).size, ks.length, `repetiu na seed L${i}: ${ks}`);
    assert.ok(!j.run.loja.itens.some((it) => it.tipo === 'comparsa' && ['pinga_da_casa', 'sanfoneiro'].includes(it.id)));
  }
});

test('"Outras ofertas" troca tudo o que dá para trocar', () => {
  for (let i = 0; i < 200; i++) {
    const j = noBoteco(`RR${i}`);
    const antes = new Set(j.run.loja.itens.map(chave).filter(Boolean));
    j.reroll();
    const depois = j.run.loja.itens.map(chave).filter(Boolean);
    assert.ok(!depois.some((k) => antes.has(k)), `seed RR${i} repetiu oferta`);
  }
});

test('Promessa de Comparsa repetido ou sem espaço vira réis (nunca some)', () => {
  const j = Jogo.novaRun(dados, { seed: 'PROM' });
  j.run.promessa = { tipo: 'comparsa', id: 'pinga_da_casa', descricao: 'Comparsa grátis: Pinga da Casa' };
  j.adicionarComparsa('pinga_da_casa');
  const reis = j.run.reis;
  j.pularMesa();
  assert.equal(j.run.comparsas.filter((c) => c.id === 'pinga_da_casa').length, 1);
  assert.equal(j.run.ultimaPromessa.tipo, 'reis');
  assert.ok(j.run.reis > reis);

  const k = Jogo.novaRun(dados, { seed: 'PROM2' });
  k.run.consumiveis = [{ tipo: 'causo', id: 'causo_fogo' }, { tipo: 'causo', id: 'causo_lacre' }];
  k.run.promessa = { tipo: 'simpatia', id: 'simpatia_arruda', descricao: 'Simpatia da Arruda' };
  const r2 = k.run.reis;
  k.pularMesa();
  assert.equal(k.run.consumiveis.length, 2);
  assert.ok(k.run.reis > r2);
});

test('textos do jogo falam "rodada", não "vaza"', () => {
  const textos = JSON.stringify([dados.comparsas, dados.causos, dados.simpatias, dados.jogadasLista.map((j) => [j.nome, j.descricao]), dados.personagens.map((p) => [p.regra, p.detalhe, p.bio, p.falas]), dados.cartas, dados.bazar]);
  assert.ok(!/\bvazas?\b/i.test(textos.replace(/"vaza_simples"|"tipo":"vaza"/g, '')), 'ainda tem "vaza" em algum texto');
});

test('nunca aparece a mesma carta duas vezes na mesa (sua mão, vira e mão do adversário)', async () => {
  const { jogarRunComBot } = await import('./helpers.js');
  const vis = (c) => `${c.rank}${c.suit}`;
  let maos = 0;
  const orig = Jogo.prototype.novaRodada;
  const origTrocar = Jogo.prototype.trocar;
  const checar = (j) => {
    const rd = j.rodada;
    const minhas = j.run.mesa.mao.map((id) => vis(j.carta(id)));
    const todas = [...minhas, ...rd.viras.map(vis), ...rd.maoAdv.map(vis), ...(rd.maoParceiro ?? []).map(vis), ...(rd.maoAdv2 ?? []).map(vis)];
    assert.equal(new Set(todas).size, todas.length, `carta repetida: ${todas}`);
    maos++;
  };
  Jogo.prototype.novaRodada = function (...a) { const x = orig.apply(this, a); checar(this); return x; };
  Jogo.prototype.trocar = function (...a) { const x = origTrocar.apply(this, a); checar(this); return x; };
  try {
    for (let i = 0; i < 60; i++) jogarRunComBot(dados, `DUP${i}`);
  } finally {
    Jogo.prototype.novaRodada = orig;
    Jogo.prototype.trocar = origTrocar;
  }
  assert.ok(maos > 200);
});

test('todo Chefão tem cena de entrada com 3 falas e cenário 3D', async () => {
  const { existsSync } = await import('node:fs');
  for (const ch of dados.personagens.filter((p) => p.tipo === 'chefao')) {
    assert.equal(ch.falas.intro?.length, 3, ch.id);
    assert.ok(existsSync(new URL(`../assets/cenarios/chefe_${ch.id}.jpg`, import.meta.url)), `falta cenário de ${ch.id}`);
  }
  for (const it of dados.bazar.itens.filter((i) => i.categoria === 'cenario' && i.imagem)) {
    assert.ok(existsSync(new URL(`../assets/cenarios/${it.imagem}.jpg`, import.meta.url)), it.id);
  }
});
