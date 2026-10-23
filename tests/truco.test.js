import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverMao, criarMao, jogarCarta, pedirTruco, responderTruco, podePedirTruco, proximoValor } from '../src/core/truco.js';
import { c, o } from './helpers.js';

const E = 'empate';

test('resolverMao: quem faz 2 vazas vence', () => {
  assert.deepEqual(resolverMao([0, 0]), { fim: true, vencedor: 0 });
  assert.deepEqual(resolverMao([1, 0, 1]), { fim: true, vencedor: 1 });
  assert.deepEqual(resolverMao([0]), { fim: false, vencedor: null });
  assert.deepEqual(resolverMao([0, 1]), { fim: false, vencedor: null });
});

test('resolverMao: cangou a 1ª → vence quem ganhar a 2ª', () => {
  assert.deepEqual(resolverMao([E, 1]), { fim: true, vencedor: 1 });
  assert.deepEqual(resolverMao([E, 0]), { fim: true, vencedor: 0 });
});

test('resolverMao: ganhou a 1ª e cangou a 2ª → vence quem ganhou a 1ª', () => {
  assert.deepEqual(resolverMao([1, E]), { fim: true, vencedor: 1 });
});

test('resolverMao: 1x1 e cangou a 3ª → vence quem ganhou a 1ª', () => {
  assert.deepEqual(resolverMao([0, 1, E]), { fim: true, vencedor: 0 });
});

test('resolverMao: cangou duas e decide na 3ª; cangou as três → ninguém', () => {
  assert.deepEqual(resolverMao([E, E]), { fim: false, vencedor: null });
  assert.deepEqual(resolverMao([E, E, 1]), { fim: true, vencedor: 1 });
  assert.deepEqual(resolverMao([E, E, E]), { fim: true, vencedor: null });
});

test('resolverMao com 4 vazas precisa de 3', () => {
  assert.deepEqual(resolverMao([0, 0], 4), { fim: false, vencedor: null });
  assert.deepEqual(resolverMao([0, 0, 0], 4), { fim: true, vencedor: 0 });
  assert.deepEqual(resolverMao([0, 1, 0, 1], 4), { fim: true, vencedor: 0 });
  assert.deepEqual(resolverMao([0, 0, 1, 1], 4), { fim: true, vencedor: 0 });
  assert.deepEqual(resolverMao([1, 0, 0, E], 4), { fim: true, vencedor: 0 });
});

test('escalada do truco: 1 → 3 → 6 → 9 → 12', () => {
  assert.equal(proximoValor(1), 3);
  assert.equal(proximoValor(3), 6);
  assert.equal(proximoValor(9), 12);
  assert.equal(proximoValor(12), null);
});

function maoExemplo(opts = {}) {
  return criarMao({
    maos: [[c('3', 'paus'), c('A', 'paus'), c('4', 'paus')], [o('2', 'copas'), o('K', 'copas'), o('5', 'copas')]],
    vira: c('7', 'ouros'),
    ...opts,
  });
}
const ctx = { vira: c('7', 'ouros') };

test('aceitar truco muda o valor da mão', () => {
  const st = maoExemplo();
  pedirTruco(st, 0);
  responderTruco(st, 1, 'aceitar');
  assert.equal(st.valor, 3);
  assert.equal(st.pedido, null);
});

test('ninguém pode aumentar duas vezes seguidas', () => {
  const st = maoExemplo();
  pedirTruco(st, 0);
  responderTruco(st, 1, 'aceitar');
  assert.equal(podePedirTruco(st, 0), false, 'quem pediu não pede de novo');
  assert.throws(() => pedirTruco(st, 0));
});

test('aumentar devolve o pedido; correr dá ao outro o valor já aceito', () => {
  const st = maoExemplo();
  pedirTruco(st, 0); // pede 3
  responderTruco(st, 1, 'aumentar'); // aceita 3 e pede 6
  assert.equal(st.valor, 3);
  assert.deepEqual(st.pedido, { por: 1, jogador: 1, valor: 6 });
  responderTruco(st, 0, 'correr');
  assert.ok(st.fim);
  assert.equal(st.vencedor, 1);
  assert.equal(st.pontos, 3);
});

test('correr do primeiro truco dá 1 ponto', () => {
  const st = maoExemplo();
  pedirTruco(st, 0);
  responderTruco(st, 1, 'correr');
  assert.equal(st.vencedor, 0);
  assert.equal(st.pontos, 1);
});

test('não pode jogar com truco pendente nem fora da vez', () => {
  const st = maoExemplo();
  assert.throws(() => jogarCarta(st, 1, 'o-2copas', ctx), /vez/);
  pedirTruco(st, 0);
  assert.throws(() => jogarCarta(st, 0, 'c-3paus', ctx), /truco/);
});

test('não passa de 12', () => {
  const st = maoExemplo();
  pedirTruco(st, 0);
  responderTruco(st, 1, 'aumentar'); // 6
  responderTruco(st, 0, 'aumentar'); // 9
  responderTruco(st, 1, 'aumentar'); // 12
  assert.deepEqual(st.pedido, { por: 1, jogador: 1, valor: 12 });
  assert.throws(() => responderTruco(st, 0, 'aumentar'));
  responderTruco(st, 0, 'aceitar');
  assert.equal(st.valor, 12);
  assert.equal(podePedirTruco(st, 0), false);
});

test('mão completa: vencedor da vaza abre a próxima e a mão termina', () => {
  const st = maoExemplo();
  jogarCarta(st, 0, 'c-3paus', ctx);
  jogarCarta(st, 1, 'o-2copas', ctx); // 3 > 2
  assert.equal(st.vazas[0].vencedor, 0);
  assert.equal(st.vez, 0);
  jogarCarta(st, 0, 'c-Apaus', ctx);
  jogarCarta(st, 1, 'o-Kcopas', ctx);
  assert.ok(st.fim);
  assert.equal(st.vencedor, 0);
  assert.equal(st.pontos, 1);
});

test('cangada mantém quem abriu', () => {
  const st = criarMao({ maos: [[c('3', 'paus'), c('4', 'paus')], [o('3', 'copas'), o('5', 'copas')]], vira: c('7', 'ouros'), iniciante: 1 });
  jogarCarta(st, 1, 'o-3copas', ctx);
  jogarCarta(st, 0, 'c-3paus', ctx);
  assert.equal(st.vazas[0].vencedor, 'empate');
  assert.equal(st.vez, 1);
});

test('mão de truco desabilitado', () => {
  const st = maoExemplo({ trucoPermitido: false, valor: 3 });
  assert.equal(podePedirTruco(st, 0), false);
  assert.equal(st.valor, 3);
});
