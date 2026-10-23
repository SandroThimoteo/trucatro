// Estrutura roguelike: Run → Bairro (3 Mesas) → Mesa (mãos contra a IA) → Boteco.
// Todo o estado vive em this.run (JSON puro); a UI só lê o estado e chama comandos.

import { SeededRng } from './rng.js';
import { baralhoPadrao, criarCarta, manilhaRank, forca, isManilha, isZap, RANKS, SUITS } from './cards.js';
import { criarMao, jogarCarta, pedirTruco, responderTruco, podePedirTruco, quemResponde } from './truco.js';
import { decidirAcao, decidirAcaoDupla, sinalDaMao } from './ai.js';
import { pontuarVaza, pontuarMao, identificarJogada, valoresJogada } from './scoring.js';
import { regraAtiva, registrarComparsas } from './comparsas.js';
import { GameEventBus } from './events.js';
import { defConsumivel, perfilDe, falasDe } from './dados.js';

export const TIPOS_MESA = ['bar', 'fundo', 'chefao'];
export const NOME_MESA = { bar: 'Mesa do Bar', fundo: 'Mesa do Fundo', chefao: 'Mesa do Chefão' };

const clone = (x) => JSON.parse(JSON.stringify(x));

// Junta a manha do personagem com o que um evento mudou na Mesa:
// "...Mult" multiplica, outros números somam, o resto substitui.
export function combinarRegras(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    if (typeof v === 'number' && typeof out[k] === 'number') out[k] = /Mult$/.test(k) ? out[k] * v : k === 'viraEscondidaAte' ? Math.max(out[k], v) : out[k] + v;
    else out[k] = v;
  }
  return out;
}
const doJogador = (c) => c.id.startsWith('c');

// Quem senta em cada Mesa de bar e de fundo, bairro a bairro (sem repetir enquanto der).
function sortearRivais(dados, s, bairros) {
  const de = (tipo) => s.shuffle(dados.personagens.filter((p) => p.tipo === tipo).map((p) => p.id));
  const bar = de('bar');
  const fundo = de('fundo');
  return Array.from({ length: bairros }, (_, i) => ({ bar: bar[i % bar.length], fundo: fundo[i % fundo.length] }));
}

export class Jogo {
  constructor(dados, run, bus = new GameEventBus()) {
    this.dados = dados;
    this.run = run;
    // Saves anteriores aos personagens: sorteia com um stream próprio, sem mexer no rng da run
    if (!run.rivais) run.rivais = sortearRivais(dados, new SeededRng(`${run.seed}:rivais`).stream('rivais'), dados.regras.bairros);
    this.rng = SeededRng.fromJSON(run.rng);
    this.bus = bus;
    this.reconectar();
  }

  static novaRun(dados, { seed, baralhoId = 'boteco', desafio = null }, bus) {
    const R = dados.regras;
    const baralho = dados.baralhosPorId[baralhoId];
    const mod = baralho.mod;
    const rng = new SeededRng(seed);
    const setup = rng.stream('setup');

    const deck = baralhoPadrao('c').filter((c) => !(mod.removerRanks ?? []).includes(c.rank));
    for (const c of setup.shuffle(deck).slice(0, mod.cartasMarcadas ?? 0)) c.melhoria = 'marcada';

    const niveis = Object.fromEntries(dados.jogadasLista.map((j) => [j.id, 1]));
    const consumiveis = [];
    for (let i = 0; i < (mod.simpatiasIniciais ?? 0); i++) consumiveis.push({ tipo: 'simpatia', id: setup.pick(dados.simpatias).id });

    const pool = setup.shuffle(dados.chefoes.filter((c) => !c.final));
    const final = dados.chefoes.find((c) => c.final);
    const chefoes = [];
    for (let b = 1; b < R.bairros; b++) chefoes.push(pool[(b - 1) % pool.length].id);
    chefoes.push(final.id);
    const rivais = sortearRivais(dados, rng.stream('rivais'), R.bairros);

    const run = {
      versao: 2,
      rivais,
      seed: String(seed),
      baralhoId,
      deck,
      nextCardId: 100,
      nextUid: 1,
      comparsas: [],
      consumiveis,
      niveis,
      reis: R.economia.reisIniciais,
      bairro: 1,
      mesaIdx: 0,
      fase: 'mapa',
      chefoes,
      slotsComparsa: R.slots.comparsas + (mod.slotsComparsaDelta ?? 0),
      slotsConsumivel: R.slots.consumiveis,
      config: {
        maos: R.mesa.maos + (mod.maosDelta ?? 0),
        trocas: R.mesa.trocas + (mod.trocasDelta ?? 0),
        tamanhoMao: R.mesa.tamanhoMao,
      },
      agressividadeExtra: mod.agressividadeIA ?? 0,
      stats: { causosUsados: 0, maosJogadas: 0, maosVencidas: 0, trucosPedidos: 0, adversarioCorreu: 0, maiorMao: 0, mesasVencidas: 0, pulos: 0, tampinhas: 0 },
      mesa: null,
      loja: null,
      promessa: null,
      resultadoMesa: null,
      vitoria: false,
      infinito: false,
      desafio,
      rng: null,
    };
    run.rng = rng.toJSON();
    const jogo = new Jogo(dados, run, bus);
    jogo.prepararMapa();
    return jogo;
  }

  static carregar(dados, json, bus) {
    return new Jogo(dados, typeof json === 'string' ? JSON.parse(json) : json, bus);
  }

  salvar() {
    this.run.rng = this.rng.toJSON();
    return JSON.stringify(this.run);
  }

  reconectar() {
    registrarComparsas(this.bus, this);
  }

  emit(tipo, dados = {}) {
    return this.bus.emit(tipo, { maoIndice: this.run.mesa?.maoIdx ?? 0, ...dados });
  }

  // ---------- consultas ----------

  regra(tipo) {
    return regraAtiva(this.run.comparsas, this.dados, tipo);
  }

  carta(id) {
    return this.run.deck.find((c) => c.id === id);
  }

  get rodada() {
    return this.run.mesa?.rodada ?? null;
  }

  get chefao() {
    const id = this.run.mesa?.chefaoId;
    return id ? this.dados.chefoesPorId[id] : null;
  }

  // Personagem sentado na Mesa atual (chefão ou não)
  get pessoa() {
    const id = this.run.mesa?.pessoaId ?? this.run.mesa?.chefaoId;
    return id ? this.dados.personagensPorId[id] : null;
  }

  // Manha da Mesa: regras do personagem que mudam o jogo
  get regrasMesa() {
    return combinarRegras(this.pessoa?.regras ?? {}, this.run.mesa?.mod);
  }

  // A Mesa é em dupla (evento Mesa Dupla)
  get dupla() {
    return !!this.run.mesa?.mod?.dupla;
  }

  infoMesa(bairro = this.run.bairro, mesaIdx = this.run.mesaIdx) {
    const R = this.dados.regras;
    const tipo = TIPOS_MESA[mesaIdx];
    const chefaoId = tipo === 'chefao' ? this.run.chefoes[(bairro - 1) % this.run.chefoes.length] : null;
    const chefao = chefaoId ? this.dados.chefoesPorId[chefaoId] : null;
    const pessoaId = chefaoId ?? this.run.rivais[(bairro - 1) % this.run.rivais.length][tipo];
    const pessoa = this.dados.personagensPorId[pessoaId];
    // o evento vale só para a próxima Mesa (a que está para ser jogada)
    const atual = bairro === this.run.bairro && mesaIdx === this.run.mesaIdx;
    const regras = combinarRegras(pessoa.regras ?? {}, atual && this.run.fase === 'mapa' ? this.run.modMesa : null);
    let meta;
    if (bairro <= R.metas.length) meta = R.metas[bairro - 1][mesaIdx];
    else meta = Math.round(R.metas[R.metas.length - 1][mesaIdx] * R.crescimentoInfinito ** (bairro - R.metas.length));
    if (regras.metaMult) meta = Math.round(meta * regras.metaMult);
    return { tipo, nome: pessoa.nome, meta, chefaoId, chefao, pessoaId, pessoa, regras };
  }

  nomeBairro(bairro = this.run.bairro) {
    const nomes = this.dados.regras.nomesBairros;
    return nomes[(bairro - 1) % nomes.length];
  }

  ctxForca() {
    const rd = this.rodada;
    const vira = rd.vira;
    const pirata = this.regra('picaFumoPirata');
    const zapDuplo = this.regra('zapDuplo');
    const cangaceiro = this.regra('cangadaVence');
    return {
      vira,
      invertida: !!this.regrasMesa.ordemInvertida,
      extraManilha: pirata ? (c) => doJogador(c) && vira.suit === 'ouros' && c.suit === 'ouros' : null,
      zapAlias: zapDuplo ? (c) => doJogador(c) && c.suit === 'espadas' && c.rank === manilhaRank(vira) : null,
      resolverEmpate: cangaceiro ? () => 0 : null,
    };
  }

  ganharReis(valor, origem, comparsa = null) {
    this.run.reis += valor;
    const rd = this.rodada;
    if (rd) rd.ganhos.push({ valor, origem, comparsa });
  }

  // ---------- mapa ----------

  prepararMapa() {
    const r = this.run;
    r.fase = 'mapa';
    r.mesa = null;
    r.loja = null;
    r.promessa = TIPOS_MESA[r.mesaIdx] !== 'chefao' ? this.gerarPromessa() : null;
    r.evento = null;
    const E = this.dados.eventos;
    const primeira = r.bairro === 1 && r.mesaIdx === 0;
    if (E && !primeira && TIPOS_MESA[r.mesaIdx] !== 'chefao' && this.rng.stream('evento').chance(E.chance)) {
      const s = this.rng.stream('evento');
      const ultimo = r.ultimoEvento;
      const lista = E.eventos.filter((e) => e.id !== ultimo);
      r.evento = { id: s.weighted(lista.map((e) => [e.id, e.peso ?? 1])) };
      r.ultimoEvento = r.evento.id;
    }
  }

  // ---------- eventos de bairro ----------

  get evento() {
    return this.run.evento ? this.dados.eventosPorId[this.run.evento.id] : null;
  }

  custoOpcao(op) {
    return Math.max(0, -(op.efeito.reis ?? 0));
  }

  resolverEvento(i) {
    const r = this.run;
    const ev = this.evento;
    if (r.fase !== 'mapa' || !ev) throw new Error('Não há evento agora');
    const op = ev.opcoes[i];
    if (!op) throw new Error('Opção inválida');
    if (this.custoOpcao(op) > r.reis) throw new Error(`Faltam ${this.custoOpcao(op) - r.reis} réis`);
    const resultado = { evento: ev.id, opcao: i, textos: [] };
    this.aplicarEfeito(op.efeito, resultado);
    if (op.efeito.mod) r.avisos = [...(r.avisos ?? []), op.resumo];
    if (op.efeito.roleta) {
      const s = this.rng.stream('roleta');
      const fatias = this.dados.eventos.roleta;
      const sorte = s.weighted(fatias.map((f) => [f, f.peso ?? 1]));
      resultado.roleta = { id: sorte.id, indice: fatias.indexOf(sorte), texto: sorte.texto, bom: sorte.bom };
      this.aplicarEfeito(sorte.efeito, resultado);
      resultado.textos.push(sorte.texto);
      if (sorte.efeito.mod) r.avisos = [...(r.avisos ?? []), `Roleta: ${sorte.texto}`];
    }
    if (op.efeito.aposta) {
      const ganhou = this.rng.stream('roleta').chance(op.efeito.aposta.chance);
      if (ganhou) r.reis += op.efeito.aposta.premio;
      resultado.textos.push(ganhou ? `Deu o bicho! +${op.efeito.aposta.premio} réis` : 'Não deu nada. Bilhete pro lixo.');
    }
    r.evento = null;
    r.resultadoEvento = resultado;
    this.emit('OnEventoResolvido', resultado);
    return resultado;
  }

  aplicarEfeito(ef, resultado) {
    const r = this.run;
    if (ef.reis) r.reis = Math.max(0, r.reis + ef.reis);
    if (ef.mod) r.modMesa = combinarRegras(r.modMesa ?? {}, ef.mod);
    if (ef.divida) r.divida = (r.divida ?? 0) + ef.divida;
    if (ef.comparsa) {
      const livres = this.dados.comparsas.filter((c) => c.raridade === ef.comparsa && !r.comparsas.some((x) => x.id === c.id));
      if (livres.length && r.comparsas.length < r.slotsComparsa) {
        const c = this.rng.stream('roleta').pick(livres);
        this.adicionarComparsa(c.id);
        resultado.textos.push(`Ganhou ${c.nome}`);
      } else {
        r.reis += 6;
        resultado.textos.push('Sem espaço para Comparsa: virou 6 réis');
      }
    }
    if (ef.simpatia) {
      if (r.consumiveis.length < r.slotsConsumivel) {
        const s = this.rng.stream('roleta').pick(this.dados.simpatias);
        r.consumiveis.push({ tipo: 'simpatia', id: s.id });
        resultado.textos.push(`Ganhou ${s.nome}`);
      } else {
        r.reis += 4;
        resultado.textos.push('Sem espaço: virou 4 réis');
      }
    }
  }

  gerarPromessa() {
    const s = this.rng.stream('promessa');
    const p = clone(s.pick(this.dados.regras.promessas));
    if (p.tipo === 'comparsa') {
      const livres = this.dados.comparsas.filter((c) => !this.run.comparsas.some((x) => x.id === c.id));
      const daRaridade = livres.filter((c) => c.raridade === p.raridade);
      if (!livres.length) return this.promessaReis();
      p.id = s.pick(daRaridade.length ? daRaridade : livres).id;
      p.descricao = `Comparsa grátis: ${this.dados.comparsasPorId[p.id].nome}`;
    } else if (p.tipo === 'simpatia') {
      p.id = s.pick(this.dados.simpatias).id;
      p.descricao = this.dados.simpatiasPorId[p.id].nome;
    } else if (p.tipo === 'causo') {
      p.id = s.pick(this.dados.causos).id;
      p.descricao = this.dados.causosPorId[p.id].nome;
    }
    return p;
  }

  promessaReis() {
    return clone(this.dados.regras.promessas.find((x) => x.tipo === 'reis'));
  }

  pularMesa() {
    const r = this.run;
    if (r.fase !== 'mapa' || !r.promessa) throw new Error('Esta Mesa não pode ser pulada');
    let p = r.promessa;
    // Sem espaço, ou o Comparsa já está com você: a Promessa vira réis (nunca some nem repete)
    const semEspaco = (p.tipo === 'comparsa' && (r.comparsas.length >= r.slotsComparsa || r.comparsas.some((c) => c.id === p.id)))
      || ((p.tipo === 'simpatia' || p.tipo === 'causo') && r.consumiveis.length >= r.slotsConsumivel);
    if (semEspaco) p = this.promessaReis();
    if (p.tipo === 'reis') r.reis += p.valor;
    else if (p.tipo === 'comparsa') this.adicionarComparsa(p.id);
    else r.consumiveis.push({ tipo: p.tipo, id: p.id });
    r.ultimaPromessa = p;
    r.stats.pulos++;
    r.mesaIdx++;
    this.prepararMapa();
  }

  adicionarComparsa(id) {
    const r = this.run;
    r.comparsas.push({ uid: r.nextUid++, id, estado: {}, desativada: false });
    this.reconectar();
  }

  // ---------- mesa ----------

  iniciarMesa() {
    const r = this.run;
    if (r.fase !== 'mapa') throw new Error('Não dá pra começar uma Mesa agora');
    const info = this.infoMesa();
    for (const c of r.comparsas) {
      c.desativada = false;
      c.estado = {};
    }
    const perfil = perfilDe(this.dados, info.pessoa);
    perfil.agressividade = Math.min(1, perfil.agressividade + r.agressividadeExtra);
    const benz = this.regra('benzedeira');
    const rg = info.regras;
    if (r.evento) throw new Error('Resolva o evento do bairro primeiro');
    let cobrado = 0;
    if (rg.cobraReis) {
      cobrado = Math.min(r.reis, rg.cobraReis);
      r.reis -= cobrado;
    }
    r.mesa = {
      tipo: info.tipo,
      chefaoId: info.chefaoId,
      pessoaId: info.pessoaId,
      meta: info.meta,
      pontos: 0,
      maosRestantes: Math.max(2, r.config.maos + (rg.maosDelta ?? 0)),
      trocasRestantes: rg.semTrocas ? 0 : Math.max(0, r.config.trocas + (rg.trocasDelta ?? 0)),
      cobrado,
      tamanhoMao: r.config.tamanhoMao,
      perfil,
      compra: this.rng.stream('baralho').shuffle(r.deck.map((c) => c.id)),
      descarte: [],
      mao: [],
      maoIdx: 0,
      benzedeiraUsos: benz?.usosPorMesa ?? 0,
      rodada: null,
      historico: [],
      mod: r.modMesa ?? null,
    };
    r.modMesa = null;
    r.resultadoEvento = null;
    r.avisos = [];
    if (r.mesa.mod?.dupla) {
      // parceiro e segundo adversário: gente do bar que não está nesta Mesa
      const s = this.rng.stream('dupla');
      const livres = s.shuffle(this.dados.personagens.filter((x) => x.tipo !== 'chefao' && x.id !== info.pessoaId).map((x) => x.id));
      r.mesa.parceiroId = livres[0];
      r.mesa.adv2Id = livres[1];
    }
    r.fase = 'mesa';
    this.emit('OnMesaIniciada', { tipo: info.tipo, meta: info.meta, chefao: info.chefaoId, pessoa: info.pessoaId });
    this.novaRodada();
    this.rodada.fala = this.sortearFala('entrada');
    if (this.rodada.fala) this.emit('OnFala', { texto: this.rodada.fala, pessoa: info.pessoaId });
  }

  sortearFala(momento) {
    const lista = falasDe(this.dados, this.pessoa, momento);
    return lista.length ? this.rng.stream('falas').pick(lista) : null;
  }

  // Um baralho de truco só tem uma carta de cada: evita puxar uma carta igual (mesmo valor e
  // naipe) a uma que já está na mão, na vira ou na mão do adversário. Se não tiver outra, vai ela mesma.
  comprarAte(n) {
    const m = this.run.mesa;
    const rd = m.rodada;
    const vis = (c) => `${c.rank}${c.suit}`;
    const ocupadas = new Set([...(rd?.viras ?? []), ...(rd?.maoAdv ?? [])].map(vis));
    for (const id of m.mao) ocupadas.add(vis(this.carta(id)));
    while (m.mao.length < n) {
      if (!m.compra.length) {
        if (!m.descarte.length) break;
        m.compra = this.rng.stream('baralho').shuffle(m.descarte);
        m.descarte = [];
      }
      let i = m.compra.length - 1;
      while (i >= 0 && ocupadas.has(vis(this.carta(m.compra[i])))) i--;
      const [id] = m.compra.splice(i >= 0 ? i : m.compra.length - 1, 1);
      m.mao.push(id);
      ocupadas.add(vis(this.carta(id)));
    }
  }

  novaRodada() {
    const r = this.run;
    const m = r.mesa;
    const R = this.dados.regras;
    // Cartas que saíram do baralho (Causo do Fogo, vidro quebrado) somem da mão e da pilha
    const existe = (id) => !!this.carta(id);
    m.mao = m.mao.filter(existe);
    m.compra = m.compra.filter(existe);
    m.descarte = m.descarte.filter(existe);
    m.rodada = null;
    this.comprarAte(m.tamanhoMao);

    // O adversário e a vira saem do mesmo "baralho" da mesa: nunca repetem uma carta da sua mão
    const naMao = new Set(m.mao.map((id) => { const c = this.carta(id); return `${c.rank}${c.suit}`; }));
    const s = this.rng.stream('adversario');
    const advDeck = s.shuffle(baralhoPadrao('o').filter((c) => !naMao.has(`${c.rank}${c.suit}`)));
    const viras = [advDeck.pop()];
    if (this.regra('viraDupla')) viras.push(advDeck.pop());
    const maoAdv = advDeck.splice(-R.mesa.cartasAdversario);
    const maoParceiro = this.dupla ? advDeck.splice(-R.mesa.cartasAdversario) : null;
    const maoAdv2 = this.dupla ? advDeck.splice(-R.mesa.cartasAdversario) : null;

    m.rodada = {
      indice: m.maoIdx,
      fase: viras.length > 1 ? 'vira' : 'troca',
      viras,
      vira: viras.length > 1 ? null : viras[0],
      maoAdv,
      maoParceiro,
      maoAdv2,
      sinais: null,
      sinaisVistos: [],
      restoAdv: advDeck,
      iniciante: m.maoIdx % 2,
      onze: R.mesa.ultimaMaoDeOnze && !this.regrasMesa.semMaoDeOnze && m.maosRestantes === 1,
      reveladas: [],
      numVazas: 3,
      mao: null,
      maoAntes: null,
      vazasPontuadas: [],
      bonusMultProxima: 0,
      memoriaIA: {},
      revelada: false,
      fala: null,
      ganhos: [],
      quebradas: [],
      resultado: null,
    };
    this.emit('OnMaoDistribuida', { mao: [...m.mao] });
    if (m.rodada.vira) this.revelarVira();
  }

  revelarVira() {
    const rd = this.rodada;
    const n = this.regrasMesa.manilhasGarantidas ?? 0;
    if (n) {
      const mr = manilhaRank(rd.vira);
      const ctx = { vira: rd.vira };
      let manilhas = rd.maoAdv.filter((c) => c.rank === mr).length;
      while (manilhas < n) {
        const iExtra = rd.restoAdv.findIndex((c) => c.rank === mr);
        if (iExtra < 0) break;
        const [extra] = rd.restoAdv.splice(iExtra, 1);
        const comuns = rd.maoAdv.filter((c) => c.rank !== mr).sort((a, b) => forca(a, ctx) - forca(b, ctx));
        const sai = comuns[0];
        rd.maoAdv[rd.maoAdv.indexOf(sai)] = extra;
        rd.restoAdv.push(sai);
        manilhas++;
      }
    }
    delete rd.restoAdv;
    rd.reveladas = rd.maoAdv.slice(0, this.regrasMesa.revelaCartas ?? 0).map((c) => c.id);
    if (rd.maoParceiro) {
      const ctx = { vira: rd.vira };
      rd.sinais = { 0: null, 1: sinalDaMao(rd.maoAdv, ctx), 2: sinalDaMao(rd.maoParceiro, ctx), 3: sinalDaMao(rd.maoAdv2, ctx) };
      const s = this.rng.stream('sinais');
      rd.sinaisVistos = [1, 3].filter(() => s.chance(0.35));
    }
    this.emit('OnViraRevelada', { vira: rd.vira });
  }

  escolherVira(i) {
    const rd = this.rodada;
    if (rd?.fase !== 'vira') throw new Error('Não há vira para escolher');
    rd.vira = rd.viras[i];
    rd.fase = 'troca';
    this.revelarVira();
  }

  trocar(ids) {
    const m = this.run.mesa;
    const rd = this.rodada;
    if (rd?.fase !== 'troca') throw new Error('Só dá pra trocar antes da primeira rodada');
    if (m.trocasRestantes <= 0) throw new Error('Sem trocas nesta Mesa');
    if (!ids.length || !ids.every((id) => m.mao.includes(id))) throw new Error('Selecione cartas da sua mão');
    m.mao = m.mao.filter((id) => !ids.includes(id));
    m.descarte.push(...ids);
    m.trocasRestantes--;
    this.comprarAte(m.tamanhoMao);
  }

  // Mesa Dupla: o sinal que você faz para o parceiro antes da primeira rodada
  sinalizar(chave) {
    const rd = this.rodada;
    if (!rd?.sinais || (rd.mao && rd.mao.vazas.length)) throw new Error('Sinal só antes da primeira rodada');
    rd.sinais[0] = chave;
  }

  comecarRodada() {
    const m = this.run.mesa;
    const rd = this.rodada;
    if (rd?.fase !== 'troca') throw new Error('A mão já começou');
    const R = this.dados.regras;
    const primeira = this.regra('valorInicialPrimeiraMao');
    let valor = 1;
    if (rd.onze) valor = R.mesa.valorMaoDeOnze;
    else if (this.regrasMesa.valorInicial) valor = this.regrasMesa.valorInicial;
    else if (m.maoIdx === 0 && primeira) valor = primeira.valor;
    const minhas = m.mao.map((id) => clone(this.carta(id)));
    rd.mao = criarMao({
      maos: rd.maoParceiro ? [minhas, rd.maoAdv, rd.maoParceiro, rd.maoAdv2] : [minhas, rd.maoAdv],
      vira: rd.vira,
      iniciante: rd.iniciante,
      valor,
      numVazas: rd.numVazas,
      trucoPermitido: !rd.onze && !this.regrasMesa.semTruco,
      valores: R.truco.valores,
    });
    rd.fase = 'jogo';
  }

  jogarCarta(id) {
    const rd = this.rodada;
    if (rd?.fase === 'troca') this.comecarRodada();
    if (rd?.fase !== 'jogo') throw new Error('Não dá pra jogar agora');
    rd.maoAntes = rd.mao.maos[0].map((c) => ({ ...c }));
    this.processar(jogarCarta(rd.mao, 0, id, this.ctxForca()));
  }

  podePedirTruco() {
    const rd = this.rodada;
    if (!rd || rd.onze || this.regrasMesa.semTruco) return false;
    if (rd.fase === 'troca') return rd.iniciante === 0;
    return rd.fase === 'jogo' && podePedirTruco(rd.mao, 0);
  }

  pedirTruco() {
    const rd = this.rodada;
    if (rd?.fase === 'troca') this.comecarRodada();
    if (rd?.fase !== 'jogo') throw new Error('Não dá pra pedir truco agora');
    this.run.stats.trucosPedidos++;
    rd.fala = null;
    this.processar(pedirTruco(rd.mao, 0));
  }

  responderTruco(resposta) {
    const rd = this.rodada;
    if (rd?.fase !== 'jogo') throw new Error('Não há truco pendente');
    this.processar(responderTruco(rd.mao, 0, resposta));
  }

  benzer() {
    const m = this.run.mesa;
    const rd = this.rodada;
    if (!this.regra('benzedeira') || m.benzedeiraUsos <= 0) throw new Error('A Benzedeira já ajudou nesta Mesa');
    if (!rd || rd.fase === 'fim') throw new Error('Nada pra revelar agora');
    m.benzedeiraUsos--;
    rd.revelada = true;
  }

  processar(eventos) {
    const m = this.run.mesa;
    for (const ev of eventos) {
      if (ev.tipo === 'OnCartaJogada' && ev.jogador === 0) {
        m.mao = m.mao.filter((id) => id !== ev.carta.id);
        m.descarte.push(ev.carta.id);
      }
      this.emit(ev.tipo, ev);
      if (ev.tipo === 'OnVazaResolvida') this.aoResolverVaza(ev.vaza);
      if (ev.tipo === 'OnMaoFinalizada') this.aoFinalizarMao();
    }
  }

  aoResolverVaza(vaza) {
    const rd = this.rodada;
    const autor = vaza.autor ?? 0;
    const minha = vaza.cartas[autor];
    // na dupla, a carta a bater é a melhor do outro time
    const ctxV = this.ctxForca();
    const dele = vaza.cartas.length > 2 ? [vaza.cartas[1], vaza.cartas[3]].filter(Boolean).sort((a, b) => forca(b, ctxV) - forca(a, ctxV))[0] : vaza.cartas[1];
    if (vaza.vencedor === 'empate') {
      rd.bonusMultProxima += valoresJogada(this.dados, this.run.niveis, 'cangada').multProxima;
      return;
    }
    if (vaza.vencedor !== 0) return;
    const ctxF = this.ctxForca();
    const jogada = identificarJogada({
      carta: minha, cartaAdv: dele, maoAntes: autor === 0 ? rd.maoAntes ?? [minha] : [minha], ctx: ctxF, empateConvertido: vaza.empateConvertido,
    });
    const sc = pontuarVaza({
      dados: this.dados, carta: minha, jogada, ctxForca: ctxF, niveis: this.run.niveis,
      comparsas: this.run.comparsas, pessoa: this.pessoa, bonusMult: rd.bonusMultProxima,
      info: {
        vazaIndice: vaza.indice,
        vazasVencidasAntes: rd.vazasPontuadas.length,
        maoIndice: this.run.mesa.maoIdx,
        causosUsados: this.run.stats.causosUsados,
      },
    });
    rd.bonusMultProxima = 0;
    const registro = { indice: vaza.indice, carta: minha, autor, jogada, fichas: sc.fichas, mult: sc.mult, total: sc.totalFinal, passos: sc.passos };
    rd.vazasPontuadas.push(registro);
    if (sc.reis) this.ganharReis(sc.reis, 'Carta de Ouro');
    if (this.regrasMesa.reisPorVaza) this.ganharReis(this.regrasMesa.reisPorVaza, this.pessoa.nome);
    if (minha.melhoria === 'vidro' && this.rng.stream('vidro').chance(this.dados.cartas.melhorias.vidro.chanceQuebrar)) {
      rd.quebradas.push(minha.id);
    }
    this.emit('OnVazaPontuada', { ...registro });
  }

  // Adversário correu: sua melhor carta na mão pontua como se tivesse vencido uma vaza.
  pontuarFuga() {
    const rd = this.rodada;
    const st = rd.mao;
    const ctxF = this.ctxForca();
    const melhor = [...st.maos[0]].sort((a, b) => forca(b, ctxF) - forca(a, ctxF))[0];
    const jogada = isZap(melhor, ctxF) ? 'zapada' : isManilha(melhor, ctxF) ? 'manilhada' : 'vaza_simples';
    const sc = pontuarVaza({
      dados: this.dados, carta: melhor, jogada, ctxForca: ctxF, niveis: this.run.niveis,
      comparsas: this.run.comparsas, pessoa: this.pessoa, bonusMult: rd.bonusMultProxima,
      info: {
        vazaIndice: st.vazas.length,
        vazasVencidasAntes: rd.vazasPontuadas.length,
        maoIndice: this.run.mesa.maoIdx,
        causosUsados: this.run.stats.causosUsados,
      },
    });
    rd.bonusMultProxima = 0;
    const registro = { indice: st.vazas.length, carta: melhor, jogada, fichas: sc.fichas, mult: sc.mult, total: sc.totalFinal, passos: sc.passos, fuga: true };
    rd.vazasPontuadas.push(registro);
    this.emit('OnVazaPontuada', { ...registro });
  }

  aoFinalizarMao() {
    const r = this.run;
    const m = r.mesa;
    const rd = this.rodada;
    const st = rd.mao;
    const valores = st.valores;
    const aumentos = Math.max(0, valores.indexOf(st.valor) - valores.indexOf(st.valorInicial));
    const resultados = st.vazas.map((v) => v.vencedor);
    const venceu = st.vencedor === 0;
    let pontos = 0;
    let maoCtx = null;
    let penalidade = 0;
    let comparsaPerdida = null;
    const bonus = [];

    if (venceu) {
      if (st.correu === 1 && this.dados.regras.truco.fugaPontuaMelhorCarta && st.maos[0].length) this.pontuarFuga();
      if (st.correu === null) {
        const vitorias = resultados.filter((x) => x === 0).length;
        if (vitorias === st.numVazas) bonus.push('queda_limpa');
        if (st.numVazas === 3 && resultados.join() === '1,0,0') bonus.push('virada');
        if (rd.onze) bonus.push('mao_de_onze');
      }
      maoCtx = pontuarMao({
        dados: this.dados, niveis: r.niveis, vazas: rd.vazasPontuadas, bonus, valor: st.valor,
        comparsas: r.comparsas, info: { aumentos, maoIndice: m.maoIdx },
      });
      pontos = maoCtx.total;
      r.stats.maosVencidas++;
      if (st.correu === 1) r.stats.adversarioCorreu++;
      // Selo Azul: gera a Simpatia da Jogada usada
      for (const v of rd.vazasPontuadas) {
        if (v.carta.selo !== 'azul' || r.consumiveis.length >= r.slotsConsumivel) continue;
        const simp = this.dados.simpatias.find((s) => s.jogada === v.jogada);
        if (simp) r.consumiveis.push({ tipo: 'simpatia', id: simp.id });
      }
    } else {
      // Blefe pago: seu truco foi aceito e você perdeu a mão
      if (st.vencedor === 1 && st.correu === null && st.ultimoAumento === 0) penalidade = this.dados.regras.truco.penalidadeMaosBlefe;
      if (st.correu === 0 && this.regrasMesa.correrCustaComparsa) {
        const ativos = r.comparsas.filter((c) => !c.desativada);
        if (ativos.length) {
          const alvo = this.rng.stream('chefao').pick(ativos);
          alvo.desativada = true;
          comparsaPerdida = alvo.id;
          this.reconectar();
        }
      }
    }

    // Vidro quebrado sai do baralho
    if (rd.quebradas.length) r.deck = r.deck.filter((c) => !rd.quebradas.includes(c.id));

    m.pontos += pontos;
    m.maosRestantes = Math.max(0, m.maosRestantes - 1 - penalidade);
    r.stats.maosJogadas++;
    r.stats.maiorMao = Math.max(r.stats.maiorMao, pontos);
    rd.resultado = {
      venceu, vencedor: st.vencedor, pontos, valor: st.valor, correu: st.correu, penalidade, comparsaPerdida,
      bonus, passos: maoCtx?.passos ?? [],
    };
    rd.fase = 'fim';
    m.historico.push({ venceu, pontos, valor: st.valor });
    this.emit('MaoPontuada', { ...rd.resultado });

    if (m.pontos >= m.meta) this.vencerMesa();
    else if (m.maosRestantes <= 0) this.perderRun();
  }

  proximaMao() {
    const m = this.run.mesa;
    if (this.run.fase !== 'mesa' || this.rodada?.fase !== 'fim') throw new Error('A mão ainda não acabou');
    m.maoIdx++;
    this.novaRodada();
  }

  vencerMesa() {
    const r = this.run;
    const m = r.mesa;
    const E = this.dados.regras.economia;
    const base = Math.round(E.recompensaMesa[m.tipo] * (this.regrasMesa.recompensaMult ?? 1));
    const porMao = m.maosRestantes * E.porMaoRestante;
    const juros = Math.min(E.jurosMax, Math.floor(r.reis / E.jurosACada));
    const extra = this.regrasMesa.recompensaExtra ?? 0;
    r.reis += base + porMao + juros + extra;
    // Fiado: o dono do bar cobra; sem dinheiro, leva um Comparsa
    let fiado = null;
    if (r.divida) {
      const pago = Math.min(r.reis, r.divida);
      r.reis -= pago;
      fiado = { divida: r.divida, pago, comparsa: null };
      if (pago < r.divida && r.comparsas.length) {
        const i = Math.floor(this.rng.stream('fiado').next() * r.comparsas.length);
        fiado.comparsa = r.comparsas[i].id;
        r.comparsas.splice(i, 1);
        this.reconectar();
      }
      r.divida = 0;
    }
    const ultimoBairro = this.dados.regras.bairros;
    const venceuRun = !r.infinito && r.bairro === ultimoBairro && m.tipo === 'chefao';
    const tampinhas = this.tampinhasDaMesa(venceuRun);
    r.stats.tampinhas = (r.stats.tampinhas ?? 0) + tampinhas;
    r.resultadoMesa = {
      venceu: true, base, porMao, juros, extra, total: base + porMao + juros + extra, tampinhas, fiado,
      pontos: m.pontos, meta: m.meta, tipo: m.tipo, pessoaId: m.pessoaId, fala: this.sortearFala('derrota'),
    };
    r.stats.mesasVencidas++;
    r.stats.pontosTotais = (r.stats.pontosTotais ?? 0) + m.pontos;
    for (const c of r.comparsas) c.desativada = false;
    this.reconectar();
    this.emit('OnMesaFinalizada', { venceu: true, ...r.resultadoMesa });
    if (venceuRun) {
      r.fase = 'vitoria';
      r.vitoria = true;
    } else {
      r.fase = 'recompensa';
    }
  }

  // Só Chefões deixam cair Tampinhas (moeda que fica entre as runs); cada um paga um valor.
  tampinhasDaMesa(venceuRun = false, ch = this.chefao, bairro = this.run.bairro) {
    if (!ch) return 0;
    const B = this.dados.bazar.recompensas;
    return (ch.drop ?? 0) + (bairro - 1) * B.porBairro + (venceuRun ? B.vitoriaRun : 0);
  }

  perderRun() {
    const r = this.run;
    r.stats.pontosTotais = (r.stats.pontosTotais ?? 0) + r.mesa.pontos;
    r.resultadoMesa = { venceu: false, pontos: r.mesa.pontos, meta: r.mesa.meta, tipo: r.mesa.tipo };
    this.emit('OnMesaFinalizada', { venceu: false, ...r.resultadoMesa });
    r.fase = 'derrota';
  }

  continuarInfinito() {
    if (this.run.fase !== 'vitoria') throw new Error('Só depois de vencer o Rei do Truco');
    this.run.infinito = true;
    this.run.fase = 'recompensa';
  }

  // ---------- boteco ----------

  irAoBoteco() {
    if (this.run.fase !== 'recompensa') throw new Error('Termine a Mesa primeiro');
    this.run.fase = 'boteco';
    this.run.mesa = null;
    this.run.loja = { itens: this.gerarItensLoja(), rerollCusto: this.dados.regras.economia.rerollBase };
    this.emit('OnLojaAberta', {});
  }

  sortearComparsa(s, excluir) {
    const pesos = this.dados.regras.loja.pesosRaridade;
    const raridade = s.weighted(Object.entries(pesos));
    const livres = this.dados.comparsas.filter((c) => !excluir.has(c.id));
    if (!livres.length) return null;
    const daRaridade = livres.filter((c) => c.raridade === raridade);
    return s.pick(daRaridade.length ? daRaridade : livres);
  }

  // anteriores: ofertas que o jogador acabou de ver (no reroll, evita repetir enquanto houver opção)
  gerarItensLoja(anteriores = []) {
    const L = this.dados.regras.loja;
    const s = this.rng.stream('loja');
    const itens = [];
    const viu = new Set(anteriores.filter((it) => it.id).map((it) => it.id));
    const excluir = new Set([...this.run.comparsas.map((c) => c.id), ...viu]);
    for (let i = 0; i < L.comparsas; i++) {
      let def = this.sortearComparsa(s, excluir);
      if (!def) def = this.sortearComparsa(s, new Set([...this.run.comparsas.map((c) => c.id), ...itens.map((x) => x.id)]));
      if (!def) continue;
      excluir.add(def.id);
      itens.push({ tipo: 'comparsa', id: def.id, preco: def.preco, vendido: false });
    }
    // Causos e Simpatias: nunca dois iguais na mesma loja
    const usados = new Set();
    for (let i = 0; i < L.consumiveis; i++) {
      const tipo = s.chance(0.5) ? 'causo' : 'simpatia';
      const lista = tipo === 'causo' ? this.dados.causos : this.dados.simpatias;
      const novos = lista.filter((d) => !usados.has(d.id) && !viu.has(d.id));
      const def = s.pick(novos.length ? novos : lista.filter((d) => !usados.has(d.id)));
      usados.add(def.id);
      itens.push({ tipo, id: def.id, preco: def.preco, vendido: false });
    }
    for (let i = 0; i < L.cartas; i++) {
      const carta = criarCarta('novo', s.pick(RANKS), s.pick(SUITS));
      if (s.chance(L.chanceMelhoria)) carta.melhoria = s.pick(Object.keys(this.dados.cartas.melhorias));
      if (s.chance(L.chanceSelo)) carta.selo = s.pick(Object.keys(this.dados.cartas.selos));
      const preco = carta.melhoria || carta.selo ? L.precoCartaMelhorada : L.precoCarta;
      itens.push({ tipo: 'carta', carta, preco, vendido: false });
    }
    return itens;
  }

  comprar(i) {
    const r = this.run;
    if (r.fase !== 'boteco') throw new Error('O Boteco está fechado');
    const item = r.loja.itens[i];
    if (!item || item.vendido) throw new Error('Item indisponível');
    if (r.reis < item.preco) throw new Error('Réis insuficientes');
    if (item.tipo === 'comparsa') {
      if (r.comparsas.length >= r.slotsComparsa) throw new Error('Sem espaço para Comparsas (venda um)');
      this.adicionarComparsa(item.id);
    } else if (item.tipo === 'carta') {
      r.deck.push({ ...clone(item.carta), id: `c${r.nextCardId++}` });
    } else {
      if (r.consumiveis.length >= r.slotsConsumivel) throw new Error('Sem espaço para consumíveis');
      r.consumiveis.push({ tipo: item.tipo, id: item.id });
    }
    r.reis -= item.preco;
    item.vendido = true;
    this.emit('OnCartaComprada', { item: clone(item) });
  }

  precoVenda(uid) {
    const inst = this.run.comparsas.find((c) => c.uid === uid);
    const def = this.dados.comparsasPorId[inst.id];
    return Math.max(1, Math.floor(def.preco * this.dados.regras.economia.vendaFracao));
  }

  venderComparsa(uid) {
    const r = this.run;
    if (r.fase === 'mesa') throw new Error('Não dá pra vender no meio da Mesa');
    const i = r.comparsas.findIndex((c) => c.uid === uid);
    if (i < 0) throw new Error('Comparsa não encontrado');
    r.reis += this.precoVenda(uid);
    r.comparsas.splice(i, 1);
    this.reconectar();
  }

  moverComparsa(uid, direcao) {
    const lista = this.run.comparsas;
    const i = lista.findIndex((c) => c.uid === uid);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    this.reconectar();
  }

  reroll() {
    const r = this.run;
    if (r.fase !== 'boteco') throw new Error('O Boteco está fechado');
    if (r.reis < r.loja.rerollCusto) throw new Error('Réis insuficientes');
    r.reis -= r.loja.rerollCusto;
    r.loja.rerollCusto += this.dados.regras.economia.rerollIncremento;
    r.loja.itens = this.gerarItensLoja(r.loja.itens);
  }

  sairDoBoteco() {
    const r = this.run;
    if (r.fase !== 'boteco') throw new Error('Você não está no Boteco');
    r.mesaIdx++;
    if (r.mesaIdx >= TIPOS_MESA.length) {
      r.mesaIdx = 0;
      r.bairro++;
    }
    this.prepararMapa();
  }

  // ---------- consumíveis ----------

  podeUsarCausoAgora() {
    return this.run.fase === 'mesa' && this.rodada?.fase === 'troca';
  }

  usarConsumivel(idx, alvos = []) {
    const r = this.run;
    const item = r.consumiveis[idx];
    if (!item) throw new Error('Consumível não encontrado');
    const def = defConsumivel(this.dados, item);
    if (item.tipo === 'simpatia') {
      r.niveis[def.jogada] = (r.niveis[def.jogada] ?? 1) + 1;
    } else {
      if (!this.podeUsarCausoAgora()) throw new Error('Causos só valem na Mesa, antes da primeira rodada');
      const m = r.mesa;
      if (alvos.length < def.alvosMin || alvos.length > def.alvosMax) {
        throw new Error(def.alvosMin === def.alvosMax ? `Selecione ${def.alvosMin} carta(s)` : `Selecione de ${def.alvosMin} a ${def.alvosMax} cartas`);
      }
      if (!alvos.every((id) => m.mao.includes(id))) throw new Error('Selecione cartas da sua mão');
      const cartas = alvos.map((id) => this.carta(id));
      const e = def.efeito;
      if (e.tipo === 'mudarNaipe') cartas[0].suit = e.naipe;
      else if (e.tipo === 'bonusFichas') cartas[0].bonusFichas += e.valor;
      else if (e.tipo === 'melhoria') cartas[0].melhoria = e.melhoria;
      else if (e.tipo === 'selo') cartas[0].selo = e.selo;
      else if (e.tipo === 'copiar') {
        const { rank, suit, bonusFichas, melhoria, selo } = cartas[0];
        Object.assign(cartas[1], { rank, suit, bonusFichas, melhoria, selo });
      } else if (e.tipo === 'destruir') {
        r.deck = r.deck.filter((c) => !alvos.includes(c.id));
        m.mao = m.mao.filter((id) => !alvos.includes(id));
        this.comprarAte(m.tamanhoMao);
      }
      r.stats.causosUsados++;
    }
    r.consumiveis.splice(idx, 1);
  }

  descartarConsumivel(idx) {
    this.run.consumiveis.splice(idx, 1);
  }

  // ---------- IA ----------

  iaPrecisaAgir() {
    const rd = this.rodada;
    if (this.run.fase !== 'mesa' || rd?.fase !== 'jogo' || rd.mao.fim) return false;
    const st = rd.mao;
    if (st.jogadores === 4) return (st.pedido ? quemResponde(st) : st.vez) !== 0;
    return st.pedido ? st.pedido.por === 0 : st.vez === 1;
  }

  // Abrir a mão quando o adversário começa (fim da fase de troca).
  podeAbrirParaIA() {
    const rd = this.rodada;
    return rd?.fase === 'troca' && rd.iniciante === 1;
  }

  passoIA() {
    const rd = this.rodada;
    const st = rd.mao;
    const ctx = this.ctxForca();
    if (st.jogadores === 4) return this.passoIADupla();
    const acao = decidirAcao(st, this.run.mesa.perfil, ctx, this.rng.stream('ia'), rd.memoriaIA, {
      aumentaSempre: !!this.regrasMesa.aumentaSempre,
    });
    // A fala sai antes do evento (o grito de truco vem antes do carimbo)
    const falar = (momento) => {
      rd.fala = this.sortearFala(momento);
      if (rd.fala) this.emit('OnFala', { texto: rd.fala, pessoa: this.pessoa?.id });
    };
    if (acao.tipo === 'responder') {
      falar(acao.resposta);
      this.processar(responderTruco(st, 1, acao.resposta));
    } else if (acao.tipo === 'pedir') {
      falar('pedir');
      this.processar(pedirTruco(st, 1));
    } else {
      const antes = st.vazas.length;
      this.processar(jogarCarta(st, 1, acao.cartaId, ctx));
      const nova = st.vazas.length > antes ? st.vazas[st.vazas.length - 1] : null;
      if (nova && nova.vencedor !== 'empate') falar(nova.vencedor === 1 ? 'venceuVaza' : 'perdeuVaza');
      else rd.fala = null;
    }
    return acao;
  }

  // Mesa Dupla: age quem tem a vez (parceiro, adversário ou o 2º adversário)
  passoIADupla() {
    const rd = this.rodada;
    const st = rd.mao;
    const ctx = this.ctxForca();
    const j = st.pedido ? quemResponde(st) : st.vez;
    const parceiro = j === 2;
    const pessoa = this.dados.personagensPorId[j === 2 ? this.run.mesa.parceiroId : j === 3 ? this.run.mesa.adv2Id : this.run.mesa.pessoaId];
    const perfil = parceiro ? { ...perfilDe(this.dados, pessoa), agressividade: 0.3 } : j === 1 ? this.run.mesa.perfil : perfilDe(this.dados, pessoa);
    const acao = decidirAcaoDupla(st, j, perfil, ctx, this.rng.stream(`ia${j}`), rd.memoriaIA, {
      sinais: rd.sinais, aumentaSempre: !parceiro && !!this.regrasMesa.aumentaSempre, naoPede: false,
    });
    const falar = (momento) => {
      rd.fala = j === 1 ? this.sortearFala(momento) : null;
      if (rd.fala) this.emit('OnFala', { texto: rd.fala, pessoa: pessoa?.id });
    };
    if (acao.tipo === 'responder') {
      falar(acao.resposta);
      this.processar(responderTruco(st, j, acao.resposta));
    } else if (acao.tipo === 'pedir') {
      falar('pedir');
      this.processar(pedirTruco(st, j));
    } else {
      rd.fala = null;
      this.processar(jogarCarta(st, j, acao.cartaId, ctx));
    }
    return { ...acao, jogador: j };
  }

  avancarIA() {
    let n = 0;
    while (this.iaPrecisaAgir() && n++ < 80) this.passoIA();
  }
}
