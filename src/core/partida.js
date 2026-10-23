// Modo "Truco clássico": partida até 12 pontos contra a IA, com mão de onze e mão de ferro.

import { SeededRng } from './rng.js';
import { baralhoPadrao } from './cards.js';
import { criarMao, jogarCarta, pedirTruco, responderTruco } from './truco.js';
import { forcaMao, decidirAcao } from './ai.js';

export class PartidaClassica {
  constructor({ seed, perfil, pontosVitoria = 12 }) {
    this.seed = String(seed);
    this.rng = new SeededRng(seed);
    this.perfil = perfil;
    this.pontosVitoria = pontosVitoria;
    this.placar = [0, 0];
    this.pe = 0; // quem abre a mão
    this.vencedor = null;
    this.maoNumero = 0;
    this.ultimoResultado = null;
    this.novaMao();
  }

  get ctx() {
    return { vira: this.mao.vira };
  }

  novaMao() {
    const deck = this.rng.stream('baralho').shuffle(baralhoPadrao('k'));
    const h0 = deck.splice(0, 3);
    const h1 = deck.splice(0, 3);
    const vira = deck.pop();
    const onze = this.placar.map((p) => p === this.pontosVitoria - 1);
    this.ferro = onze[0] && onze[1];
    const maoDeOnze = !this.ferro && (onze[0] || onze[1]);
    this.mao = criarMao({
      maos: [h0, h1], vira, iniciante: this.pe,
      valor: maoDeOnze ? 3 : 1,
      trucoPermitido: !this.ferro && !maoDeOnze,
    });
    this.memoria = {};
    this.maoNumero++;
    this.ultimoResultado = null;
    this.fase = 'jogo';
    this.decisaoOnze = null;
    if (maoDeOnze) {
      const quem = onze[0] ? 0 : 1;
      this.fase = 'onze';
      this.decisaoOnze = quem;
      if (quem === 1) this.decidirOnze(1, forcaMao(h1, this.ctx) >= 0.45);
    }
  }

  // Mão de onze: quem tem 11 vê as cartas e decide jogar (vale 3) ou correr (o outro leva 1).
  decidirOnze(j, jogar) {
    if (this.fase !== 'onze' || this.decisaoOnze !== j) throw new Error('Não há decisão de mão de onze');
    this.decisaoOnze = null;
    if (jogar) {
      this.fase = 'jogo';
      return;
    }
    Object.assign(this.mao, { fim: true, vencedor: 1 - j, pontos: 1, correu: j });
    this.finalizarMao();
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
    this.ultimosEventos = eventos;
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
    this.pe = 1 - this.pe;
    this.novaMao();
  }

  iaPrecisaAgir() {
    if (this.fase !== 'jogo' || this.mao.fim) return false;
    const st = this.mao;
    return st.pedido ? st.pedido.por === 0 : st.vez === 1;
  }

  passoIA() {
    const acao = decidirAcao(this.mao, this.perfil, this.ctx, this.rng.stream('ia'), this.memoria);
    if (acao.tipo === 'responder') this.processar(responderTruco(this.mao, 1, acao.resposta));
    else if (acao.tipo === 'pedir') this.processar(pedirTruco(this.mao, 1));
    else this.processar(jogarCarta(this.mao, 1, acao.cartaId, this.ctx));
    return acao;
  }

  avancarIA() {
    let n = 0;
    while (this.iaPrecisaAgir() && n++ < 50) this.passoIA();
  }
}
