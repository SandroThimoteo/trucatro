// Modo "Truco em dupla": você e um parceiro (IA) contra dois adversários, até 12 tentos.
// Lugares na mesa: 0 você, 1 adversário, 2 parceiro, 3 adversário (times: j % 2).
// Antes de cada mão, cada um faz um sinal para o parceiro; às vezes você pega o sinal dos outros.

import { SeededRng } from './rng.js';
import { baralhoPadrao } from './cards.js';
import { criarMao, jogarCarta, pedirTruco, responderTruco, quemResponde } from './truco.js';
import { decidirAcaoDupla, sinalDaMao } from './ai.js';

export const CHANCE_PEGAR_SINAL = 0.35;

export class PartidaDupla {
  // perfis: { 1, 2, 3 } perfis de IA de cada lugar
  constructor({ seed, perfis, pontosVitoria = 12 }) {
    this.seed = String(seed);
    this.rng = new SeededRng(seed);
    this.perfis = perfis;
    this.pontosVitoria = pontosVitoria;
    this.placar = [0, 0];
    this.pe = 0;
    this.vencedor = null;
    this.maoNumero = 0;
    this.ultimoResultado = null;
    this.ultimosEventos = [];
    this.novaMao();
  }

  get ctx() {
    return { vira: this.mao.vira };
  }

  novaMao() {
    const deck = this.rng.stream('baralho').shuffle(baralhoPadrao('k'));
    const maos = [0, 1, 2, 3].map(() => deck.splice(0, 3));
    const vira = deck.pop();
    const onze = this.placar.map((p) => p === this.pontosVitoria - 1);
    const ferro = onze[0] && onze[1];
    const maoDeOnze = !ferro && (onze[0] || onze[1]);
    this.mao = criarMao({ maos, vira, iniciante: this.pe, valor: maoDeOnze ? 3 : 1, trucoPermitido: !ferro && !maoDeOnze });
    this.onze = maoDeOnze;
    this.ferro = ferro;
    this.memoria = {};
    this.maoNumero++;
    this.ultimoResultado = null;
    this.fase = 'jogo';
    // Sinais: cada IA mostra ao parceiro o que tem; você vê o do seu parceiro
    // e, com sorte, pega o de um adversário.
    const s = this.rng.stream('sinais');
    this.sinais = { 0: null, 1: sinalDaMao(maos[1], this.ctx), 2: sinalDaMao(maos[2], this.ctx), 3: sinalDaMao(maos[3], this.ctx) };
    this.sinaisVistos = [1, 3].filter(() => s.next() < CHANCE_PEGAR_SINAL);
  }

  // Seu sinal para o parceiro (muda o jeito que ele joga)
  sinalizar(chave) {
    if (this.fase !== 'jogo' || this.mao.vazas.length) throw new Error('Sinal só antes da primeira rodada');
    this.sinais[0] = chave;
  }

  exigirJogo() {
    if (this.fase !== 'jogo') throw new Error('Agora não');
  }

  jogar(cartaId) {
    this.exigirJogo();
    this.processar(jogarCarta(this.mao, 0, cartaId, this.ctx));
  }

  truco() {
    this.exigirJogo();
    this.processar(pedirTruco(this.mao, 0));
  }

  responder(resposta) {
    this.exigirJogo();
    this.processar(responderTruco(this.mao, 0, resposta));
  }

  processar(eventos) {
    this.ultimosEventos = [...(this.ultimosEventos ?? []), ...eventos];
    if (eventos.some((e) => e.tipo === 'OnMaoFinalizada')) this.finalizarMao();
  }

  finalizarMao() {
    const { vencedor, pontos, correu } = this.mao;
    if (vencedor !== null) this.placar[vencedor] += pontos;
    this.ultimoResultado = { vencedor, pontos, correu };
    const campeao = this.placar.findIndex((p) => p >= this.pontosVitoria);
    if (campeao >= 0) {
      this.fase = 'fim';
      this.vencedor = campeao;
    } else {
      this.fase = 'fimMao';
    }
  }

  proximaMao() {
    if (this.fase !== 'fimMao') throw new Error('A mão ainda não acabou');
    this.pe = (this.pe + 1) % 4;
    this.novaMao();
  }

  // Quem tem que agir agora (null se for você)
  quemAge() {
    if (this.fase !== 'jogo' || this.mao.fim) return null;
    const st = this.mao;
    const j = st.pedido ? quemResponde(st) : st.vez;
    return j === 0 ? null : j;
  }

  iaPrecisaAgir() {
    return this.quemAge() !== null;
  }

  passoIA() {
    const j = this.quemAge();
    const acao = decidirAcaoDupla(this.mao, j, this.perfis[j], this.ctx, this.rng.stream(`ia${j}`), this.memoria, {
      sinais: this.sinais,
      naoPede: j === 2 && this.rng.stream('parceiro').next() < 0.5,
    });
    if (acao.tipo === 'responder') this.processar(responderTruco(this.mao, j, acao.resposta));
    else if (acao.tipo === 'pedir') this.processar(pedirTruco(this.mao, j));
    else this.processar(jogarCarta(this.mao, j, acao.cartaId, this.ctx));
    return { ...acao, jogador: j };
  }

  avancarIA() {
    let n = 0;
    while (this.iaPrecisaAgir() && n++ < 80) this.passoIA();
  }
}
