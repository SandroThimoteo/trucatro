import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jogo } from '../src/core/run.js';
import { carregarDados } from './helpers.js';
import { manilhaRank } from '../src/core/cards.js';
import { pontuarVaza } from '../src/core/scoring.js';

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

// ---------- cartas OP e Mult absurdo ----------

const vis = (c) => `${c.rank}${c.suit}`;

function conferirMaoDeus(j) {
  const rd = j.rodada;
  const mr = manilhaRank(rd.vira);
  const minhas = j.run.mesa.mao.map((id) => j.carta(id));
  for (const suit of ['paus', 'copas', 'espadas']) {
    assert.ok(minhas.some((c) => c.rank === mr && c.suit === suit), `tem a manilha de ${suit}`);
  }
  // regra de não repetir carta
  const todas = [...minhas, ...rd.viras, ...rd.maoAdv, ...(rd.maoParceiro ?? []), ...(rd.maoAdv2 ?? [])].map(vis);
  assert.equal(new Set(todas).size, todas.length, `carta repetida: ${todas}`);
}

test('modo Deus: toda mão vem com Zap, Copas e Espadilha da vira, sem repetir carta, e o baralho da run não muda', () => {
  for (let i = 0; i < 10; i++) {
    const j = naMesa(`DEUS-OP-${i}`);
    const baralho = JSON.stringify(j.run.deck);
    j.adminModoDeus(true); // já vale para a mão que ainda não começou
    conferirMaoDeus(j);
    if (j.run.mesa.trocasRestantes > 0) {
      j.trocar([j.run.mesa.mao[0]]);
      conferirMaoDeus(j);
    }
    // joga algumas mãos (aceitando truco) e confere cada mão nova
    const r = j.run;
    let passos = 0;
    while (r.fase === 'mesa' && passos++ < 2000) {
      const rd = j.rodada;
      if (rd.fase === 'vira') j.escolherVira(0);
      else if (rd.fase === 'troca') {
        conferirMaoDeus(j);
        if (j.podeAbrirParaIA()) j.comecarRodada();
        else j.jogarCarta(r.mesa.mao[0]);
      } else if (rd.fase === 'jogo') {
        const st = rd.mao;
        if (j.iaPrecisaAgir()) j.passoIA();
        else if (st.pedido && st.pedido.por === 1) j.responderTruco('aceitar');
        else j.jogarCarta(st.maos[0][0].id);
      } else j.proximaMao();
    }
    assert.equal(JSON.stringify(j.run.deck), baralho, 'baralho da run igual');
    for (const id of [...(r.mesa.compra ?? []), ...(r.mesa.descarte ?? [])]) assert.ok(!id.startsWith('deus-'));
  }
});

test('modo Deus: Embaralhada e Vira Virada mantêm a mão sem carta repetida e sem sujar o monte', () => {
  const j = naMesa('DEUS-EMB');
  j.adminModoDeus(true);
  j.comecarRodada();
  while (j.iaPrecisaAgir()) j.passoIA();
  if (j.rodada.mao && j.rodada.mao.vez === 0 && !j.rodada.mao.pedido) {
    j.usarPoder([j.rodada.mao.maos[0][0].id]);
    const m = j.run.mesa;
    assert.ok(m.mao.every((id) => j.carta(id)), 'toda carta da mão existe');
    assert.ok(!m.descarte.some((id) => id.startsWith('deus-')));
  }

  const g = naMesa('DEUS-VV', 'dona_gloria');
  g.adminModoDeus(true);
  const antes = g.rodada.vira;
  g.usarPoder();
  assert.notEqual(vis(g.rodada.vira), vis(antes));
  conferirMaoDeus(g);
});

test('modo Deus: rodada vencida ganha +50 Mult e ×10 no fim; uma mão vencida derruba até a Mesa do Rei do Truco', () => {
  for (let i = 0; i < 12; i++) {
    const j = Jogo.novaRun(dados, { seed: `DEUS-PTS-${i}` });
    j.run.evento = null;
    j.run.bairro = 8;
    j.run.mesaIdx = 2;
    j.adminModoDeus(true);
    j.iniciarMesa();
    const r = j.run;
    let maosVencidas = 0;
    let conferiu = false;
    let passos = 0;
    while (r.fase === 'mesa' && passos++ < 5000) {
      const rd = j.rodada;
      if (rd.fase === 'vira') j.escolherVira(0);
      else if (rd.fase === 'troca') {
        if (j.podeAbrirParaIA()) j.comecarRodada();
        else j.jogarCarta(r.mesa.mao[0]);
      } else if (rd.fase === 'jogo') {
        const st = rd.mao;
        if (j.iaPrecisaAgir()) j.passoIA();
        else if (st.pedido && st.pedido.por === 1) j.responderTruco('aceitar');
        else j.jogarCarta(st.maos[0][0].id);
        const v = rd.vazasPontuadas[0];
        if (v && !conferiu && !v.fuga) {
          conferiu = true;
          const fim = v.passos[v.passos.length - 1];
          assert.ok(v.passos.some((p) => p.tipo === 'mult' && p.valor === 50 && p.origem === 'Modo Deus'));
          assert.ok(v.passos.some((p) => p.tipo === 'xmult' && p.valor === 10 && p.origem === 'Modo Deus'));
          assert.ok(fim && Number.isFinite(v.total) && Number.isInteger(v.total));
          const sem = pontuarVaza({ dados, carta: v.carta, jogada: v.jogada, ctxForca: j.ctxForca(), niveis: r.niveis, comparsas: r.comparsas, pessoa: j.pessoa });
          assert.ok(v.total >= 10 * sem.totalFinal && v.total > sem.totalFinal, `${v.total} vs ${sem.totalFinal}`);
        }
      } else {
        if (rd.resultado.venceu) maosVencidas++;
        j.proximaMao();
      }
    }
    assert.ok(Number.isFinite(r.mesa.pontos) && Number.isInteger(r.mesa.pontos));
    assert.equal(r.resultadoMesa.venceu, true);
    assert.equal(maosVencidas, 0, 'a primeira mão vencida já fecha a Mesa');
  }
});

test('modo Deus desligado: a próxima mão volta ao normal (sem cartas temporárias nem bônus)', () => {
  const j = naMesa('DEUS-VOLTA');
  j.adminModoDeus(true);
  conferirMaoDeus(j);
  j.adminModoDeus(false);
  j.adminValores({ maos: 5 });
  // termina a mão atual correndo de truco ou jogando
  let passos = 0;
  while (j.rodada.fase !== 'fim' && j.run.fase === 'mesa' && passos++ < 200) {
    const rd = j.rodada;
    if (rd.fase === 'troca') { if (j.podeAbrirParaIA()) j.comecarRodada(); else j.jogarCarta(j.run.mesa.mao[0]); }
    else if (j.iaPrecisaAgir()) j.passoIA();
    else if (rd.mao.pedido && rd.mao.pedido.por === 1) j.responderTruco('aceitar');
    else j.jogarCarta(rd.mao.maos[0][0].id);
  }
  if (j.run.fase !== 'mesa') return; // a mão com cartas OP já fechou a Mesa
  j.proximaMao();
  if (j.rodada.fase === 'vira') j.escolherVira(0);
  const m = j.run.mesa;
  assert.ok(m.mao.every((id) => !id.startsWith('deus-')));
  assert.deepEqual(m.cartasDeus, []);
  assert.equal(j.xMultFinal(false), null);
});
