import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMao, jogarCarta, pedirTruco, responderTruco, quemResponde } from '../src/core/truco.js';
import { sinalDaMao, SINAIS } from '../src/core/ai.js';
import { PartidaDupla } from '../src/core/partidaDupla.js';
import { carregarDados } from './helpers.js';

const dados = carregarDados();
const k = (rank, suit) => ({ id: `${rank}${suit}`, rank, suit });
const vira = k('4', 'copas'); // manilha: 5
const ctx = { vira };

test('dupla: a maior carta leva a vaza para o time de quem jogou', () => {
  const st = criarMao({ maos: [[k('7', 'ouros')], [k('K', 'paus')], [k('3', 'ouros')], [k('2', 'paus')]], vira, numVazas: 1 });
  jogarCarta(st, 0, '7ouros', ctx);
  jogarCarta(st, 1, 'Kpaus', ctx);
  jogarCarta(st, 2, '3ouros', ctx);
  const ev = jogarCarta(st, 3, '2paus', ctx);
  const vaza = ev.find((e) => e.tipo === 'OnVazaResolvida').vaza;
  assert.equal(vaza.vencedor, 0);
  assert.equal(vaza.autor, 2);
  assert.equal(st.vencedor, 0);
});

test('dupla: maior carta empatada entre os dois times cangou; empate no mesmo time não', () => {
  const st = criarMao({ maos: [[k('3', 'ouros'), k('6', 'ouros')], [k('3', 'paus'), k('6', 'paus')], [k('7', 'copas'), k('A', 'copas')], [k('Q', 'espadas'), k('A', 'espadas')]], vira, numVazas: 3 });
  jogarCarta(st, 0, '3ouros', ctx);
  jogarCarta(st, 1, '3paus', ctx);
  jogarCarta(st, 2, '7copas', ctx);
  let ev = jogarCarta(st, 3, 'Qespadas', ctx);
  assert.equal(ev.find((e) => e.tipo === 'OnVazaResolvida').vaza.vencedor, 'empate');
  assert.equal(st.vez, 0, 'cangou: quem abriu abre de novo');
});

test('dupla: truco é por time — você responde pelo seu time', () => {
  const st = criarMao({ maos: [[k('7', 'ouros')], [k('K', 'paus')], [k('3', 'ouros')], [k('2', 'paus')]], vira, iniciante: 1 });
  pedirTruco(st, 1);
  assert.equal(st.pedido.por, 1);
  assert.equal(quemResponde(st), 0);
  responderTruco(st, 0, 'aumentar');
  assert.equal(st.pedido.por, 0);
  assert.equal(quemResponde(st), 1);
  assert.throws(() => responderTruco(st, 2, 'aceitar'), /Não há truco/);
});

test('sinais: zap pisca, sem manilha nem três fecha os olhos', () => {
  assert.equal(sinalDaMao([k('4', 'copas'), k('5', 'paus')], ctx), 'zap');
  assert.equal(sinalDaMao([k('5', 'ouros'), k('7', 'paus')], ctx), 'picafumo');
  assert.equal(sinalDaMao([k('3', 'ouros'), k('7', 'paus')], ctx), 'tres');
  assert.equal(sinalDaMao([k('Q', 'ouros'), k('7', 'paus')], ctx), 'nada');
  assert.ok(SINAIS.zap.forca > SINAIS.nada.forca);
});

test('partida em dupla vai até 12 tentos sem travar', () => {
  const perfil = dados.perfisPorId.mesa_fundo;
  for (let s = 0; s < 40; s++) {
    const p = new PartidaDupla({ seed: `DU${s}`, perfis: { 1: perfil, 2: perfil, 3: perfil } });
    let passos = 0;
    while (p.fase !== 'fim' && passos++ < 4000) {
      if (p.fase === 'fimMao') p.proximaMao();
      else if (p.iaPrecisaAgir()) p.passoIA();
      else if (p.mao.pedido) p.responder('aceitar');
      else p.jogar(p.mao.maos[0][0].id);
    }
    assert.equal(p.fase, 'fim', `seed DU${s} travou`);
    assert.ok(p.placar[p.vencedor] >= 12);
  }
});
