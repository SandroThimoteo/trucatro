import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jogo } from '../src/core/run.js';
import { pontuarVaza } from '../src/core/scoring.js';
import { perfilDe } from '../src/core/dados.js';
import { novoPerfil, normalizarPerfil, comprarItem, equiparItem, registrarMesa, registrarFimDeRun, itemEquipado } from '../src/core/perfil.js';
import { carregarDados, c } from './helpers.js';

const dados = carregarDados();
const niveis = Object.fromEntries(dados.jogadasLista.map((j) => [j.id, 1]));
const ctxForca = { vira: c('4', 'paus') };

// Run com uma pessoa escolhida sentada na Mesa do Bar (mesaIdx 0) ou do Fundo (mesaIdx 1)
function comPessoa(id, seed = `P-${id}`) {
  const jogo = Jogo.novaRun(dados, { seed });
  const p = dados.personagensPorId[id];
  jogo.run.rivais = Array(8).fill({ bar: p.tipo === 'bar' ? id : 'seu_joaquim', fundo: p.tipo === 'fundo' ? id : 'rita_navalha' });
  if (p.tipo === 'fundo') jogo.run.mesaIdx = 1;
  jogo.prepararMapa();
  jogo.run.evento = null;
  return jogo;
}

test('todo personagem tem nome, título, avatar, manha explicada, perfil de IA e voz', () => {
  for (const p of dados.personagens) {
    for (const campo of ['nome', 'titulo', 'avatar', 'bio', 'regra', 'detalhe']) assert.ok(p[campo], `${p.id} sem ${campo}`);
    assert.ok(dados.perfisPorId[p.perfil], `${p.id}: perfil ${p.perfil} não existe`);
    assert.ok(p.voz && p.voz.tom > 0, `${p.id} sem voz`);
    assert.ok(['bar', 'fundo', 'chefao'].includes(p.tipo));
    for (const lista of Object.values(p.falas ?? {})) assert.ok(lista.length > 0);
  }
  assert.equal(dados.chefoes.length, 8);
  assert.ok(dados.personagens.filter((p) => p.tipo === 'bar').length >= 8);
  assert.ok(dados.personagens.filter((p) => p.tipo === 'fundo').length >= 8);
});

test('todo Comparsa e Causo tem explicação detalhada', () => {
  for (const x of [...dados.comparsas, ...dados.causos]) assert.ok(x.detalhe?.length > 40, `${x.id} sem detalhe`);
  for (const m of [...Object.values(dados.cartas.melhorias), ...Object.values(dados.cartas.selos)]) assert.ok(m.detalhe);
});

test('cada bairro tem pessoas diferentes no bar e no fundo, e a seed decide quem', () => {
  const a = Jogo.novaRun(dados, { seed: 'RIVAIS' });
  const b = Jogo.novaRun(dados, { seed: 'RIVAIS' });
  assert.deepEqual(a.run.rivais, b.run.rivais);
  assert.equal(a.run.rivais.length, 8);
  assert.equal(new Set(a.run.rivais.map((r) => r.bar)).size, 8);
  const info = a.infoMesa(1, 0);
  assert.equal(info.pessoa.tipo, 'bar');
  assert.equal(info.nome, info.pessoa.nome);
  assert.equal(a.infoMesa(1, 2).pessoa.tipo, 'chefao');
});

test('save antigo (sem personagens) carrega e ganha rivais', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'VELHO' });
  const run = JSON.parse(jogo.salvar());
  delete run.rivais;
  const carregado = Jogo.carregar(dados, run);
  assert.equal(carregado.run.rivais.length, 8);
  carregado.iniciarMesa();
  assert.ok(carregado.pessoa);
});

test('perfil de IA usa os traços do personagem', () => {
  const tiao = perfilDe(dados, dados.personagensPorId.tiao_malandragem);
  assert.equal(tiao.coragem, 0);
  assert.equal(tiao.estrategiaCarta, dados.perfisPorId.mesa_fundo.estrategiaCarta);
});

test('Mesa começa com a fala de entrada do personagem', () => {
  const jogo = comPessoa('seu_joaquim');
  jogo.iniciarMesa();
  assert.ok(dados.personagensPorId.seu_joaquim.falas.entrada.includes(jogo.rodada.fala));
});

test('manhas: trocas, mãos, meta, valor inicial, sem mão de onze, cobrança, cartas à mostra', () => {
  const base = Jogo.novaRun(dados, { seed: 'BASE' }).run.config;

  const oswaldo = comPessoa('seu_oswaldo');
  oswaldo.iniciarMesa();
  assert.equal(oswaldo.run.mesa.trocasRestantes, base.trocas + 1);

  const rita = comPessoa('rita_navalha');
  rita.iniciarMesa();
  assert.equal(rita.run.mesa.trocasRestantes, base.trocas - 1);

  const ze = comPessoa('ze_da_kombi');
  const metaNormal = Jogo.novaRun(dados, { seed: 'X' }).infoMesa(1, 0).meta;
  assert.equal(ze.infoMesa().meta, Math.round(metaNormal * 0.8));
  ze.iniciarMesa();
  assert.equal(ze.run.mesa.maosRestantes, base.maos - 1);

  const tonhao = comPessoa('tonhao');
  tonhao.iniciarMesa();
  tonhao.comecarRodada();
  assert.equal(tonhao.rodada.mao.valor, 3);

  const careca = comPessoa('careca_do_bingo');
  careca.iniciarMesa();
  careca.run.mesa.maosRestantes = 1;
  careca.run.mesa.rodada.fase = 'fim';
  careca.proximaMao();
  assert.equal(careca.rodada.onze, false);

  const loira = comPessoa('loira_do_fiado');
  const antes = loira.run.reis;
  loira.iniciarMesa();
  assert.equal(loira.run.reis, antes - Math.min(antes, 2));

  const lurdinha = comPessoa('dona_lurdinha');
  lurdinha.iniciarMesa();
  assert.equal(lurdinha.rodada.reveladas.length, 1);
  assert.ok(lurdinha.rodada.maoAdv.some((x) => x.id === lurdinha.rodada.reveladas[0]));
});

test('manhas de pontuação: Fichas por vaza, bônus de naipe e naipe pela metade', () => {
  const vaza = (carta, pessoa) => pontuarVaza({ dados, carta, jogada: 'vaza_simples', ctxForca, niveis, pessoa: dados.personagensPorId[pessoa] });
  assert.equal(vaza(c('A', 'paus'), 'dona_neide').fichas, 10 + 5 + 10);
  assert.equal(vaza(c('A', 'copas'), 'marcao_bigode').mult, 1 + 3);
  assert.equal(vaza(c('A', 'paus'), 'marcao_bigode').mult, 1);
  assert.equal(vaza(c('A', 'ouros'), 'dona_zefa').fichas, 10 + 5 + 20);
  assert.equal(vaza(c('A', 'espadas'), 'cabo_ronaldo').totalFinal, Math.floor(15 * 0.5));
  assert.equal(vaza(c('A', 'paus'), 'cabo_ronaldo').totalFinal, 15);
});

test('Seu Joaquim paga réis por vaza vencida; vencer a Mesa paga a manha extra', () => {
  const jogo = comPessoa('seu_joaquim');
  jogo.iniciarMesa();
  const antes = jogo.run.reis;
  jogo.rodada.maoAntes = [c('3', 'paus')];
  jogo.aoResolverVaza({ indice: 0, vencedor: 0, cartas: [c('3', 'paus'), { id: 'o1', rank: '4', suit: 'copas' }] });
  assert.equal(jogo.run.reis, antes + 1);

  const gas = comPessoa('baixinho_do_gas');
  gas.iniciarMesa();
  gas.run.mesa.pontos = gas.run.mesa.meta;
  gas.vencerMesa();
  assert.equal(gas.run.resultadoMesa.extra, 3);
  assert.equal(gas.run.resultadoMesa.tampinhas, 0, 'só Chefão dá Tampinhas');
});

test('Chefões deixam cair Tampinhas: valor do chefão + 1 por bairro', () => {
  const jogo = Jogo.novaRun(dados, { seed: 'TAMPA' });
  jogo.run.chefoes = Array(8).fill('seu_lunatico');
  jogo.run.bairro = 3;
  jogo.run.mesaIdx = 2;
  jogo.prepararMapa();
  jogo.iniciarMesa();
  jogo.run.mesa.pontos = jogo.run.mesa.meta;
  jogo.vencerMesa();
  assert.equal(jogo.run.resultadoMesa.tampinhas, dados.chefoesPorId.seu_lunatico.drop + 2);
  assert.ok(dados.personagensPorId[jogo.run.resultadoMesa.pessoaId].falas.derrota.includes(jogo.run.resultadoMesa.fala));
});

test('perfil: começa com os itens grátis equipados e 0 Tampinhas', () => {
  const p = novoPerfil(dados);
  assert.equal(p.tampinhas, 0);
  for (const cat of dados.bazar.categorias) assert.equal(itemEquipado(dados, p, cat.id).preco, 0);
});

test('perfil: comprar gasta Tampinhas e equipa; sem saldo não compra', () => {
  const p = novoPerfil(dados);
  assert.throws(() => comprarItem(dados, p, 'verso_azulejo'), /Faltam/);
  registrarMesa(p, { venceu: true, tampinhas: 10 });
  comprarItem(dados, p, 'verso_azulejo');
  assert.equal(p.tampinhas, 10 - dados.bazarPorId.verso_azulejo.preco);
  assert.equal(p.equipado.verso, 'verso_azulejo');
  assert.throws(() => comprarItem(dados, p, 'verso_azulejo'), /já tem/);
  equiparItem(dados, p, 'verso_padrao');
  assert.equal(p.equipado.verso, 'verso_padrao');
  assert.throws(() => equiparItem(dados, p, 'verso_ouro'));
  assert.equal(p.recordes.chefoesVencidos, 1);
});

test('perfil: normalizar conserta perfil antigo ou estranho sem perder progresso', () => {
  const p = normalizarPerfil(dados, { tampinhas: 7.9, compras: ['verso_chita'], equipado: { verso: 'verso_chita', toalha: 'nao_existe' }, save: '{"x":1}' });
  assert.equal(p.tampinhas, 7);
  assert.equal(p.equipado.verso, 'verso_chita');
  assert.equal(p.equipado.toalha, 'toalha_xadrez');
  assert.equal(p.save, '{"x":1}');
  assert.ok(p.opcoes.musica >= 0);
  const vazio = normalizarPerfil(dados, null);
  assert.equal(vazio.tampinhas, 0);
});

test('perfil: fim de run atualiza recordes', () => {
  const p = novoPerfil(dados);
  registrarFimDeRun(p, { vitoria: false, bairro: 4, stats: { maiorMao: 300 } });
  registrarFimDeRun(p, { vitoria: true, bairro: 8, stats: { maiorMao: 120 } });
  assert.deepEqual([p.recordes.runs, p.recordes.vitorias, p.recordes.melhorBairro, p.recordes.maiorMao], [2, 1, 8, 300]);
});

test('Bazar: todo item tem categoria válida e cada categoria tem um item grátis', () => {
  const cats = new Set(dados.bazar.categorias.map((x) => x.id));
  for (const i of dados.bazar.itens) assert.ok(cats.has(i.categoria), i.id);
  for (const cat of cats) {
    const gratis = dados.bazar.itens.filter((i) => i.categoria === cat && i.preco === 0).length;
    if (cat === 'personagem') assert.ok(gratis >= 1, cat); // começa com 3 personagens liberados
    else assert.equal(gratis, 1, cat);
  }
});
