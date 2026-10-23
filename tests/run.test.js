import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jogo } from '../src/core/run.js';
import { PartidaClassica } from '../src/core/partida.js';
import { SeededRng } from '../src/core/rng.js';
import { carregarDados, jogarRunComBot } from './helpers.js';

const dados = carregarDados();

test('SeededRng: mesma seed → mesma sequência; streams independentes', () => {
  const a = new SeededRng('X');
  const b = new SeededRng('X');
  b.stream('loja').next();
  b.stream('loja').next();
  assert.equal(a.stream('baralho').next(), b.stream('baralho').next());
  const c = SeededRng.fromJSON(a.toJSON());
  assert.equal(c.stream('baralho').next(), a.stream('baralho').next());
});

test('nova run começa no mapa com Promessa na Mesa do Bar', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'ABC' });
  assert.equal(jogo.run.fase, 'mapa');
  assert.equal(jogo.run.deck.length, 40);
  assert.ok(jogo.run.promessa);
  assert.equal(jogo.run.chefoes.length, 8);
  assert.equal(jogo.run.chefoes[7], 'rei_do_truco');
});

test('baralhos iniciais aplicam seus modificadores', () => {
  assert.equal(Jogo.novaRun(dados, { seed: 'A', baralhoId: 'gasto' }).run.deck.length, 32);
  assert.equal(Jogo.novaRun(dados, { seed: 'A', baralhoId: 'gasto' }).run.config.trocas, 4);
  const mal = Jogo.novaRun(dados, { seed: 'A', baralhoId: 'malandro' }).run;
  assert.equal(mal.slotsComparsa, 6);
  assert.equal(mal.config.maos, 3);
  assert.equal(Jogo.novaRun(dados, { seed: 'A', baralhoId: 'marcado' }).run.deck.filter((c) => c.melhoria === 'marcada').length, 3);
  assert.equal(Jogo.novaRun(dados, { seed: 'A', baralhoId: 'fe' }).run.consumiveis.length, 2);
});

test('iniciar Mesa distribui 3 cartas e uma vira', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'ABC' });
  jogo.iniciarMesa();
  assert.equal(jogo.run.mesa.mao.length, 3);
  assert.ok(jogo.rodada.vira);
  assert.equal(jogo.rodada.maoAdv.length, 3);
});

test('trocar 1, 2 ou 3 cartas mantém a mão com 3 e gasta uma troca', () => {
  for (const n of [1, 2, 3]) {
    const jogo = Jogo.novaRun(dados, { seed: `TR${n}` });
    jogo.iniciarMesa();
    const antes = [...jogo.run.mesa.mao];
    jogo.trocar(antes.slice(0, n));
    assert.equal(jogo.run.mesa.trocasRestantes, 2);
    assert.equal(jogo.run.mesa.mao.length, 3);
    for (const id of antes.slice(0, n)) assert.ok(!jogo.run.mesa.mao.includes(id));
  }
});

test('pular Mesa entrega a Promessa e avança', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'ABC' });
  jogo.pularMesa();
  assert.equal(jogo.run.mesaIdx, 1);
  assert.equal(jogo.run.stats.pulos, 1);
  jogo.pularMesa();
  assert.equal(jogo.run.promessa, null, 'Chefão não pode ser pulado');
  assert.throws(() => jogo.pularMesa());
});

test('propriedades: runs com bot sempre terminam e pontuação nunca é negativa', () => {
  for (let i = 0; i < 40; i++) {
    const eventos = [];
    const { jogo } = jogarRunComBot(dados, `prop-${i}`);
    const r = jogo.run;
    assert.ok(['derrota', 'vitoria'].includes(r.fase), `seed prop-${i} terminou em ${r.fase}`);
    assert.ok(r.reis >= 0);
    assert.ok(r.stats.maiorMao >= 0);
    void eventos;
  }
});

test('cenário: mesma seed e mesmos comandos → mesmo estado final', () => {
  const a = jogarRunComBot(dados, 'cenario-1').jogo.salvar();
  const b = jogarRunComBot(dados, 'cenario-1').jogo.salvar();
  assert.equal(a, b);
});

test('salvar e carregar no meio da Mesa continua igual', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'SAVE' });
  jogo.iniciarMesa();
  const json = jogo.salvar();
  const copia = Jogo.carregar(dados, json);
  const jogarAteFim = (j) => {
    let n = 0;
    while (j.rodada.fase !== 'fim' && n++ < 30) {
      if (j.iaPrecisaAgir()) j.passoIA();
      else if (j.podeAbrirParaIA()) j.comecarRodada();
      else if (j.rodada.mao?.pedido) j.responderTruco('aceitar');
      else j.jogarCarta(j.rodada.mao ? j.rodada.mao.maos[0][0].id : j.run.mesa.mao[0]);
    }
    return j.salvar();
  };
  assert.equal(jogarAteFim(jogo), jogarAteFim(copia));
});

test('cada mão vencida soma pontos; perder com truco aceito custa uma mão extra', () => {
  let achouPenalidade = false;
  for (let i = 0; i < 60 && !achouPenalidade; i++) {
    const jogo = Jogo.novaRun(dados, { seed: `pen-${i}` });
    jogo.iniciarMesa();
    if (jogo.podeAbrirParaIA()) continue;
    jogo.pedirTruco();
    jogo.avancarIA();
    let n = 0;
    while (jogo.rodada.fase === 'jogo' && n++ < 20) {
      const st = jogo.rodada.mao;
      if (st.pedido) jogo.responderTruco('aceitar');
      else if (st.vez === 0) jogo.jogarCarta([...st.maos[0]].sort((a, b) => a.rank.localeCompare(b.rank))[0].id);
      jogo.avancarIA();
    }
    const res = jogo.rodada.resultado;
    if (!res.venceu && res.correu === null && jogo.rodada.mao.ultimoAumento === 0) {
      assert.equal(res.penalidade, 1);
      assert.equal(jogo.run.mesa.maosRestantes, jogo.run.config.maos - 2);
      achouPenalidade = true;
    }
    if (res.venceu) assert.ok(res.pontos > 0 || res.correu === 1);
  }
  assert.ok(achouPenalidade, 'nenhum cenário de penalidade encontrado');
});

test('adversário corre: sua melhor carta pontua como vaza (fuga)', () => {
  let achou = false;
  for (let i = 0; i < 80 && !achou; i++) {
    const jogo = Jogo.novaRun(dados, { seed: `fuga-${i}` });
    jogo.iniciarMesa();
    if (!jogo.podePedirTruco()) continue;
    jogo.pedirTruco();
    jogo.passoIA();
    const rd = jogo.rodada;
    if (rd.fase === 'fim' && rd.resultado.correu === 1) {
      const fuga = rd.vazasPontuadas.find((v) => v.fuga);
      assert.ok(fuga);
      assert.equal(rd.resultado.pontos, fuga.total, 'vale 1: sem multiplicar');
      assert.ok(fuga.total > 0);
      achou = true;
    }
  }
  assert.ok(achou, 'nenhuma corrida encontrada');
});

test('boteco: comprar, vender e reroll', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'LOJA' });
  const r = jogo.run;
  r.fase = 'recompensa';
  r.reis = 50;
  jogo.irAoBoteco();
  const i = r.loja.itens.findIndex((x) => x.tipo === 'comparsa');
  const preco = r.loja.itens[i].preco;
  jogo.comprar(i);
  assert.equal(r.comparsas.length, 1);
  assert.equal(r.reis, 50 - preco);
  assert.throws(() => jogo.comprar(i), /indisponível/);
  const iCarta = r.loja.itens.findIndex((x) => x.tipo === 'carta');
  jogo.comprar(iCarta);
  assert.equal(r.deck.length, 41);
  const reisAntes = r.reis;
  jogo.venderComparsa(r.comparsas[0].uid);
  assert.equal(r.comparsas.length, 0);
  assert.ok(r.reis > reisAntes);
  const custo = r.loja.rerollCusto;
  jogo.reroll();
  assert.equal(r.loja.rerollCusto, custo + 1);
  jogo.sairDoBoteco();
  assert.equal(r.mesaIdx, 1);
  assert.equal(r.fase, 'mapa');
});

test('Causos alteram cartas do baralho permanentemente', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'CAUSO' });
  const r = jogo.run;
  r.consumiveis = [
    { tipo: 'causo', id: 'causo_ferreiro' },
    { tipo: 'causo', id: 'causo_promessa' },
  ];
  jogo.iniciarMesa();
  const alvo = r.mesa.mao[0];
  jogo.usarConsumivel(0, [alvo]);
  assert.equal(jogo.carta(alvo).suit, 'paus');
  jogo.usarConsumivel(0, [alvo]);
  assert.equal(jogo.carta(alvo).bonusFichas, 10);
  assert.equal(r.stats.causosUsados, 2);

  r.consumiveis = [{ tipo: 'causo', id: 'causo_fogo' }, { tipo: 'causo', id: 'causo_espelho' }];
  const [a, b] = r.mesa.mao;
  jogo.usarConsumivel(1, [a, b]);
  assert.equal(jogo.carta(b).rank, jogo.carta(a).rank);
  assert.equal(jogo.carta(b).suit, jogo.carta(a).suit);
  jogo.usarConsumivel(0, [a]);
  assert.equal(r.deck.length, 39);
  assert.equal(r.mesa.mao.length, 3);
  assert.ok(!r.mesa.mao.includes(a));
});

test('Simpatia sobe o nível da Jogada', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'S' });
  jogo.run.consumiveis = [{ tipo: 'simpatia', id: 'simpatia_sao_jorge' }];
  jogo.usarConsumivel(0);
  assert.equal(jogo.run.niveis.manilhada, 2);
});

test('Comparsa Vira-Lata: escolhe entre duas viras', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'VL' });
  jogo.adicionarComparsa('vira_lata');
  jogo.iniciarMesa();
  assert.equal(jogo.rodada.fase, 'vira');
  assert.equal(jogo.rodada.viras.length, 2);
  jogo.escolherVira(1);
  assert.equal(jogo.rodada.vira, jogo.rodada.viras[1]);
  assert.equal(jogo.rodada.fase, 'troca');
});

test('Comparsa Doze de Saída: primeira mão vale 3', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'DZ' });
  jogo.adicionarComparsa('doze_de_saida');
  jogo.iniciarMesa();
  jogo.comecarRodada();
  assert.equal(jogo.rodada.mao.valor, 3);
});

test('Comparsa A Benzedeira: revela uma vez por Mesa', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'BZ' });
  jogo.adicionarComparsa('benzedeira');
  jogo.iniciarMesa();
  jogo.benzer();
  assert.ok(jogo.rodada.revelada);
  assert.throws(() => jogo.benzer());
});

test('Comparsas Pica-fumo Pirata, Zap Duplo e Cangaceiro mudam o contexto de força', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'PZ' });
  jogo.adicionarComparsa('pica_fumo_pirata');
  jogo.adicionarComparsa('zap_duplo');
  jogo.adicionarComparsa('cangaceiro');
  jogo.iniciarMesa();
  jogo.rodada.vira = { id: 'o-x', rank: '7', suit: 'ouros' };
  const ctx = jogo.ctxForca();
  assert.ok(ctx.extraManilha({ id: 'c1', rank: '3', suit: 'ouros' }));
  assert.ok(!ctx.extraManilha({ id: 'o1', rank: '3', suit: 'ouros' }), 'só vale para as suas cartas');
  assert.ok(ctx.zapAlias({ id: 'c2', rank: 'Q', suit: 'espadas' }));
  assert.equal(ctx.resolverEmpate(), 0);
});

test('Chefões: Rei do Truco tem 2 manilhas; Mão de Pilão proíbe truco; Tia Zulmira proíbe trocas', () => {
  const mk = (chefao) => {
    const jogo = Jogo.novaRun(dados, { seed: `CH-${chefao}` });
    jogo.run.chefoes = Array(8).fill(chefao);
    jogo.run.mesaIdx = 2;
    jogo.prepararMapa();
    jogo.iniciarMesa();
    return jogo;
  };
  const rei = mk('rei_do_truco');
  const mr = contarManilhasAdv(rei);
  assert.ok(mr >= 2);
  const pilao = mk('mao_de_pilao');
  assert.equal(pilao.podePedirTruco(), false);
  const zul = mk('tia_zulmira');
  assert.equal(zul.run.mesa.mao.length, 3);
  assert.equal(zul.run.mesa.trocasRestantes, 0);
  assert.throws(() => zul.trocar([zul.run.mesa.mao[0]]));
});

function contarManilhasAdv(jogo) {
  const ranks = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
  const mr = ranks[(ranks.indexOf(jogo.rodada.vira.rank) + 1) % 10];
  return jogo.rodada.maoAdv.filter((c) => c.rank === mr).length;
}

test('Truco clássico: partida contra a IA chega a 12 pontos', () => {
  for (let i = 0; i < 20; i++) {
    const p = new PartidaClassica({ seed: `cl-${i}`, perfil: dados.perfisPorId.classico });
    const bot = new SeededRng(`b${i}`).stream('b');
    let n = 0;
    while (p.fase !== 'fim' && n++ < 2000) {
      if (p.fase === 'onze') p.decidirOnze(0, bot.chance(0.6));
      else if (p.fase === 'fimMao') p.proximaMao();
      else if (p.iaPrecisaAgir()) p.passoIA();
      else if (p.mao.pedido) p.responder(bot.chance(0.7) ? 'aceitar' : 'correr');
      else if (p.mao.trucoPermitido && p.mao.ultimoAumento !== 0 && bot.chance(0.1) && p.mao.valor < 12) p.truco();
      else p.jogar(p.mao.maos[0][0].id);
    }
    assert.equal(p.fase, 'fim', `partida cl-${i}`);
    assert.ok(Math.max(...p.placar) >= 12);
  }
});

test('Truco clássico: mão de onze vale 3 e não permite truco', () => {
  const p = new PartidaClassica({ seed: 'onze', perfil: dados.perfisPorId.classico });
  p.placar = [11, 5];
  p.fase = 'fimMao';
  p.proximaMao();
  assert.equal(p.fase, 'onze');
  assert.equal(p.mao.valor, 3);
  assert.equal(p.mao.trucoPermitido, false);
  p.decidirOnze(0, false);
  assert.equal(p.placar[1], 6);
});

test('Truco clássico: mão de ferro quando os dois têm 11', () => {
  const p = new PartidaClassica({ seed: 'ferro', perfil: dados.perfisPorId.classico });
  p.placar = [11, 11];
  p.fase = 'fimMao';
  p.proximaMao();
  assert.ok(p.ferro);
  assert.equal(p.fase, 'jogo');
  assert.equal(p.mao.trucoPermitido, false);
});
