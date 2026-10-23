// Cartas, ordem de força, vira e manilhas do Truco Paulista.

export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
// Ordem das manilhas por naipe (fraca → forte)
export const SUITS = ['ouros', 'espadas', 'copas', 'paus'];
export const SUIT_SYMBOL = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' };
export const SUIT_NOME = { ouros: 'Ouros', espadas: 'Espadas', copas: 'Copas', paus: 'Paus' };
export const MANILHA_NOME = { ouros: 'Pica-fumo', espadas: 'Espadilha', copas: 'Copas', paus: 'Zap' };

export function criarCarta(id, rank, suit) {
  return { id, rank, suit, bonusFichas: 0, melhoria: null, selo: null };
}

export function baralhoPadrao(prefixo = 'c') {
  const cartas = [];
  let i = 0;
  for (const suit of SUITS) for (const rank of RANKS) cartas.push(criarCarta(`${prefixo}${i++}`, rank, suit));
  return cartas;
}

export function manilhaRank(vira) {
  return RANKS[(RANKS.indexOf(vira.rank) + 1) % RANKS.length];
}

// ctx de força: { vira, invertida?, extraManilha?(carta), zapAlias?(carta) }
export function isManilha(carta, ctx) {
  return carta.rank === manilhaRank(ctx.vira) || !!ctx.extraManilha?.(carta);
}

function naipeManilha(carta, ctx) {
  if (ctx.zapAlias?.(carta)) return 3;
  if (carta.rank === manilhaRank(ctx.vira)) return SUITS.indexOf(carta.suit);
  return -1; // manilha "extra" (Comparsa): abaixo de todas as verdadeiras
}

export function isZap(carta, ctx) {
  return isManilha(carta, ctx) && naipeManilha(carta, ctx) === 3;
}

export function forca(carta, ctx) {
  if (isManilha(carta, ctx)) return 100 + naipeManilha(carta, ctx);
  const r = RANKS.indexOf(carta.rank);
  return ctx.invertida ? RANKS.length - 1 - r : r;
}

export function comparar(a, b, ctx) {
  return Math.sign(forca(a, ctx) - forca(b, ctx));
}

export function nomeCarta(carta, ctx) {
  const base = `${carta.rank}${SUIT_SYMBOL[carta.suit]}`;
  if (ctx && isManilha(carta, ctx) && carta.rank === manilhaRank(ctx.vira)) return `${base} (${MANILHA_NOME[carta.suit]})`;
  return base;
}
