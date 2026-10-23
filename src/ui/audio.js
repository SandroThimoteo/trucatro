// Som do boteco, todo sintetizado (sem arquivos): música de fundo em ritmo de baião,
// burburinho com copos, efeitos de carta e as vozes dos personagens (síntese de fala do navegador).

let ctx = null;
let barramentos = null;
let opcoes = { musica: 0.5, ambiente: 0.5, efeitos: 0.8, vozes: 0.9, mudo: false };
let musicaTimer = null;
let ambienteNo = null;
let tiliques = null;
let vozes = [];

const VOL = { musica: 0.16, ambiente: 0.22, efeitos: 0.5 };

function criarContexto() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const mestre = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  mestre.connect(comp).connect(ctx.destination);
  barramentos = { mestre };
  for (const nome of ['musica', 'ambiente', 'efeitos']) {
    const g = ctx.createGain();
    g.connect(mestre);
    barramentos[nome] = g;
  }
  aplicarVolumes();
  return ctx;
}

function aplicarVolumes() {
  if (!barramentos) return;
  const t = ctx.currentTime;
  barramentos.mestre.gain.setTargetAtTime(opcoes.mudo ? 0 : 1, t, 0.05);
  for (const nome of ['musica', 'ambiente', 'efeitos']) barramentos[nome].gain.setTargetAtTime(opcoes[nome] * VOL[nome], t, 0.05);
}

// ---------- blocos de síntese ----------

let ruidoBuf = null;
function ruido() {
  if (ruidoBuf) return ruidoBuf;
  const n = ctx.sampleRate * 2;
  ruidoBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = ruidoBuf.getChannelData(0);
  let ultimo = 0;
  for (let i = 0; i < n; i++) {
    const b = Math.random() * 2 - 1;
    ultimo = (ultimo + 0.02 * b) / 1.02; // ruído marrom: grave, parece conversa ao longe
    d[i] = ultimo * 3.5;
  }
  return ruidoBuf;
}

let brancoBuf = null;
function branco() {
  if (brancoBuf) return brancoBuf;
  const n = ctx.sampleRate;
  brancoBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = brancoBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return brancoBuf;
}

function envelope(g, t, ataque, dur, pico) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tom({ freq, tipo = 'sine', t = ctx.currentTime, dur = 0.2, pico = 0.4, ataque = 0.005, destino = barramentos.efeitos, deslize = null, filtro = null }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  if (deslize) o.frequency.exponentialRampToValueAtTime(deslize, t + dur);
  let saida = o;
  if (filtro) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filtro, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(200, filtro / 6), t + dur);
    saida = o.connect(f);
  }
  saida.connect(g).connect(destino);
  envelope(g, t, ataque, dur, pico);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function chiado({ t = ctx.currentTime, dur = 0.08, freq = 2500, q = 1.2, pico = 0.4, tipo = 'bandpass', destino = barramentos.efeitos }) {
  const s = ctx.createBufferSource();
  s.buffer = branco();
  const f = ctx.createBiquadFilter();
  f.type = tipo;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  s.connect(f).connect(g).connect(destino);
  envelope(g, t, 0.003, dur, pico);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

// Corda dedilhada (viola/sanfona simplificada)
function dedilhar(freq, t, dur = 0.5, pico = 0.25, destino = barramentos.musica) {
  tom({ freq, tipo: 'sawtooth', t, dur, pico, ataque: 0.004, destino, filtro: 3200 });
  tom({ freq: freq * 2, tipo: 'triangle', t, dur: dur * 0.6, pico: pico * 0.3, destino });
}

// ---------- efeitos ----------

const EFEITOS = {
  carta() { chiado({ dur: 0.07, freq: 1800 + Math.random() * 600, pico: 0.5 }); },
  embaralhar() { for (let i = 0; i < 7; i++) chiado({ t: ctx.currentTime + i * 0.045, dur: 0.05, freq: 2200, pico: 0.25 }); },
  clique() { tom({ freq: 900, tipo: 'triangle', dur: 0.05, pico: 0.15 }); },
  selecionar() { tom({ freq: 660, tipo: 'triangle', dur: 0.06, pico: 0.12 }); },
  ponto(passo = 0) { tom({ freq: 520 * 2 ** (Math.min(passo, 12) / 12), tipo: 'square', dur: 0.06, pico: 0.08, filtro: 2500 }); },
  vazaGanha() {
    const t = ctx.currentTime;
    dedilhar(523, t, 0.3, 0.3, barramentos.efeitos);
    dedilhar(784, t + 0.09, 0.4, 0.3, barramentos.efeitos);
  },
  vazaPerdida() {
    const t = ctx.currentTime;
    dedilhar(392, t, 0.3, 0.25, barramentos.efeitos);
    dedilhar(294, t + 0.12, 0.45, 0.25, barramentos.efeitos);
  },
  truco() {
    const t = ctx.currentTime;
    tom({ freq: 120, tipo: 'sine', t, dur: 0.35, pico: 0.9, deslize: 45 });
    chiado({ t, dur: 0.18, freq: 500, q: 0.7, pico: 0.6, tipo: 'lowpass' });
    // a mesa toda: "ôôô"
    for (let i = 0; i < 5; i++) tom({ freq: 180 + i * 37, tipo: 'sawtooth', t: t + 0.08, dur: 0.9, pico: 0.05, ataque: 0.15, filtro: 900 });
  },
  carimbo() { tom({ freq: 90, tipo: 'sine', dur: 0.25, pico: 0.8, deslize: 40 }); chiado({ dur: 0.1, freq: 300, tipo: 'lowpass', pico: 0.5 }); },
  moeda() {
    const t = ctx.currentTime;
    tom({ freq: 1760, t, dur: 0.18, pico: 0.25 });
    tom({ freq: 2637, t: t + 0.07, dur: 0.35, pico: 0.25 });
  },
  tampinha() {
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      tom({ freq: 3100 + Math.random() * 900, t: t + i * 0.07, dur: 0.12, pico: 0.15 });
      chiado({ t: t + i * 0.07, dur: 0.04, freq: 5000, pico: 0.15 });
    }
  },
  vitoria() { [523, 659, 784, 1047].forEach((f, i) => dedilhar(f, ctx.currentTime + i * 0.11, 0.6, 0.28, barramentos.efeitos)); },
  derrota() { [392, 349, 311, 262].forEach((f, i) => dedilhar(f, ctx.currentTime + i * 0.16, 0.7, 0.22, barramentos.efeitos)); },
  copo() { tom({ freq: 2400 + Math.random() * 1600, dur: 0.5, pico: 0.12, destino: barramentos.ambiente }); },
};

// ---------- ambiente: burburinho + copos ----------

function ligarAmbiente() {
  if (ambienteNo || !ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = ruido();
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 420;
  f.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.value = 0.7;
  // conversa sobe e desce devagar
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value = 0.13;
  lfoG.gain.value = 0.25;
  lfo.connect(lfoG).connect(g.gain);
  s.connect(f).connect(g).connect(barramentos.ambiente);
  s.start();
  lfo.start();
  ambienteNo = { s, lfo };
  const agendar = () => {
    tiliques = setTimeout(() => {
      if (ctx.state === 'running') EFEITOS.copo();
      agendar();
    }, 2500 + Math.random() * 6000);
  };
  agendar();
}

// ---------- música: baião em loop ----------

const BPM = 96;
const SEMI = 60 / BPM / 4; // semicolcheia
// I - bVII - IV - I em Sol mixolídio
const ACORDES = [
  [196, 247, 294], [175, 220, 262], [131, 165, 196], [196, 247, 294],
];
const ESCALA = [392, 440, 494, 523, 587, 659, 698, 784];
const MELODIA = [0, -1, 2, -1, 4, 3, 2, -1, 1, -1, 3, -1, 5, 4, 3, -1, 2, -1, 0, -1, 3, 2, 1, -1, 4, -1, 2, 1, 0, -1, -1, -1];

function ligarMusica() {
  if (musicaTimer || !ctx) return;
  let passo = 0;
  let proximo = ctx.currentTime + 0.1;
  const agendar = () => {
    while (proximo < ctx.currentTime + 0.25) {
      tocarPasso(passo, proximo);
      passo = (passo + 1) % 64;
      proximo += SEMI;
    }
  };
  musicaTimer = setInterval(agendar, 60);
}

function tocarPasso(passo, t) {
  const compasso = Math.floor(passo / 16) % ACORDES.length;
  const p = passo % 16;
  const acorde = ACORDES[compasso];
  const destino = barramentos.musica;
  // zabumba: tum (1), tum (2e), bacalhau leve no contratempo
  if (p === 0 || p === 6 || p === 8 || p === 14) tom({ freq: p === 6 || p === 14 ? 70 : 60, tipo: 'sine', t, dur: 0.22, pico: 0.9, deslize: 38, destino });
  if (p % 4 === 2) chiado({ t, dur: 0.05, freq: 1400, pico: 0.25, destino });
  // triângulo: todas as semicolcheias, abre no contratempo
  chiado({ t, dur: p % 2 ? 0.09 : 0.03, freq: 7500, q: 4, pico: p % 4 === 2 ? 0.2 : 0.08, destino });
  // baixo
  if (p === 0 || p === 8) tom({ freq: acorde[0] / 2, tipo: 'triangle', t, dur: 0.4, pico: 0.5, destino });
  // sanfona: acorde curto no contratempo
  if (p === 4 || p === 12) for (const f of acorde) tom({ freq: f * 2, tipo: 'sawtooth', t, dur: 0.18, pico: 0.05, ataque: 0.02, destino, filtro: 1800 });
  // melodia
  const nota = MELODIA[passo % 32];
  if (p % 2 === 0 && nota >= 0) dedilhar(ESCALA[nota], t, 0.35, 0.12, destino);
}

// ---------- vozes ----------

function carregarVozes() {
  if (!('speechSynthesis' in window)) return;
  vozes = speechSynthesis.getVoices().filter((v) => /^pt/i.test(v.lang));
  vozes.sort((a, b) => Number(/BR/i.test(b.lang)) - Number(/BR/i.test(a.lang)));
}

const FEMININAS = /(francisca|maria|luciana|vit[oó]ria|fernanda|raquel|leticia|let[ií]cia|helena|camila|joana|female|feminin)/i;
const MASCULINAS = /(daniel|antonio|ant[oô]nio|felipe|ricardo|duarte|male|masculin|jo[aã]o|paulo)/i;

function escolherVoz(genero) {
  if (!vozes.length) carregarVozes();
  if (!vozes.length) return null;
  const re = genero === 'f' ? FEMININAS : genero === 'm' ? MASCULINAS : null;
  return (re && vozes.find((v) => re.test(v.name))) || vozes[0];
}

// ---------- API ----------

export const audio = {
  // Precisa de um gesto do usuário (clique/toque) para o navegador liberar o som.
  destravar() {
    if (!criarContexto()) return;
    if (ctx.state === 'suspended') ctx.resume();
    ligarAmbiente();
    ligarMusica();
  },
  configurar(novas) {
    opcoes = { ...opcoes, ...novas };
    aplicarVolumes();
    if ((opcoes.mudo || !opcoes.vozes) && 'speechSynthesis' in window) speechSynthesis.cancel();
  },
  get opcoes() { return { ...opcoes }; },
  tocar(nome, arg) {
    if (!ctx || ctx.state !== 'running' || opcoes.mudo || !opcoes.efeitos) return;
    try { EFEITOS[nome]?.(arg); } catch { /* som nunca derruba o jogo */ }
  },
  // voz: { tom: 0.5–1.6, vel: 0.8–1.3, genero: 'm' | 'f' }
  falar(texto, voz = {}) {
    if (!texto || opcoes.mudo || !opcoes.vozes || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      const v = escolherVoz(voz.genero);
      if (v) u.voice = v;
      u.pitch = Math.min(2, Math.max(0, voz.tom ?? 1));
      u.rate = Math.min(1.6, Math.max(0.6, voz.vel ?? 1));
      u.volume = opcoes.vozes;
      speechSynthesis.speak(u);
    } catch { /* sem voz neste navegador */ }
  },
  temVoz() { return 'speechSynthesis' in window; },
};

if ('speechSynthesis' in window) {
  carregarVozes();
  speechSynthesis.addEventListener?.('voiceschanged', carregarVozes);
}
