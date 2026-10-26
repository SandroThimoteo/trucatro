// Comparsas: efeitos declarados em data/comparsas.json, implementados aqui por tipo.
// Cada tipo pode ter fases de pontuação (fichas, mult, xmult, mao) e/ou
// registrar observadores no GameEventBus. A ordem dos slots define a ordem dos efeitos.

export const DONO_COMPARSAS = 'comparsas';

export const EFEITOS = {
  multPorNaipe: {
    mult(ctx, e, inst, def) {
      if (ctx.carta.suit === e.naipe) ctx.addMult(e.valor, def.nome, inst.uid);
    },
  },
  fichasPorVaza: {
    fichas(ctx, e, inst, def) {
      ctx.addFichas(e.valor, def.nome, inst.uid);
    },
  },
  multPrimeiraVaza: {
    mult(ctx, e, inst, def) {
      if (ctx.vazaIndice === 0) ctx.addMult(e.valor, def.nome, inst.uid);
    },
  },
  multPorVazaVencida: {
    mult(ctx, e, inst, def) {
      if (ctx.vazasVencidasAntes > 0) ctx.addMult(e.valor * ctx.vazasVencidasAntes, def.nome, inst.uid);
    },
  },
  multPorCauso: {
    mult(ctx, e, inst, def) {
      if (ctx.causosUsados > 0) ctx.addMult(e.valor * ctx.causosUsados, def.nome, inst.uid);
    },
  },
  xmultCartasBaixas: {
    xmult(ctx, e, inst, def) {
      if (!ctx.manilha && e.ranks.includes(ctx.carta.rank)) ctx.mulMult(e.valor, def.nome, inst.uid);
    },
  },
  cangadaVence: {
    fichas(ctx, e, inst, def) {
      if (ctx.jogada === 'cangada') ctx.addFichas(e.fichas, def.nome, inst.uid);
    },
  },
  xmultTodaVaza: {
    xmult(ctx, e, inst, def) {
      ctx.mulMult(e.valor, def.nome, inst.uid);
    },
  },
  reisPorNaipe: {
    registrar(bus, e, inst, def, jogo) {
      bus.on('OnVazaPontuada', (ev) => {
        if (!inst.desativada && ev.carta.suit === e.naipe) jogo.ganharReis(e.valor, def.nome, inst.uid);
      }, DONO_COMPARSAS);
    },
  },
  bonusAposCorrida: {
    registrar(bus, e, inst, def, jogo) {
      bus.on('OnTrucoRespondido', (ev) => {
        if (inst.desativada || ev.jogador !== 1 || ev.resposta !== 'correr') return;
        jogo.ganharReis(e.reis, def.nome, inst.uid);
        inst.estado.maoAlvo = ev.maoIndice + 1;
      }, DONO_COMPARSAS);
    },
    xmult(ctx, e, inst, def) {
      if (inst.estado.maoAlvo === ctx.maoIndice) ctx.mulMult(e.xmult, def.nome, inst.uid);
    },
  },
  maoXMultPorAumento: {
    mao(ctx, e, inst, def) {
      const n = ctx.aumentos;
      if (n > 0) ctx.multiplicar(e.valor ** n, def.nome, inst.uid);
    },
  },
  // ---------- Comparsas novos (out/2026) ----------
  // Marcador de Giz: +Mult por tento do adversário. Os tentos são lidos da Mesa
  // nos eventos que vêm antes da pontuação e guardados no estado do Comparsa.
  multPorTentoAdv: {
    registrar(bus, e, inst, def, jogo) {
      const ler = () => { inst.estado.tentos = jogo.run.mesa?.tentosAdv ?? 0; };
      for (const tipo of ['OnMesaIniciada', 'OnMaoDistribuida', 'OnVazaResolvida', 'OnTrucoRespondido', 'OnPoderUsado']) bus.on(tipo, ler, DONO_COMPARSAS);
    },
    mult(ctx, e, inst, def) {
      const t = inst.estado.tentos ?? 0;
      if (t > 0) ctx.addMult(e.valor * t, def.nome, inst.uid);
    },
  },
  // Torcedor Sofredor: ×pontos da mão vencida Na Raça (ganhou, perdeu, ganhou).
  maoXMultNaRaca: {
    registrar(bus, e, inst, def, jogo) {
      bus.on('OnMaoDistribuida', () => { inst.estado.resultados = []; }, DONO_COMPARSAS);
      bus.on('OnVazaResolvida', (ev) => {
        (inst.estado.resultados ??= []).push(ev.vaza?.vencedor);
      }, DONO_COMPARSAS);
    },
    mao(ctx, e, inst, def) {
      if ((inst.estado.resultados ?? []).join() === '0,1,0') ctx.multiplicar(e.valor, def.nome, inst.uid);
    },
  },
  // Brigão da Esquina: +Mult nas rodadas da mão em que o adversário aceitou (ou aumentou) seu truco.
  multTrucoAceito: {
    registrar(bus, e, inst, def, jogo) {
      bus.on('OnMaoDistribuida', () => { inst.estado.aceitou = false; }, DONO_COMPARSAS);
      bus.on('OnTrucoRespondido', (ev) => {
        if (inst.desativada || (ev.time ?? ev.jogador) !== 1) return;
        if (ev.resposta === 'aceitar' || ev.resposta === 'aumentar') inst.estado.aceitou = true;
      }, DONO_COMPARSAS);
    },
    mult(ctx, e, inst, def) {
      if (inst.estado.aceitou) ctx.addMult(e.valor, def.nome, inst.uid);
    },
  },
  // Técnico da Várzea: +Fichas por rodada vencida para cada uso do poder do personagem nesta Mesa (até maxUsos).
  fichasPorPoderUsado: {
    registrar(bus, e, inst, def, jogo) {
      bus.on('OnMesaIniciada', () => { inst.estado.poderes = 0; }, DONO_COMPARSAS);
      bus.on('OnPoderUsado', () => { inst.estado.poderes = jogo.run.mesa?.poderUsos ?? (inst.estado.poderes ?? 0) + 1; }, DONO_COMPARSAS);
    },
    fichas(ctx, e, inst, def) {
      const n = Math.min(inst.estado.poderes ?? 0, e.maxUsos ?? Infinity);
      if (n > 0) ctx.addFichas(e.valor * n, def.nome, inst.uid);
    },
  },
  // Rei da Sinuca: rodada vencida com manilha ganha ×Mult conforme quantos naipes
  // de manilha diferentes você já venceu nesta Mesa (contando a atual).
  xmultNaipesManilha: {
    registrar(bus, e, inst, def, jogo) {
      bus.on('OnMesaIniciada', () => { inst.estado.naipes = []; }, DONO_COMPARSAS);
      bus.on('OnVazaPontuada', (ev) => {
        if (inst.desativada || !['manilhada', 'zapada'].includes(ev.jogada)) return;
        const naipes = (inst.estado.naipes ??= []);
        if (!naipes.includes(ev.carta.suit)) naipes.push(ev.carta.suit);
      }, DONO_COMPARSAS);
    },
    xmult(ctx, e, inst, def) {
      if (!ctx.manilha && !ctx.zap && !['manilhada', 'zapada'].includes(ctx.jogada)) return;
      const naipes = new Set([...(inst.estado.naipes ?? []), ctx.carta.suit]);
      ctx.mulMult(1 + e.porNaipe * naipes.size, def.nome, inst.uid);
    },
  },
  // Regras consultadas pelo motor (sem fase de pontuação)
  picaFumoPirata: {},
  viraDupla: {},
  zapDuplo: {},
  valorInicialPrimeiraMao: {},
  benzedeira: {},
};

function ativos(comparsas, dados) {
  return comparsas
    .filter((inst) => !inst.desativada)
    .map((inst) => ({ inst, def: dados.comparsasPorId[inst.id] }))
    .filter(({ def }) => def);
}

export function aplicarFase(ctx, fase, comparsas, dados) {
  for (const { inst, def } of ativos(comparsas, dados)) {
    const fn = EFEITOS[def.efeito.tipo]?.[fase];
    if (fn) fn(ctx, def.efeito, inst, def);
  }
}

// Retorna o efeito do primeiro Comparsa ativo com esse tipo, ou null.
export function regraAtiva(comparsas, dados, tipo) {
  const achado = ativos(comparsas, dados).find(({ def }) => def.efeito.tipo === tipo);
  return achado ? achado.def.efeito : null;
}

export function registrarComparsas(bus, jogo) {
  bus.offDono(DONO_COMPARSAS);
  for (const inst of jogo.run.comparsas) {
    const def = jogo.dados.comparsasPorId[inst.id];
    EFEITOS[def?.efeito.tipo]?.registrar?.(bus, def.efeito, inst, def, jogo);
  }
}
