// "Palco" da pontuação: a carta que venceu a rodada vai para o centro da tela, cada Comparsa
// que ajuda solta um raio do slot dele até a carta, e as Fichas/Mult saltam da carta.
// Toque no palco para acelerar.

import { esc, fmt } from './componentes.js';
import { audio } from './audio.js';

const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
let el = null;
let rapido = false;

const espera = (ms) => new Promise((r) => setTimeout(r, rapido ? ms / 5 : ms));

function abrir(conteudo, titulo) {
  fechar(true);
  rapido = false;
  el = document.createElement('div');
  el.className = 'palco';
  el.setAttribute('role', 'status');
  el.innerHTML = `<svg class="raios" aria-hidden="true"></svg>
    <div class="palco-centro">
      <div class="palco-jogada">${esc(titulo)}</div>
      ${conteudo}
      <div class="palco-total" aria-live="polite"></div>
    </div>
    <div class="palco-dica">Toque para acelerar</div>`;
  el.addEventListener('pointerdown', () => { rapido = true; el?.classList.add('rapido'); });
  document.body.appendChild(el);
  audio.tocar('palco');
}

function fechar(imediato = false) {
  if (!el) return;
  const velho = el;
  el = null;
  if (imediato || reduzido) { velho.remove(); return; }
  velho.classList.add('saindo');
  setTimeout(() => velho.remove(), 260);
}

function centroDe(alvo) {
  const r = alvo.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Raio em zigue-zague do slot do Comparsa até o alvo (carta ou total)
function raio(uid, alvo) {
  const slot = document.querySelector(`.slot[data-uid="${uid}"]`);
  const svg = el?.querySelector('.raios');
  if (!slot || !svg || !alvo) return;
  slot.classList.remove('pulo', 'disparou');
  void slot.offsetWidth;
  slot.classList.add('pulo', 'disparou');
  const a = centroDe(slot);
  const b = centroDe(alvo);
  const n = 7;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const desvio = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 60;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    pts.push(`${a.x + dx * t + (-dy / len) * desvio},${a.y + dy * t + (dx / len) * desvio}`);
  }
  const ns = 'http://www.w3.org/2000/svg';
  for (const classe of ['brilho', 'nucleo']) {
    const l = document.createElementNS(ns, 'polyline');
    l.setAttribute('points', pts.join(' '));
    l.setAttribute('class', `raio ${classe}`);
    svg.appendChild(l);
    setTimeout(() => l.remove(), 700);
  }
  alvo.classList.remove('atingida');
  void alvo.offsetWidth;
  alvo.classList.add('atingida');
}

// Número que salta da carta: "+15 Fichas", "×2 Mult"...
function saltar(alvo, texto, classe) {
  if (!el || !alvo) return;
  const c = centroDe(alvo);
  const f = document.createElement('div');
  f.className = `salta ${classe}`;
  f.textContent = texto;
  f.style.left = `${c.x + (Math.random() - 0.5) * 120}px`;
  f.style.top = `${c.y - 30 + (Math.random() - 0.5) * 50}px`;
  el.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}

function caixas(fichas, mult, qual) {
  const conta = el?.querySelector('.palco-conta');
  if (!conta) return;
  conta.querySelector('.f').textContent = fmt(fichas);
  conta.querySelector('.m').textContent = mult;
  const caixa = conta.querySelector(qual === 'fichas' ? '.f' : '.m');
  caixa.classList.remove('pop');
  void caixa.offsetWidth;
  caixa.classList.add('pop');
}

function textoPasso(p) {
  if (p.tipo === 'fichas') return [`+${p.valor} Fichas`, 'f'];
  if (p.tipo === 'mult') return [`+${p.valor} Mult`, 'm'];
  if (p.tipo === 'xmult') return [`×${p.valor} Mult`, 'x'];
  if (p.tipo === 'anula') return ['Não pontua!', 'ruim'];
  if (p.tipo === 'metade') return [p.valor === 0.5 ? 'Vale metade' : `×${p.valor}`, 'ruim'];
  return [p.origem, 'f'];
}

// ev: OnVazaPontuada { carta, jogada, passos, total } · cartaHtml: a carta já desenhada
export async function palcoRodada(ev, { cartaHtml, nomeJogada, nomeComparsa, ms }) {
  abrir(`<div class="palco-carta">${cartaHtml}</div>
    <div class="palco-conta"><div class="caixa f">0</div><span class="num">×</span><div class="caixa m">0</div></div>
    <div class="palco-origem"></div>`, nomeJogada);
  const carta = el.querySelector('.palco-carta');
  const origem = el.querySelector('.palco-origem');
  await espera(ms.entrada);
  let i = 0;
  for (const p of ev.passos) {
    const [texto, classe] = textoPasso(p);
    if (p.comparsa) {
      raio(p.comparsa, carta);
      audio.tocar('raio', i);
    } else {
      audio.tocar('ponto', i);
    }
    saltar(carta, texto, classe);
    caixas(p.fichas, p.mult, p.tipo === 'fichas' ? 'fichas' : 'mult');
    origem.textContent = p.comparsa ? `${nomeComparsa(p.comparsa) ?? p.origem}` : p.origem;
    i++;
    await espera(p.comparsa ? ms.raio : ms.passo);
  }
  const total = el.querySelector('.palco-total');
  total.innerHTML = ev.total ? `= ${fmt(ev.total)}` : 'Não pontuou';
  total.classList.add('aparece');
  audio.tocar('total');
  await espera(ms.total);
  fechar();
}

// ev: MaoPontuada { passos: [{tipo:'soma'|'x', valor, origem, total, comparsa}] }
export async function palcoMao(ev, { titulo, nomeComparsa, ms }) {
  abrir(`<ul class="palco-linhas"></ul>`, titulo);
  const linhas = el.querySelector('.palco-linhas');
  const total = el.querySelector('.palco-total');
  await espera(ms.entrada / 2);
  let i = 0;
  for (const p of ev.passos) {
    const li = document.createElement('li');
    const origem = p.comparsa ? nomeComparsa(p.comparsa) ?? p.origem : p.origem;
    li.innerHTML = `<span>${esc(origem)}</span><b class="${p.tipo === 'x' ? 'x' : 'f'}">${p.tipo === 'x' ? `×${p.valor}` : `+${fmt(p.valor)}`}</b>`;
    linhas.appendChild(li);
    total.textContent = fmt(p.total);
    total.classList.remove('pop');
    void total.offsetWidth;
    total.classList.add('pop', 'aparece');
    if (p.comparsa) {
      raio(p.comparsa, total);
      audio.tocar('raio', 4 + i);
    } else {
      audio.tocar('ponto', 4 + i);
    }
    i++;
    await espera(p.comparsa || p.tipo === 'x' ? ms.raio : ms.passo);
  }
  audio.tocar('total');
  await espera(ms.total);
  fechar();
}
