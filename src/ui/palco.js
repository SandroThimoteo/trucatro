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
  el.innerHTML = `<div class="palco-sol" aria-hidden="true"></div><svg class="raios" aria-hidden="true"></svg>
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

// Forma do raio comprada no Bazar (classe forma-* no body)
const forma = () => (document.body.className.match(/\bforma-(\w+)/)?.[1] ?? 'zigue');
const ns = 'http://www.w3.org/2000/svg';

// Pontos de um traço de a até b: zigue-zague (desvio aleatório) ou onda (corrente)
function caminho(a, b, n, amp, onda = false, fase = 0) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ponta = i === 0 || i === n;
    const desvio = ponta ? 0 : onda ? Math.sin(t * Math.PI * 4 + fase) * amp * Math.sin(t * Math.PI) : (Math.random() - 0.5) * amp;
    pts.push([a.x + dx * t + (-dy / len) * desvio, a.y + dy * t + (dx / len) * desvio]);
  }
  return pts;
}

function tracar(svg, pts, extra = '') {
  for (const classe of ['brilho', 'nucleo']) {
    const l = document.createElementNS(ns, 'polyline');
    l.setAttribute('points', pts.map((q) => q.join(',')).join(' '));
    l.setAttribute('class', `raio ${classe} ${extra}`);
    svg.appendChild(l);
    setTimeout(() => l.remove(), 750);
  }
}

// Raio do slot do Comparsa até o alvo (carta ou total)
function raio(uid, alvo, forte = false) {
  const slot = document.querySelector(`.slot[data-uid="${uid}"]`);
  const svg = el?.querySelector('.raios');
  if (!slot || !svg || !alvo) return;
  slot.classList.remove('pulo', 'disparou');
  void slot.offsetWidth;
  slot.classList.add('pulo', 'disparou');
  const a = centroDe(slot);
  const b = centroDe(alvo);
  const f = forma();
  if (f === 'corrente') {
    tracar(svg, caminho(a, b, 40, 26, true));
    tracar(svg, caminho(a, b, 40, 26, true, Math.PI), 'fino');
  } else if (f === 'duplo') {
    tracar(svg, caminho({ x: a.x - 10, y: a.y }, b, 8, 70));
    tracar(svg, caminho({ x: a.x + 10, y: a.y }, b, 8, 70));
  } else {
    const pts = caminho(a, b, f === 'galho' ? 10 : 7, 60);
    tracar(svg, pts);
    // galhos: pedaços que saem do meio do raio e morrem no ar
    const galhos = f === 'galho' ? 4 : forte ? 2 : 1;
    for (let g = 0; g < galhos; g++) {
      const [x, y] = pts[1 + Math.floor(Math.random() * (pts.length - 3))];
      const ponta = { x: x + (Math.random() - 0.5) * 160, y: y + (Math.random() - 0.2) * 120 };
      tracar(svg, caminho({ x, y }, ponta, 4, 30), 'fino');
    }
  }
  atingir(alvo, forte);
}

// Impacto: a carta pisca, solta faíscas e uma onda de choque
function atingir(alvo, forte = false) {
  alvo.classList.remove('atingida');
  void alvo.offsetWidth;
  alvo.classList.add('atingida');
  if (!el || reduzido) return;
  const c = centroDe(alvo);
  const onda = document.createElement('div');
  onda.className = `onda ${forte ? 'forte' : ''}`;
  onda.style.left = `${c.x}px`;
  onda.style.top = `${c.y}px`;
  el.appendChild(onda);
  setTimeout(() => onda.remove(), 700);
  const n = forte ? 22 : 12;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'faisca';
    const ang = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * (forte ? 180 : 110);
    s.style.left = `${c.x}px`;
    s.style.top = `${c.y}px`;
    s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    s.style.setProperty('--rot', `${(ang * 180) / Math.PI}deg`);
    el.appendChild(s);
    setTimeout(() => s.remove(), 750);
  }
}

// O sol atrás da carta cresce a cada ponto; ×Mult faz a tela tremer
function aquecer(nivel, treme) {
  if (!el) return;
  el.style.setProperty('--calor', Math.min(1, nivel).toFixed(2));
  if (treme && !reduzido) {
    el.classList.remove('treme');
    void el.offsetWidth;
    el.classList.add('treme');
  }
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
    const forte = p.tipo === 'xmult';
    if (p.comparsa) {
      raio(p.comparsa, carta, forte);
      audio.tocar('raio', i);
    } else {
      atingir(carta, forte);
      audio.tocar('ponto', i);
    }
    aquecer((i + 1) / Math.max(3, ev.passos.length), forte);
    saltar(carta, texto, classe);
    caixas(p.fichas, p.mult, p.tipo === 'fichas' ? 'fichas' : 'mult');
    origem.textContent = p.comparsa ? `${nomeComparsa(p.comparsa) ?? p.origem}` : p.origem;
    i++;
    await espera(p.comparsa ? ms.raio : ms.passo);
  }
  const total = el.querySelector('.palco-total');
  total.innerHTML = ev.total ? `= ${fmt(ev.total)}` : 'Não pontuou';
  total.classList.add('aparece');
  if (ev.total) {
    aquecer(1, true);
    atingir(carta, true);
    el.classList.add('explode');
  }
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
    aquecer((i + 1) / ev.passos.length, p.tipo === 'x');
    if (p.comparsa) {
      raio(p.comparsa, total, p.tipo === 'x');
      audio.tocar('raio', 4 + i);
    } else {
      if (p.tipo === 'x') atingir(total, true);
      audio.tocar('ponto', 4 + i);
    }
    i++;
    await espera(p.comparsa || p.tipo === 'x' ? ms.raio : ms.passo);
  }
  audio.tocar('total');
  await espera(ms.total);
  fechar();
}
