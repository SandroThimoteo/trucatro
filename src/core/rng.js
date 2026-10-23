// SeededRng: toda aleatoriedade do jogo passa por aqui.
// Cada sub-stream (baralho, loja, ia, vira...) tem estado próprio, então
// comprar algo na loja não altera as cartas que vão sair depois.

function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export class Stream {
  constructor(state) {
    this.state = state >>> 0;
  }

  // mulberry32
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n) {
    return Math.floor(this.next() * n);
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[this.int(arr.length)];
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  weighted(entries) {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [valor, peso] of entries) {
      r -= peso;
      if (r < 0) return valor;
    }
    return entries[entries.length - 1][0];
  }
}

export class SeededRng {
  constructor(seed, states = {}) {
    this.seed = String(seed);
    this.streams = {};
    for (const [nome, st] of Object.entries(states)) this.streams[nome] = new Stream(st);
  }

  stream(nome) {
    if (!this.streams[nome]) this.streams[nome] = new Stream(hashString(`${this.seed}::${nome}`));
    return this.streams[nome];
  }

  toJSON() {
    const states = {};
    for (const [nome, s] of Object.entries(this.streams)) states[nome] = s.state;
    return { seed: this.seed, states };
  }

  static fromJSON(obj) {
    return new SeededRng(obj.seed, obj.states);
  }
}

const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// A seed em si pode vir de Math.random: ela é a origem, não parte do jogo.
export function randomSeed() {
  let s = '';
  for (let i = 0; i < 8; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  return s;
}
