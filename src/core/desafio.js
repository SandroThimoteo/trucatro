// Desafio do dia: todo mundo joga a mesma run (mesma semente e baralho) no mesmo dia.
// O dia vira à meia-noite de Brasília, para o ranking ser o mesmo para todos.

export const BARALHO_DESAFIO = 'boteco';
export const TAMPINHAS_DESAFIO = 2; // por terminar o desafio do dia (uma vez por dia)

export function diaDeHoje(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function sementeDoDia(dia) {
  return `DIA${dia.replace(/-/g, '')}`;
}

// Pontuação: 1000 por Mesa vencida + todos os pontos feitos nas Mesas
export function pontuacaoDesafio(run) {
  return (run.stats.mesasVencidas ?? 0) * 1000 + Math.floor(run.stats.pontosTotais ?? 0);
}

export function resumoDesafio(run) {
  return { dia: run.desafio, pontos: pontuacaoDesafio(run), bairro: run.bairro, mesas: run.stats.mesasVencidas ?? 0 };
}
