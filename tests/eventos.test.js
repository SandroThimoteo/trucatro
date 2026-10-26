import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jogo } from '../src/core/run.js';
import { carregarDados, jogarRunComBot } from './helpers.js';

const dados = carregarDados();

function comEvento(id, reis = 20) {
  const j = Jogo.novaRun(dados, { seed: `EV-${id}` });
  j.run.reis = reis;
  j.run.mesaIdx = 1;
  j.prepararMapa();
  j.run.evento = { id };
  return j;
}

test('eventos aparecem entre as Mesas, nunca antes do Chefão nem na primeira Mesa', () => {
  let vistos = 0;
  for (let i = 0; i < 60; i++) {
    const j = Jogo.novaRun(dados, { seed: `EVS${i}` });
    assert.equal(j.run.evento, null, 'primeira Mesa sem evento');
    j.run.mesaIdx = 1;
    j.prepararMapa();
    if (j.run.evento) vistos++;
    j.run.mesaIdx = 2;
    j.prepararMapa();
    assert.equal(j.run.evento, null, 'Chefão sem evento');
  }
  assert.ok(vistos > 15 && vistos < 50, `vistos ${vistos}`);
});

test('Faltou luz: só vale para a próxima Mesa (vira escondida e recompensa maior)', () => {
  const j = comEvento('faltou_luz');
  assert.throws(() => j.iniciarMesa(), /evento/);
  j.resolverEvento(0);
  j.iniciarMesa();
  assert.equal(j.regrasMesa.viraEscondidaAte, 2);
  assert.equal(j.regrasMesa.recompensaMult, 1.5);
  assert.equal(j.run.modMesa, null);
});

test('Festa da firma sobe a meta da próxima Mesa', () => {
  const j = comEvento('festa_firma');
  const antes = j.infoMesa().meta;
  j.resolverEvento(0);
  assert.equal(j.infoMesa().meta, Math.round(antes * 1.3));
});

test('Fiado: dá réis agora e cobra depois; sem dinheiro leva um Comparsa', () => {
  const j = comEvento('fiado', 0);
  j.adicionarComparsa('pinga_da_casa');
  j.resolverEvento(0);
  assert.equal(j.run.reis, 8);
  assert.equal(j.run.divida, 12);
  j.iniciarMesa();
  j.run.reis = 0;
  j.run.mesa.maosRestantes = 0;
  j.run.mesa.pontos = j.run.mesa.meta;
  j.vencerMesa();
  const f = j.run.resultadoMesa.fiado;
  assert.ok(f && f.divida === 12);
  if (f.pago < 12) assert.equal(f.comparsa, 'pinga_da_casa');
  assert.equal(j.run.divida, 0);
});

test('Roleta cobra 3 réis e sempre dá um resultado; sem dinheiro não gira', () => {
  for (let i = 0; i < 30; i++) {
    const j = comEvento('roleta', 10);
    j.run.seed = `R${i}`;
    const res = j.resolverEvento(0);
    assert.ok(res.roleta && typeof res.roleta.indice === 'number');
  }
  const pobre = comEvento('roleta', 2);
  assert.throws(() => pobre.resolverEvento(0), /Faltam/);
});

test('Mesa Dupla: 4 jogadores, sinais, parceiro e a run continua normal', () => {
  const j = comEvento('mesa_dupla');
  j.resolverEvento(0);
  j.iniciarMesa();
  assert.ok(j.dupla);
  const rd = j.rodada;
  if (rd.fase === 'vira') j.escolherVira(0);
  assert.equal(rd.maoParceiro.length, 3);
  assert.ok(rd.sinais[2]);
  j.sinalizar('zap');
  assert.equal(rd.sinais[0], 'zap');
  if (j.podeAbrirParaIA()) j.comecarRodada();
  let n = 0;
  while (j.run.fase === 'mesa' && n++ < 2000) {
    const r = j.rodada;
    if (r.fase === 'vira') j.escolherVira(0);
    else if (r.fase === 'troca') { if (j.podeAbrirParaIA()) j.comecarRodada(); else j.jogarCarta(j.run.mesa.mao[0]); }
    else if (r.fase === 'fim') j.proximaMao();
    else if (j.iaPrecisaAgir()) j.passoIA();
    else if (r.mao.pedido) j.responderTruco('aceitar');
    else j.jogarCarta(r.mao.maos[0][0].id);
  }
  assert.ok(['recompensa', 'derrota', 'vitoria'].includes(j.run.fase), j.run.fase);
});

test('bots passam por eventos e Mesas Duplas sem travar', () => {
  for (let i = 0; i < 40; i++) {
    const { jogo } = jogarRunComBot(dados, `evbot-${i}`);
    assert.ok(['derrota', 'vitoria'].includes(jogo.run.fase));
  }
});

test('desafio do dia: mesmo dia, mesma run; pontuação = 1000 por Mesa + pontos', async () => {
  const { diaDeHoje, sementeDoDia, pontuacaoDesafio } = await import('../src/core/desafio.js');
  assert.match(diaDeHoje(new Date('2026-10-23T02:00:00Z')), /^2026-10-22$/, 'vira à meia-noite de Brasília');
  assert.equal(sementeDoDia('2026-10-23'), 'DIA20261023');
  const a = jogarRunComBot(dados, sementeDoDia('2026-10-23')).jogo.run;
  const b = jogarRunComBot(dados, sementeDoDia('2026-10-23')).jogo.run;
  assert.equal(pontuacaoDesafio(a), pontuacaoDesafio(b));
  assert.equal(pontuacaoDesafio(a), a.stats.mesasVencidas * 1000 + a.stats.pontosTotais);
});

// ---------- dois relógios, jogadas da mão, poderes e cara ----------

function naMesa(seed, jogador = 'chico_baralho') {
  const j = Jogo.novaRun(dados, { seed, jogador });
  j.run.evento = null;
  j.iniciarMesa();
  if (j.rodada.fase === 'vira') j.escolherVira(0);
  return j;
}

test('adversário que chega a 12 tentos ganha a Mesa, mesmo com mãos sobrando', () => {
  const j = naMesa('TENTOS');
  j.run.mesa.tentosAdv = 11;
  j.run.mesa.maosRestantes = 4;
  let n = 0;
  while (j.run.fase === 'mesa' && n++ < 500) {
    const rd = j.rodada;
    if (rd.fase === 'fim') { j.proximaMao(); continue; }
    if (rd.fase === 'troca') { if (j.podeAbrirParaIA()) j.comecarRodada(); else j.jogarCarta(j.run.mesa.mao[0]); continue; }
    if (j.iaPrecisaAgir()) j.passoIA();
    else if (rd.mao.pedido) j.responderTruco('correr');
    else j.jogarCarta(rd.mao.maos[0][0].id);
  }
  if (j.run.fase === 'derrota') assert.ok(['tentos', 'maos'].includes(j.run.resultadoMesa.motivo));
  assert.ok(j.run.fase === 'derrota' || j.run.mesa.pontos >= j.run.mesa.meta);
});

test('com 11 tentos do adversário a mão é de onze (vale 3, sem truco)', () => {
  const j = Jogo.novaRun(dados, { seed: 'ONZE' });
  j.run.evento = null;
  j.iniciarMesa();
  j.run.mesa.tentosAdv = 11;
  j.rodada.fase = 'fim';
  j.proximaMao();
  assert.equal(j.rodada.onze, true);
});

test('Na Raça e No Empate entram como jogadas de mão', () => {
  for (const id of ['na_raca', 'no_empate', 'fujao']) {
    assert.equal(dados.jogadas[id].tipo, 'mao');
    assert.ok(dados.simpatias.some((s) => s.jogada === id), `simpatia de ${id}`);
  }
});

test('poderes: Olho Vivo revela, Reza Forte dobra, Pendura dá réis e tento, Vira Virada troca a vira', () => {
  const ov = naMesa('P1', 'bigode_grosso');
  const antes = ov.rodada.reveladas.length;
  ov.usarPoder();
  assert.equal(ov.rodada.reveladas.length, antes + 1);

  const rz = naMesa('P2', 'vo_cida');
  rz.usarPoder();
  assert.equal(rz.rodada.rezaForte, true);
  assert.throws(() => rz.usarPoder(), /reza/);

  const pd = naMesa('P3', 'ze_fiado');
  const reis = pd.run.reis;
  pd.usarPoder();
  pd.usarPoder();
  assert.equal(pd.run.reis, reis + 6);
  assert.equal(pd.run.mesa.tentosAdv, 2);
  assert.throws(() => pd.usarPoder(), /todas as vezes/);

  const vv = naMesa('P4', 'dona_gloria');
  const vira = vv.rodada.vira;
  vv.usarPoder();
  assert.notDeepEqual(vv.rodada.vira, vira);
  vv.usarPoder(); // pago: 1 tento
  assert.equal(vv.run.mesa.tentosAdv, 1);
});

test('Embaralhada troca uma carta no meio da mão sem repetir carta', () => {
  for (let i = 0; i < 30; i++) {
    const j = naMesa(`EMB${i}`);
    if (j.podeAbrirParaIA()) j.comecarRodada(); else j.comecarRodada();
    j.avancarIA();
    const st = j.rodada.mao;
    if (st.fim || st.vez !== 0 || st.pedido) continue;
    const id = st.maos[0][0].id;
    j.usarPoder([id]);
    assert.ok(!st.maos[0].some((c) => c.id === id));
    assert.equal(st.maos[0].length, j.run.mesa.mao.length);
  }
});

test('a cara do adversário existe e às vezes mente', () => {
  let mentiras = 0;
  for (let i = 0; i < 80; i++) {
    const j = naMesa(`CARA${i}`);
    assert.ok(['😟', '😐', '😎'].includes(j.rodada.cara.emoji));
    if (j.rodada.cara.mente) mentiras++;
  }
  assert.ok(mentiras > 0 && mentiras < 60, `mentiras ${mentiras}`);
});
