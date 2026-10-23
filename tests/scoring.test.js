import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identificarJogada, pontuarVaza, pontuarMao } from '../src/core/scoring.js';
import { GameEventBus } from '../src/core/events.js';
import { registrarComparsas } from '../src/core/comparsas.js';
import { carregarDados, c, o } from './helpers.js';

const dados = carregarDados();
const niveis = Object.fromEntries(dados.jogadasLista.map((j) => [j.id, 1]));
const vira = c('7', 'ouros'); // manilha = Q
const ctx = { vira };
let uid = 1;
const comp = (id) => ({ uid: uid++, id, estado: {}, desativada: false });
const vaza = (carta, jogada = 'vaza_simples', extra = {}) => pontuarVaza({ dados, carta, jogada, ctxForca: ctx, niveis, ...extra });

test('identifica Zapada, Manilhada, Matar Seco e Vaza Simples', () => {
  const adv = o('K', 'copas');
  assert.equal(identificarJogada({ carta: c('Q', 'paus'), cartaAdv: adv, maoAntes: [], ctx }), 'zapada');
  assert.equal(identificarJogada({ carta: c('Q', 'copas'), cartaAdv: adv, maoAntes: [], ctx }), 'manilhada');
  const mao = [c('A', 'paus'), c('3', 'paus'), c('4', 'paus')];
  assert.equal(identificarJogada({ carta: mao[0], cartaAdv: adv, maoAntes: mao, ctx }), 'matar_seco');
  assert.equal(identificarJogada({ carta: mao[1], cartaAdv: adv, maoAntes: mao, ctx }), 'vaza_simples');
  // única carta que vence não é "matar seco"
  assert.equal(identificarJogada({ carta: c('3', 'paus'), cartaAdv: adv, maoAntes: [c('3', 'paus'), c('4', 'paus')], ctx }), 'vaza_simples');
  assert.equal(identificarJogada({ carta: c('3', 'paus'), cartaAdv: adv, maoAntes: [], ctx, empateConvertido: true }), 'cangada');
});

test('Vaza Simples com Ás: (10 + 5) × 1 = 15', () => {
  const r = vaza(c('A', 'paus'));
  assert.equal(r.fichas, 15);
  assert.equal(r.mult, 1);
  assert.equal(r.totalFinal, 15);
});

test('Manilhada: (20 + 20) × 3 = 120; Zapada: (30 + 40) × 4 = 280', () => {
  assert.equal(vaza(c('Q', 'copas'), 'manilhada').totalFinal, 120);
  assert.equal(vaza(c('Q', 'paus'), 'zapada').totalFinal, 280);
});

test('nível da jogada soma fichas e mult', () => {
  const r = pontuarVaza({ dados, carta: c('A', 'paus'), jogada: 'vaza_simples', ctxForca: ctx, niveis: { ...niveis, vaza_simples: 3 } });
  assert.equal(r.fichas, 10 + 5 + 2 * 5);
  assert.equal(r.mult, 1 + 2);
});

test('bônus de cangada anterior soma mult', () => {
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { bonusMult: 2 }).totalFinal, 15 * 3);
});

test('melhorias: vidro ×2, ouro dá réis, bonusFichas soma, selo vermelho repete', () => {
  assert.equal(vaza(c('A', 'paus', { melhoria: 'vidro' })).totalFinal, 30);
  assert.equal(vaza(c('A', 'paus', { melhoria: 'ouro' })).reis, 3);
  assert.equal(vaza(c('A', 'paus', { bonusFichas: 10 })).totalFinal, 25);
  assert.equal(vaza(c('A', 'paus', { selo: 'vermelho' })).fichas, 10 + 10 + 5);
  assert.equal(vaza(c('A', 'paus', { selo: 'vermelho', melhoria: 'vidro' })).mult, 4);
});

test('chefões: Dona Cotinha anula Copas, Delegado corta Manilhada', () => {
  const cotinha = dados.chefoesPorId.dona_cotinha;
  assert.equal(vaza(c('A', 'copas'), 'vaza_simples', { chefao: cotinha }).totalFinal, 0);
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { chefao: cotinha }).totalFinal, 15);
  const delegado = dados.chefoesPorId.delegado_nogueira;
  assert.equal(vaza(c('Q', 'copas'), 'manilhada', { chefao: delegado }).totalFinal, 60);
});

test('pontuarMao: soma vazas + bônus de mão × truco', () => {
  const r = pontuarMao({ dados, niveis, vazas: [{ total: 15 }, { total: 120 }], bonus: ['queda_limpa'], valor: 3 });
  assert.equal(r.total, (15 + 120 + 30 * 4) * 3);
});

// ---------- Comparsas (cada um isolado) ----------

test('Comparsa Seu Zé do Balcão: +4 Mult com Copas', () => {
  const cs = [comp('seu_ze_do_balcao')];
  assert.equal(vaza(c('A', 'copas'), 'vaza_simples', { comparsas: cs }).mult, 5);
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: cs }).mult, 1);
});

test('Comparsa Pinga da Casa: +15 Fichas', () => {
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: [comp('pinga_da_casa')] }).fichas, 30);
});

test('Comparsa Garçom Apressado: +4 Mult só na 1ª vaza', () => {
  const cs = [comp('garcom_apressado')];
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: cs, info: { vazaIndice: 0 } }).mult, 5);
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: cs, info: { vazaIndice: 1 } }).mult, 1);
});

test('Comparsa Sanfoneiro: +3 Mult por vaza já vencida', () => {
  const cs = [comp('sanfoneiro')];
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: cs, info: { vazasVencidasAntes: 2 } }).mult, 7);
});

test('Comparsa Contador de Causos: +2 Mult por Causo usado', () => {
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: [comp('contador_de_causos')], info: { causosUsados: 3 } }).mult, 7);
});

test('Comparsa Ferro-Velho: ×2 com 4–7 comum, não com manilha', () => {
  const cs = [comp('ferro_velho')];
  assert.equal(vaza(c('6', 'paus'), 'vaza_simples', { comparsas: cs }).mult, 2);
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: cs }).mult, 1);
  const ctx2 = { vira: c('5', 'ouros') }; // manilha 6
  assert.equal(pontuarVaza({ dados, carta: c('6', 'copas'), jogada: 'manilhada', ctxForca: ctx2, niveis, comparsas: cs }).mult, 3);
});

test('Comparsa Cangaceiro: Cangada vencida ganha +15 Fichas', () => {
  const r = vaza(c('A', 'paus'), 'cangada', { comparsas: [comp('cangaceiro')] });
  assert.equal(r.fichas, 10 + 0 + 15);
});

test('Comparsa Carteado Fantasma: ×2 Mult em toda vaza', () => {
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: [comp('carteado_fantasma')] }).mult, 2);
});

test('Comparsa Tio do Blefe: ×1.5 na mão seguinte à corrida do adversário', () => {
  const inst = comp('tio_do_blefe');
  inst.estado.maoAlvo = 2;
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: [inst], info: { maoIndice: 2 } }).mult, 1.5);
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: [inst], info: { maoIndice: 1 } }).mult, 1);
  // a parte de evento: corrida do adversário dá réis e marca a próxima mão
  const bus = new GameEventBus();
  const jogo = { run: { comparsas: [comp('tio_do_blefe')], reis: 0 }, dados, ganharReis(v) { this.run.reis += v; } };
  registrarComparsas(bus, jogo);
  bus.emit('OnTrucoRespondido', { jogador: 1, resposta: 'correr', maoIndice: 0 });
  assert.equal(jogo.run.reis, 2);
  assert.equal(jogo.run.comparsas[0].estado.maoAlvo, 1);
});

test('Comparsa Dona da Pensão: +1 Réis em vaza com Ouros', () => {
  const bus = new GameEventBus();
  const jogo = { run: { comparsas: [comp('dona_da_pensao')], reis: 0 }, dados, ganharReis(v) { this.run.reis += v; } };
  registrarComparsas(bus, jogo);
  bus.emit('OnVazaPontuada', { carta: c('A', 'ouros') });
  bus.emit('OnVazaPontuada', { carta: c('A', 'paus') });
  assert.equal(jogo.run.reis, 1);
});

test('Comparsa Herdeiro do Rei: ×2 por aumento na mão', () => {
  const r = pontuarMao({ dados, niveis, vazas: [{ total: 10 }], valor: 6, comparsas: [comp('herdeiro_do_rei')], info: { aumentos: 2 } });
  assert.equal(r.total, 10 * 4 * 6);
});

test('ordem dos slots: +Mult antes de ×Mult', () => {
  const r = vaza(c('6', 'copas'), 'vaza_simples', { comparsas: [comp('ferro_velho'), comp('seu_ze_do_balcao')] });
  assert.equal(r.mult, (1 + 4) * 2);
});

test('Comparsa desativado não pontua', () => {
  const inst = comp('pinga_da_casa');
  inst.desativada = true;
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', { comparsas: [inst] }).fichas, 15);
});

test('toda descrição de Comparsa tem um efeito implementado', async () => {
  const { EFEITOS } = await import('../src/core/comparsas.js');
  for (const def of dados.comparsas) assert.ok(EFEITOS[def.efeito.tipo], `${def.id}: ${def.efeito.tipo}`);
});
