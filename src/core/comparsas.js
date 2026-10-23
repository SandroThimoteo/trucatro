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
