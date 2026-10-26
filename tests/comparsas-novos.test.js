import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pontuarVaza, pontuarMao } from '../src/core/scoring.js';
import { GameEventBus } from '../src/core/events.js';
import { registrarComparsas } from '../src/core/comparsas.js';
import { carregarDados, c } from './helpers.js';

const dados = carregarDados();
const niveis = Object.fromEntries(dados.jogadasLista.map((j) => [j.id, 1]));
const ctx = { vira: c('7', 'ouros') }; // manilha = Q
let uid = 1;
const comp = (id) => ({ uid: uid++, id, estado: {}, desativada: false });
const vaza = (carta, jogada, comparsas, info = {}) => pontuarVaza({ dados, carta, jogada, ctxForca: ctx, niveis, comparsas, info });

// jogo falso: só o que os observadores dos Comparsas leem
function montar(id, mesa = { tentosAdv: 0, poderUsos: 0 }) {
  const bus = new GameEventBus();
  const inst = comp(id);
  const jogo = { run: { comparsas: [inst], reis: 0, mesa }, dados, ganharReis(v) { this.run.reis += v; } };
  registrarComparsas(bus, jogo);
  return { bus, inst, jogo };
}

const NOVOS = ['marcador_de_giz', 'torcedor_sofredor', 'brigao_da_esquina', 'tecnico_da_varzea', 'rei_da_sinuca'];

test('Comparsas novos: campos do contrato (avatar, cor, som)', () => {
  for (const id of NOVOS) {
    const def = dados.comparsasPorId[id];
    assert.ok(def, `${id} existe`);
    assert.ok(def.avatar && [...def.avatar.replace('️', '')].length === 1, `${id}: 1 emoji`);
    assert.match(def.cor, /^#[0-9a-f]{6}$/i, `${id}: cor hex`);
    assert.equal(def.som, id);
    assert.ok(def.descricao && def.detalhe.length > 40);
  }
});

test('Marcador de Giz: +2 Mult por tento do adversário', () => {
  const { bus, inst, jogo } = montar('marcador_de_giz');
  jogo.run.mesa.tentosAdv = 7;
  bus.emit('OnVazaResolvida', { vaza: { vencedor: 0 } });
  assert.equal(inst.estado.tentos, 7);
  const r = vaza(c('A', 'paus'), 'vaza_simples', [inst]);
  assert.equal(r.mult, 15);
  assert.equal(r.totalFinal, 15 * 15);
  // sem tentos, nada muda
  jogo.run.mesa.tentosAdv = 0;
  bus.emit('OnMaoDistribuida', {});
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).mult, 1);
});

test('Torcedor Sofredor: ×2,5 só na mão vencida Na Raça (0,1,0)', () => {
  const { bus, inst } = montar('torcedor_sofredor');
  bus.emit('OnMaoDistribuida', {});
  for (const v of [0, 1, 0]) bus.emit('OnVazaResolvida', { vaza: { vencedor: v } });
  const r = pontuarMao({ dados, niveis, vazas: [{ total: 80 }], valor: 3, comparsas: [inst] });
  assert.equal(r.total, 80 * 2.5 * 3);
  // Virada (1,0,0) não conta; a mão nova zera o registro
  bus.emit('OnMaoDistribuida', {});
  for (const v of [1, 0, 0]) bus.emit('OnVazaResolvida', { vaza: { vencedor: v } });
  assert.equal(pontuarMao({ dados, niveis, vazas: [{ total: 80 }], valor: 1, comparsas: [inst] }).total, 80);
});

test('Brigão da Esquina: +5 Mult na mão em que o adversário aceitou seu truco', () => {
  const { bus, inst } = montar('brigao_da_esquina');
  bus.emit('OnMaoDistribuida', {});
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).mult, 1);
  // você aceitando o truco dele não conta
  bus.emit('OnTrucoRespondido', { jogador: 0, time: 0, resposta: 'aceitar' });
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).mult, 1);
  bus.emit('OnTrucoRespondido', { jogador: 1, time: 1, resposta: 'aceitar' });
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).totalFinal, 15 * 6);
  // mão seguinte começa sem o bônus
  bus.emit('OnMaoDistribuida', {});
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).mult, 1);
  // aumentar também é aceitar
  bus.emit('OnTrucoRespondido', { jogador: 1, time: 1, resposta: 'aumentar' });
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).mult, 6);
});

test('Técnico da Várzea: +15 Fichas por uso do poder nesta Mesa, até 3 usos', () => {
  const { bus, inst, jogo } = montar('tecnico_da_varzea');
  bus.emit('OnMesaIniciada', {});
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).fichas, 15);
  jogo.run.mesa.poderUsos = 1;
  bus.emit('OnPoderUsado', { poder: 'reza_forte' });
  jogo.run.mesa.poderUsos = 2;
  bus.emit('OnPoderUsado', { poder: 'reza_forte' });
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).fichas, 45);
  // a partir do 4º uso não soma mais (máximo +45)
  for (const n of [3, 4, 5]) {
    jogo.run.mesa.poderUsos = n;
    bus.emit('OnPoderUsado', { poder: 'reza_forte' });
  }
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).fichas, 60);
  bus.emit('OnMesaIniciada', {});
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).fichas, 15);
});

test('Rei da Sinuca: ×1,5 por naipe de manilha vencido na Mesa, contando o atual', () => {
  const { bus, inst } = montar('rei_da_sinuca');
  bus.emit('OnMesaIniciada', {});
  const base = vaza(c('Q', 'copas'), 'manilhada', []).mult;
  // carta comum: nada
  assert.equal(vaza(c('A', 'paus'), 'vaza_simples', [inst]).mult, 1);
  // 1ª manilha: ×1,5
  assert.equal(vaza(c('Q', 'espadas'), 'manilhada', [inst]).mult, base * 1.5);
  bus.emit('OnVazaPontuada', { carta: c('Q', 'espadas'), jogada: 'manilhada' });
  // Zap depois da Espadilha: 2 naipes = ×2
  const zap = vaza(c('Q', 'paus'), 'zapada', []).mult;
  assert.equal(vaza(c('Q', 'paus'), 'zapada', [inst]).mult, zap * 2);
  // repetir o naipe não soma
  assert.equal(vaza(c('Q', 'espadas'), 'manilhada', [inst]).mult, base * 1.5);
  for (const s of ['paus', 'copas', 'ouros']) bus.emit('OnVazaPontuada', { carta: c('Q', s), jogada: s === 'paus' ? 'zapada' : 'manilhada' });
  assert.deepEqual([...inst.estado.naipes].sort(), ['copas', 'espadas', 'ouros', 'paus']);
  assert.equal(vaza(c('Q', 'copas'), 'manilhada', [inst]).mult, base * 3);
  // rodada comum não entra na coleção; Mesa nova zera
  bus.emit('OnMesaIniciada', {});
  bus.emit('OnVazaPontuada', { carta: c('A', 'paus'), jogada: 'vaza_simples' });
  assert.deepEqual(inst.estado.naipes, []);
});

test('Comparsas novos funcionam numa Mesa de verdade (sem quebrar a run)', async () => {
  const { Jogo } = await import('../src/core/run.js');
  const j = Jogo.novaRun(dados, { seed: 'novos-comparsas', baralhoId: 'boteco' });
  for (const id of NOVOS) j.adicionarComparsa(id);
  j.iniciarMesa();
  const r = j.run;
  let passos = 0;
  while (r.fase === 'mesa' && passos++ < 500) {
    const rd = j.rodada;
    if (rd.fase === 'vira') j.escolherVira(0);
    else if (rd.fase === 'troca') {
      if (j.podePedirTruco()) j.pedirTruco();
      else if (j.podeAbrirParaIA()) j.comecarRodada();
      else j.jogarCarta(r.mesa.mao[0]);
    } else if (rd.fase === 'jogo') {
      const st = rd.mao;
      if (j.iaPrecisaAgir()) j.passoIA();
      else if (st.pedido && st.pedido.por === 1) j.responderTruco('aceitar');
      else j.jogarCarta(st.maos[0][0].id);
    } else if (rd.fase === 'fim') j.proximaMao();
  }
  assert.notEqual(r.fase, 'mesa');
  for (const inst of r.comparsas) assert.ok(inst.estado, inst.id);
});
