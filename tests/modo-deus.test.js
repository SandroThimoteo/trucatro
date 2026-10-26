import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jogo } from '../src/core/run.js';
import { carregarDados } from './helpers.js';

const dados = carregarDados();

function naMesa(seed, jogador = 'chico_baralho') {
  const j = Jogo.novaRun(dados, { seed, jogador });
  j.run.evento = null;
  j.iniciarMesa();
  if (j.rodada.fase === 'vira') j.escolherVira(0);
  return j;
}

// Joga a Mesa atual até o fim: corre de todo truco, nunca pede, joga sempre a primeira carta.
function jogarMesaCorrendo(j, maxPassos = 20000) {
  const r = j.run;
  let passos = 0;
  let maosPerdidas = 0;
  while (r.fase === 'mesa' && passos++ < maxPassos) {
    const rd = j.rodada;
    if (rd.fase === 'vira') j.escolherVira(0);
    else if (rd.fase === 'troca') {
      if (j.podeAbrirParaIA()) j.comecarRodada();
      else j.jogarCarta(r.mesa.mao[0]);
    } else if (rd.fase === 'jogo') {
      const st = rd.mao;
      if (j.iaPrecisaAgir()) j.passoIA();
      else if (st.pedido && st.pedido.por === 1) j.responderTruco('correr');
      else j.jogarCarta(st.maos[0][0].id);
    } else if (rd.fase === 'fim') {
      if (!rd.resultado.venceu) maosPerdidas++;
      assert.equal(r.mesa.tentosAdv, 0, 'tentos ficam em 0');
      assert.ok(r.mesa.maosRestantes >= 1, 'mãos nunca acabam');
      j.proximaMao();
    }
  }
  return { passos, maosPerdidas };
}

test('modo Deus: adminModoDeus liga/desliga e marca a run como testada', () => {
  const j = Jogo.novaRun(dados, { seed: 'DEUS-0' });
  assert.equal(j.modoDeus, false);
  j.adminModoDeus(true);
  assert.equal(j.modoDeus, true);
  assert.equal(j.run.testada, true);
  j.adminModoDeus(false);
  assert.equal(j.modoDeus, false);
});

test('modo Deus: a Mesa nunca termina em derrota, mesmo com 1 mão e correndo de todo truco', () => {
  let perdeuMaos = 0;
  for (let i = 0; i < 8; i++) {
    const j = naMesa(`DEUS-${i}`);
    j.adminModoDeus(true);
    j.adminValores({ maos: 1 });
    const { maosPerdidas } = jogarMesaCorrendo(j);
    perdeuMaos += maosPerdidas;
    assert.notEqual(j.run.fase, 'derrota');
    assert.equal(j.run.resultadoMesa?.venceu, true, 'termina vencida');
    assert.equal(j.run.mesa.tentosAdv, 0);
    assert.equal(j.run.testada, true);
  }
  assert.ok(perdeuMaos > 0, 'ainda dá para perder mãos (sem pontos)');
});

test('modo Deus: poderes que custam tento e a Pendura não dão tentos nem derrota', () => {
  const j = naMesa('DEUS-PODER', 'ze_fiado');
  j.adminModoDeus(true);
  j.adminValores({ tentos: 11 });
  j.usarPoder(); j.usarPoder(); // os 2 usos da Pendura (cada um daria +1 tento)
  assert.equal(j.run.mesa.tentosAdv, 11);
  assert.equal(j.run.fase, 'mesa');

  const c = naMesa('DEUS-PODER2', 'dona_gloria');
  c.adminModoDeus(true);
  c.adminValores({ tentos: 11 });
  c.run.mesa.poderUsos = 99; // sem usos grátis: custa 1 tento
  c.usarPoder();
  assert.equal(c.run.mesa.tentosAdv, 11);
  assert.equal(c.run.fase, 'mesa');
});

test('modo Deus desligado: tudo volta ao normal (Pendura com 11 tentos perde a Mesa)', () => {
  const j = naMesa('DEUS-OFF', 'ze_fiado');
  j.adminModoDeus(true);
  j.adminModoDeus(false);
  j.adminValores({ tentos: 11 });
  j.usarPoder();
  assert.equal(j.run.fase, 'derrota');
  assert.equal(j.run.resultadoMesa.motivo, 'tentos');
});
