// Peças visuais reutilizadas pelas telas (HTML como string).

import { isManilha, isZap, manilhaRank, MANILHA_NOME, SUIT_SYMBOL, SUIT_NOME } from '../core/cards.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
export const fmt = (n) => Math.floor(n).toLocaleString('pt-BR');

export const NOME_RARIDADE = { comum: 'Comum', incomum: 'Incomum', rara: 'Rara', lendaria: 'Lendária' };
export const NOME_VALOR = { 3: 'TRUCO!', 6: 'SEIS!', 9: 'NOVE!', 12: 'DOZE!' };

export function descricaoCarta(c, dados) {
  const partes = [`${c.rank} de ${SUIT_NOME[c.suit]}`];
  if (c.melhoria) partes.push(dados.cartas.melhorias[c.melhoria].nome);
  if (c.selo) partes.push(dados.cartas.selos[c.selo].nome);
  if (c.bonusFichas) partes.push(`+${c.bonusFichas} Fichas`);
  return partes.join(' · ');
}

// opcoes: { ctx, sel, mini, estatica, acao, dados, entra }
export function cartaHTML(c, o = {}) {
  const vermelha = c.suit === 'ouros' || c.suit === 'copas';
  const man = o.ctx ? isManilha(c, o.ctx) : false;
  const zap = o.ctx ? isZap(c, o.ctx) : false;
  let tag = '';
  if (man) tag = zap ? 'Zap' : c.rank === manilhaRank(o.ctx.vira) ? MANILHA_NOME[c.suit] : 'Manilha';
  const classes = [
    'carta', vermelha ? 'vermelha' : 'preta', man && 'manilha', zap && 'zap',
    man && `man-${c.suit}`, o.perdeu && 'perdeu',
    c.melhoria && `mel-${c.melhoria}`, o.sel && 'sel', o.mini && 'mini', o.estatica && 'estatica', o.entra && 'entra',
  ].filter(Boolean).join(' ');
  const titulo = o.dados ? descricaoCarta(c, o.dados) + (tag ? ` · ${tag}` : '') : `${c.rank}${SUIT_SYMBOL[c.suit]}`;
  const tagName = o.estatica ? 'div' : 'button';
  const attrs = o.estatica ? '' : `type="button" data-acao="${o.acao ?? 'carta'}" data-arg="${esc(c.id)}" aria-pressed="${o.sel ? 'true' : 'false'}"`;
  return `<${tagName} class="${classes}" ${attrs} title="${esc(titulo)}" aria-label="${esc(titulo)}">
    <span class="canto">${esc(c.rank)}<i>${SUIT_SYMBOL[c.suit]}</i></span>
    <span class="centro"><b>${esc(c.rank)}</b><i>${SUIT_SYMBOL[c.suit]}</i></span>
    ${tag ? `<span class="tag">${tag}</span>` : ''}
    ${c.bonusFichas ? `<span class="bonus">+${c.bonusFichas}</span>` : ''}
    ${c.melhoria === 'marcada' ? '<span class="marca">✕</span>' : ''}
    ${c.selo ? `<span class="selo selo-${c.selo}"></span>` : ''}
  </${tagName}>`;
}

export function versoHTML({ mini = false, acao = null, arg = '' } = {}) {
  if (acao) return `<button type="button" class="carta verso ${mini ? 'mini' : ''}" data-acao="${acao}" data-arg="${esc(arg)}" aria-label="Carta virada"></button>`;
  return `<div class="carta verso ${mini ? 'mini' : ''}" aria-hidden="true"></div>`;
}

// Botão "i" que abre a explicação completa de qualquer coisa do jogo (tipo:id)
export function infoBtn(tipo, id, nome = '') {
  return `<button type="button" class="info acao" data-acao="detalhe" data-arg="${esc(tipo)}:${esc(id)}" aria-label="Como funciona${nome ? `: ${esc(nome)}` : ''}" title="Como funciona">i</button>`;
}

export function avatarHTML(pessoa, grande = false) {
  return `<span class="avatar ${grande ? 'grande' : ''} ${pessoa.tipo === 'chefao' ? 'chefe' : ''}" aria-hidden="true">${esc(pessoa.avatar)}</span>`;
}

export function slotComparsa(def, inst, extras = '') {
  return `<div class="slot ${inst?.desativada ? 'desativada' : ''}" ${inst ? `data-uid="${inst.uid}"` : ''}>
    ${infoBtn('comparsa', def.id, def.nome)}
    <span class="raridade r-${def.raridade}">${NOME_RARIDADE[def.raridade]}</span>
    <b>${esc(def.nome)}</b>
    <span>${esc(def.descricao)}</span>
    ${inst?.desativada ? '<em>Desativado nesta Mesa</em>' : ''}
    ${extras}
  </div>`;
}
