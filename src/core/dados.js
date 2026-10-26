// Junta os arquivos JSON de /data num objeto de consulta.

export const ARQUIVOS_DADOS = ['cartas', 'jogadas', 'regras', 'comparsas', 'consumiveis', 'adversarios', 'personagens', 'baralhos', 'bazar', 'eventos', 'jogadores'];

const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));

export function montarDados(raw) {
  const { cartas, jogadas, regras, comparsas, consumiveis, adversarios, personagens, baralhos, bazar, eventos, jogadores } = raw;
  const chefoes = personagens.filter((p) => p.tipo === 'chefao');
  return {
    cartas,
    regras,
    jogadasLista: jogadas,
    jogadas: porId(jogadas),
    comparsas,
    comparsasPorId: porId(comparsas),
    causos: consumiveis.causos,
    causosPorId: porId(consumiveis.causos),
    simpatias: consumiveis.simpatias,
    simpatiasPorId: porId(consumiveis.simpatias),
    perfisPorId: porId(adversarios.perfis),
    personagens,
    personagensPorId: porId(personagens),
    chefoes,
    chefoesPorId: porId(chefoes),
    falas: adversarios.falas,
    baralhos,
    baralhosPorId: porId(baralhos),
    bazar,
    bazarPorId: porId(bazar.itens),
    eventos,
    eventosPorId: porId(eventos.eventos),
    jogadores,
    jogadoresPorId: porId(jogadores),
  };
}

export function defConsumivel(dados, item) {
  return item.tipo === 'causo' ? dados.causosPorId[item.id] : dados.simpatiasPorId[item.id];
}

// Perfil de IA de um personagem: o perfil base com os traços dele por cima.
export function perfilDe(dados, pessoa) {
  return { ...dados.perfisPorId[pessoa.perfil], ...(pessoa.tracos ?? {}), nome: pessoa.nome };
}

// Fala de um personagem para um momento, com as falas genéricas de reserva.
export function falasDe(dados, pessoa, momento) {
  const proprias = pessoa?.falas?.[momento];
  return proprias?.length ? proprias : dados.falas[momento] ?? [];
}
