// Barramento de eventos do jogo. Comparsas e UI assinam eventos por aqui.

export const EVENTOS = [
  'OnMesaIniciada', 'OnMaoDistribuida', 'OnViraRevelada',
  'OnCartaJogada', 'OnVazaResolvida', 'OnVazaPontuada',
  'OnTrucoPedido', 'OnTrucoRespondido', 'OnMaoFinalizada',
  'OnMesaFinalizada', 'OnLojaAberta', 'OnCartaComprada',
];

export class GameEventBus {
  constructor() {
    this.handlers = [];
  }

  // tipo '*' recebe todos os eventos
  on(tipo, fn, dono = null) {
    this.handlers.push({ tipo, fn, dono });
    return () => this.off(fn);
  }

  off(fn) {
    this.handlers = this.handlers.filter((h) => h.fn !== fn);
  }

  offDono(dono) {
    this.handlers = this.handlers.filter((h) => h.dono !== dono);
  }

  emit(tipo, dados = {}) {
    const ev = { tipo, ...dados };
    for (const h of [...this.handlers]) if (h.tipo === tipo || h.tipo === '*') h.fn(ev);
    return ev;
  }
}
