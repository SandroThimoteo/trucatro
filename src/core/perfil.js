// Progresso do jogador que fica entre as runs: Tampinhas, compras do Bazar, itens equipados,
// recordes, opções de som e a run em andamento. JSON puro, salvo pela conta (ui/conta.js).

export const VERSAO_PERFIL = 1;

export function novoPerfil(dados) {
  const gratis = dados.bazar.itens.filter((i) => i.preco === 0);
  return normalizarPerfil(dados, {
    versao: VERSAO_PERFIL,
    tampinhas: 0,
    compras: gratis.map((i) => i.id),
    equipado: Object.fromEntries(gratis.map((i) => [i.categoria, i.id])),
    recordes: { runs: 0, vitorias: 0, melhorBairro: 0, maiorMao: 0, chefoesVencidos: 0, tampinhasTotal: 0 },
    opcoes: { musica: 0.5, ambiente: 0.5, efeitos: 0.8, vozes: 0.9, mudo: false },
    save: null,
    atualizadoEm: 0,
  });
}

// Completa campos que faltam (perfil antigo ou vindo de outra versão) sem perder nada.
export function normalizarPerfil(dados, p) {
  const base = p ?? {};
  const gratis = dados.bazar.itens.filter((i) => i.preco === 0);
  const compras = new Set([...(base.compras ?? []), ...gratis.map((i) => i.id)]);
  const equipado = { ...(base.equipado ?? {}) };
  for (const cat of dados.bazar.categorias) {
    const atual = dados.bazarPorId[equipado[cat.id]];
    if (!atual || atual.categoria !== cat.id || !compras.has(atual.id)) equipado[cat.id] = gratis.find((i) => i.categoria === cat.id)?.id;
  }
  return {
    versao: VERSAO_PERFIL,
    tampinhas: Math.max(0, Math.floor(base.tampinhas ?? 0)),
    compras: [...compras],
    equipado,
    recordes: { runs: 0, vitorias: 0, melhorBairro: 0, maiorMao: 0, chefoesVencidos: 0, tampinhasTotal: 0, ...(base.recordes ?? {}) },
    opcoes: { musica: 0.5, ambiente: 0.5, efeitos: 0.8, vozes: 0.9, mudo: false, ...(base.opcoes ?? {}) },
    save: typeof base.save === 'string' ? base.save : null,
    atualizadoEm: base.atualizadoEm ?? 0,
  };
}

export function itemEquipado(dados, perfil, categoria) {
  return dados.bazarPorId[perfil.equipado[categoria]];
}

export function comprarItem(dados, perfil, id) {
  const item = dados.bazarPorId[id];
  if (!item) throw new Error('Item não existe');
  if (perfil.compras.includes(id)) throw new Error('Você já tem esse item');
  if (perfil.tampinhas < item.preco) throw new Error(`Faltam ${item.preco - perfil.tampinhas} Tampinhas`);
  perfil.tampinhas -= item.preco;
  perfil.compras.push(id);
  perfil.equipado[item.categoria] = id;
}

export function equiparItem(dados, perfil, id) {
  const item = dados.bazarPorId[id];
  if (!item || !perfil.compras.includes(id)) throw new Error('Compre o item primeiro');
  perfil.equipado[item.categoria] = id;
}

// Recompensa de uma Mesa vencida (só Chefões dão Tampinhas) e recordes.
export function registrarMesa(perfil, resultadoMesa) {
  if (!resultadoMesa?.venceu) return;
  const t = resultadoMesa.tampinhas ?? 0;
  if (t > 0) {
    perfil.tampinhas += t;
    perfil.recordes.tampinhasTotal += t;
    perfil.recordes.chefoesVencidos++;
  }
}

export function registrarFimDeRun(perfil, run) {
  perfil.recordes.runs++;
  if (run.vitoria) perfil.recordes.vitorias++;
  perfil.recordes.melhorBairro = Math.max(perfil.recordes.melhorBairro, run.bairro);
  perfil.recordes.maiorMao = Math.max(perfil.recordes.maiorMao, run.stats.maiorMao);
}
