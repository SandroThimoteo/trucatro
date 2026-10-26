// Camada de interface: lê o estado do Core, desenha as telas e envia comandos.

import { ARQUIVOS_DADOS, montarDados, defConsumivel, perfilDe, falasDe } from '../core/dados.js';
import { Jogo, TIPOS_MESA, NOME_MESA } from '../core/run.js';
import { PartidaClassica } from '../core/partida.js';
import { PartidaDupla } from '../core/partidaDupla.js';
import { SINAIS } from '../core/ai.js';
import { diaDeHoje, sementeDoDia, resumoDesafio, BARALHO_DESAFIO, TAMPINHAS_DESAFIO } from '../core/desafio.js';
import { GameEventBus } from '../core/events.js';
import { randomSeed } from '../core/rng.js';
import { RANKS, SUITS, SUIT_NOME } from '../core/cards.js';
import { valoresJogada } from '../core/scoring.js';
import { proximoValor } from '../core/truco.js';
import { novoPerfil, normalizarPerfil, comprarItem, equiparItem, itemEquipado, registrarMesa, registrarFimDeRun } from '../core/perfil.js';
import { esc, fmt, cartaHTML, versoHTML, slotComparsa, nomeComAvatar, infoBtn, avatarHTML, NOME_RARIDADE, NOME_VALOR } from './componentes.js';
import { audio } from './audio.js';
import { palcoRodada, palcoMao } from './palco.js';
import { cenaChefao, urlCenario } from './cena.js';
import { detectarConta, entrar, convidado, backupLocal, lerBackupLocal } from './conta.js';

const raiz = document.getElementById('app');
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const VEL = { ia: reduzido ? 120 : 720, passo: reduzido ? 30 : 230, vaza: reduzido ? 80 : 520, carimbo: reduzido ? 250 : 950, total: reduzido ? 100 : 650 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VOZ_JOGADOR = { tom: 1, vel: 1.05 };
const CLASSICO_PESSOA = 'seu_joaquim';

const app = {
  dados: null,
  tela: 'carregando',
  jogo: null,
  partida: null,
  sel: [],
  ocupado: false,
  animando: false,
  modal: null,
  detalhe: null,
  fila: [],
  conta: null, // placar Fichas × Mult da lousa
  baralhoSel: 'boteco',
  seed: randomSeed(),
  resumo: false,
  falaClassico: null,
  falaJogador: null,
  usuario: null, // { conta, backend, temAdmin }
  loginModo: 'entrar',
  convite: new URLSearchParams(location.search).get('convite') ?? '',
  admin: { jogadores: null, convites: null, novos: null },
  perfil: null,
  salvoErro: false,
  bazarCat: 'verso',
  ranking: null, // Desafio do dia: { dia, linhas, erro }
  jogadorSel: null, // personagem escolhido para a próxima run
  travaAte: 0, // ignora cliques logo depois de trocar de tela (evita clique perdido)
  ultimaTela: '',
};

const dupla = () => app.partida instanceof PartidaDupla;

// Modo de testes: admin do site, dono do artifact no Claude, ou jogando em localhost com ?debug
const podeTestar = () => !!(app.usuario?.conta?.admin || app.usuario?.conta?.dono
  || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('debug')));

// ---------- perfil e salvamento ----------

let timerSalvar = null;
let salvando = false;
let pendente = false;

function salvarPerfil() {
  if (!app.perfil || !app.usuario?.conta) return;
  app.perfil.atualizadoEm = Date.now();
  backupLocal(app.usuario.conta, app.perfil);
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(descarregar, 700);
}

async function descarregar() {
  clearTimeout(timerSalvar);
  if (!app.perfil || !app.usuario?.conta) return;
  if (salvando) { pendente = true; return; }
  salvando = true;
  try {
    const r = await app.usuario.conta.salvar(app.perfil);
    if (r?.ajustes) aplicarAjustes(r.ajustes);
    if (app.salvoErro) { app.salvoErro = false; render(); }
  } catch (e) {
    console.warn('Falha ao salvar', e);
    if (!app.salvoErro) { app.salvoErro = true; render(); }
  } finally {
    salvando = false;
    if (pendente) { pendente = false; descarregar(); }
  }
}
addEventListener('pagehide', descarregar);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') descarregar(); });

// O admin mudou Tampinhas/réis enquanto você jogava: o banco devolve os valores novos.
function aplicarAjustes({ tampinhas, reis }) {
  const msgs = [];
  if (tampinhas != null) {
    app.perfil.tampinhas = tampinhas;
    msgs.push(`${tampinhas} Tampinhas`);
  }
  if (reis != null) {
    if (app.jogo) {
      app.jogo.run.reis = reis;
      app.perfil.save = app.jogo.salvar();
    } else if (app.perfil.save) {
      try {
        const run = JSON.parse(app.perfil.save);
        run.reis = reis;
        app.perfil.save = JSON.stringify(run);
      } catch { /* save estranho: deixa como está */ }
    }
    msgs.push(`${reis} réis`);
  }
  if (msgs.length) {
    audio.tocar('tampinha');
    toast(`O admin ajustou: agora você tem ${msgs.join(' e ')}.`);
    salvarPerfil();
    render();
  }
}

// Tampinhas de Chefão e recordes, uma vez só por Mesa/run (as marcas ficam no próprio save).
function sincronizarPerfil() {
  const r = app.jogo?.run;
  if (!r || !app.perfil) return;
  const rm = r.resultadoMesa;
  if (rm?.venceu && !rm.creditado) {
    registrarMesa(app.perfil, rm);
    rm.creditado = true;
    if (rm.tampinhas) audio.tocar('tampinha');
  }
  if ((r.fase === 'derrota' || r.fase === 'vitoria') && !r.registradoNoPerfil) {
    registrarFimDeRun(app.perfil, r);
    r.registradoNoPerfil = true;
    if (r.desafio) enviarDesafio(r);
  }
}

async function enviarDesafio(r) {
  const res = resumoDesafio(r);
  const ja = app.perfil.desafios[res.dia];
  r.desafioResultado = { ...res, valeu: !ja && !r.testada, testada: !!r.testada };
  if (ja || r.testada) return;
  app.perfil.desafios[res.dia] = { pontos: res.pontos, bairro: res.bairro, mesas: res.mesas };
  app.perfil.tampinhas += TAMPINHAS_DESAFIO;
  r.desafioResultado.tampinhas = TAMPINHAS_DESAFIO;
  salvarPerfil();
  try {
    const linhas = await app.usuario.conta.desafio.enviar(res);
    app.ranking = { dia: res.dia, linhas };
    r.desafioResultado.posicao = linhas.findIndex((l) => l.eu || (l.pontos === res.pontos && !app.usuario.conta.desafio.global)) + 1 || null;
  } catch (e) {
    r.desafioResultado.erro = e.message;
  }
  render();
}

async function carregarRanking() {
  const dia = diaDeHoje();
  app.ranking = { dia, linhas: null };
  render();
  try {
    app.ranking = { dia, linhas: await app.usuario.conta.desafio.ranking(dia) };
  } catch (e) {
    app.ranking = { dia, linhas: [], erro: e.message };
  }
  render();
}

function lerSave() { return app.perfil?.save ?? null; }
function gravarSave() {
  if (!app.jogo || !app.perfil) return;
  sincronizarPerfil();
  app.perfil.save = app.jogo.salvar();
  salvarPerfil();
}
function apagarSave() {
  if (!app.perfil) return;
  app.perfil.save = null;
  salvarPerfil();
}
function saveContinuavel() {
  const s = lerSave();
  if (!s) return false;
  try { return !['derrota', 'vitoria'].includes(JSON.parse(s).fase); } catch { return false; }
}

async function abrirConta(conta) {
  app.usuario = { ...app.usuario, conta };
  app.tela = 'carregando';
  render();
  let remoto = null;
  try { remoto = await conta.carregar(); } catch (e) { toast(`Não deu para carregar o progresso: ${e.message}`); }
  const backup = lerBackupLocal(conta);
  let inicial = (backup?.atualizadoEm ?? 0) > (remoto?.atualizadoEm ?? 0) ? backup : remoto;
  if (!inicial && conta.tipo !== 'local') {
    // Primeira vez nesta conta: leva junto o que foi jogado sem conta neste aparelho
    inicial = await convidado().carregar();
    if (inicial) toast('O progresso deste aparelho foi para a sua conta.');
  }
  app.perfil = inicial ? normalizarPerfil(app.dados, inicial) : novoPerfil(app.dados);
  audio.configurar(app.perfil.opcoes);
  aplicarVisual();
  app.tela = 'menu';
  salvarPerfil();
  render();
}

// Visual comprado no Bazar: classes no body que mudam variáveis de CSS.
function aplicarVisual() {
  const b = document.body;
  for (const c of [...b.classList]) if (/^(verso|frente|toalha|raio|forma|efeito)-/.test(c)) b.classList.remove(c);
  b.style.removeProperty('--cenario');
  if (!app.perfil) return;
  for (const cat of ['verso', 'frente', 'toalha', 'raio', 'forma', 'efeito']) {
    const classe = itemEquipado(app.dados, app.perfil, cat)?.classe;
    if (classe) b.classList.add(...classe.split(' '));
  }
  const cenario = itemEquipado(app.dados, app.perfil, 'cenario')?.imagem;
  if (cenario) b.style.setProperty('--cenario', `url('${urlCenario(cenario)}')`);
  audio.musica(itemEquipado(app.dados, app.perfil, 'musica').musica);
}

const equipado = (cat) => itemEquipado(app.dados, app.perfil, cat);
const meuAvatar = () => (app.perfil ? equipado('avatar').avatar : '🙂');
const pick = (lista) => lista[Math.floor(Math.random() * lista.length)];

// ---------- efeitos visuais ----------

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

async function carimbo(texto, sub = '') {
  const el = document.createElement('div');
  el.className = 'carimbo';
  el.innerHTML = `<span>${esc(texto)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
  document.body.appendChild(el);
  document.querySelector('.toalha')?.classList.add('treme');
  audio.tocar('carimbo');
  await sleep(VEL.carimbo);
  el.remove();
  document.querySelector('.toalha')?.classList.remove('treme');
}

function desenharConta() {
  const el = document.getElementById('conta');
  if (el) el.outerHTML = contaHTML();
}

const MS_PALCO = reduzido
  ? { entrada: 80, passo: 60, raio: 90, total: 300 }
  : { entrada: 420, passo: 380, raio: 620, total: 900 };

function defComparsa(uid) {
  const inst = app.jogo?.run.comparsas.find((c) => c.uid === uid);
  return inst ? app.dados.comparsasPorId[inst.id] ?? null : null;
}

function nomeComparsa(uid) {
  return defComparsa(uid)?.nome ?? null;
}

// Fala sorteada do Comparsa (data/falas-comparsas.json); null se ele não tiver falas
function falaComparsa(uid) {
  const def = defComparsa(uid);
  const falas = def ? app.dados.falasComparsas?.[def.id] : null;
  return Array.isArray(falas) && falas.length ? falas[Math.floor(Math.random() * falas.length)] : null;
}

// Rodada vencida: a carta vai para o centro e os Comparsas soltam raios nela (ui/palco.js)
async function animarVaza(ev) {
  const nomeJogada = app.dados.jogadas[ev.jogada].nome;
  const ctx = app.jogo?.rodada?.vira ? app.jogo.ctxForca() : null;
  await palcoRodada(ev, {
    cartaHtml: cartaHTML(ev.carta, { ctx, estatica: true }),
    nomeJogada: ev.fuga ? `${nomeJogada} (fuga)` : nomeJogada,
    nomeComparsa,
    defComparsa,
    falaComparsa,
    ms: MS_PALCO,
  });
  const ultimo = ev.passos[ev.passos.length - 1];
  app.conta = { jogada: nomeJogada, fichas: ultimo?.fichas, mult: ultimo?.mult, origem: ev.total === 0 ? 'Não pontuou' : 'Rodada guardada', total: ev.total };
  desenharConta();
}

// Fim da mão: soma das rodadas, bônus e o multiplicador do truco, um por um
async function animarMao(ev) {
  if (!ev.passos.length) return;
  await palcoMao(ev, { titulo: ev.valor > 1 ? `Mão valendo ${ev.valor}` : 'Fim da mão', nomeComparsa, defComparsa, falaComparsa, ms: MS_PALCO });
  const ultimo = ev.passos[ev.passos.length - 1];
  app.conta = { jogada: 'Fim da mão', fichas: null, mult: null, origem: `+${fmt(ultimo.total)} na Mesa`, total: ultimo.total };
  desenharConta();
}

function vozDe(pessoaId) {
  return app.dados.personagensPorId[pessoaId]?.voz ?? {};
}

function falarJogador(texto) {
  app.falaJogador = texto;
  audio.falar(texto, VOZ_JOGADOR);
  render();
}

async function tocarFila() {
  app.animando = true;
  while (app.fila.length) {
    const ev = app.fila.shift();
    const meu = ev.jogador === 0;
    if (ev.tipo === 'OnMesaIniciada' && ev.chefao && app.jogo) {
      const r = app.jogo.run;
      const pessoa = app.dados.personagensPorId[ev.chefao];
      await cenaChefao(pessoa, { bairro: r.bairro, nomeBairro: app.jogo.nomeBairro(), final: !!pessoa.final });
    } else if (ev.tipo === 'OnFala') {
      audio.falar(ev.texto, vozDe(ev.pessoa));
    } else if (ev.tipo === 'OnMaoDistribuida') {
      audio.tocar('embaralhar');
    } else if (ev.tipo === 'OnCartaJogada') {
      audio.tocar('carta');
    } else if (ev.tipo === 'OnTrucoPedido') {
      audio.tocar('truco');
      const grito = equipado('falaTruco');
      if (meu) falarJogador(pick(grito.falas.pedir));
      const texto = meu && ev.valor === 3 ? grito.carimbo : NOME_VALOR[ev.valor] ?? 'TRUCO!';
      await carimbo(texto, meu ? 'você pediu' : ev.jogador === 2 ? 'seu parceiro pediu' : 'o adversário pediu');
    } else if (ev.tipo === 'OnTrucoRespondido') {
      if (ev.resposta === 'aumentar') {
        audio.tocar('truco');
        if (meu) falarJogador(pick(equipado('falaTruco').falas.aumentar));
        await carimbo(NOME_VALOR[ev.valor], meu ? 'você aumentou' : ev.jogador === 2 ? 'seu parceiro aumentou' : 'o adversário aumentou');
      } else if (ev.resposta === 'correr') {
        await carimbo('CORREU!', meu || ev.jogador === 2 ? 'vocês correram' : 'o adversário correu');
      } else if (!meu) toast('O adversário aceitou: desce!');
    } else if (ev.tipo === 'OnVazaResolvida') {
      audio.tocar(ev.vaza.vencedor === 0 ? 'vazaGanha' : ev.vaza.vencedor === 1 ? 'vazaPerdida' : 'clique');
      await sleep(VEL.vaza);
    } else if (ev.tipo === 'OnVazaPontuada') {
      await animarVaza(ev);
    } else if (ev.tipo === 'MaoPontuada' || (ev.tipo === 'OnMaoFinalizada' && app.tela === 'classico')) {
      const venceu = ev.tipo === 'MaoPontuada' ? ev.venceu : ev.vencedor === 0;
      const perdeu = ev.tipo === 'MaoPontuada' ? ev.vencedor === 1 : ev.vencedor === 1;
      if (venceu) {
        audio.tocar('vitoria');
        falarJogador(pick(equipado('falaVitoria').falas));
        if (ev.tipo === 'MaoPontuada') await animarMao(ev);
      } else if (perdeu) {
        audio.tocar('derrota');
        falarJogador(pick(equipado('falaDerrota').falas));
      }
    } else if (ev.tipo === 'OnMesaFinalizada' && ev.venceu) {
      audio.tocar('moeda');
      if (ev.fala) audio.falar(ev.fala, vozDe(ev.pessoaId));
    }
  }
  app.animando = false;
}

// Executa um comando do jogador e depois deixa a IA agir com calma.
async function executar(fn, { limparSel = true } = {}) {
  if (app.ocupado) return;
  try {
    fn();
  } catch (e) {
    toast(e.message);
    render();
    return;
  }
  if (limparSel) app.sel = [];
  app.falaJogador = null;
  app.ocupado = true;
  try {
    coletarClassico();
    // Com animação na fila, o resultado (fim de mão/Mesa) só aparece depois dela
    app.animando = app.fila.length > 0;
    render();
    await tocarFila();
    while (app.jogo && app.tela === 'jogo' && app.jogo.iaPrecisaAgir()) {
      render();
      await sleep(VEL.ia);
      app.jogo.passoIA();
      app.animando = app.fila.length > 0;
      render();
      await tocarFila();
    }
    while (app.partida && app.tela === 'classico' && app.partida.iaPrecisaAgir()) {
      render();
      await sleep(VEL.ia);
      const acao = app.partida.passoIA();
      falarClassico(acao);
      coletarClassico();
      render();
      await tocarFila();
    }
  } catch (e) {
    console.error(e);
    toast(e.message);
  } finally {
    app.ocupado = false;
    app.animando = false;
    if (app.tela === 'jogo') gravarSave();
    render();
  }
}

function coletarClassico() {
  if (app.tela !== 'classico' || !app.partida?.ultimosEventos?.length) return;
  app.fila.push(...app.partida.ultimosEventos);
  app.partida.ultimosEventos = null;
}

function falarClassico(acao) {
  const pessoa = app.dados.personagensPorId[dupla() ? app.partida.pessoas[acao.jogador] : CLASSICO_PESSOA];
  let momento = null;
  if (acao.tipo === 'pedir') momento = 'pedir';
  else if (acao.tipo === 'responder') momento = acao.resposta;
  app.falaClassico = momento ? pick(falasDe(app.dados, pessoa, momento)) : null;
  if (app.falaClassico) app.fila.unshift({ tipo: 'OnFala', texto: app.falaClassico, pessoa: pessoa.id });
}

// ---------- ações ----------

function novaRunCom(seed, baralhoId, desafio = null) {
  const bus = new GameEventBus();
  bus.on('*', (ev) => app.fila.push(ev));
  // Desafio do dia: todo mundo joga com o mesmo personagem
  const jogador = desafio ? 'chico_baralho' : app.jogadorSel ?? equipado('personagem')?.jogador ?? 'chico_baralho';
  app.jogo = Jogo.novaRun(app.dados, { seed, baralhoId, desafio, jogador }, bus);
  app.tela = 'jogo';
  app.resumo = false;
  app.conta = null;
  app.sel = [];
  gravarSave();
}

const acoes = {
  irMenu() { app.tela = 'menu'; app.modal = null; },
  irSelecao() { app.tela = 'selecao'; app.seed = randomSeed(); },
  irColecao() { app.tela = 'colecao'; },
  irBazar() { app.tela = 'bazar'; },
  irDesafio() { app.tela = 'desafio'; carregarRanking(); },
  jogarDesafio() {
    const dia = diaDeHoje();
    novaRunCom(sementeDoDia(dia), BARALHO_DESAFIO, dia);
    if (app.perfil.desafios[dia]) toast('Você já jogou o desafio de hoje: esta vale como treino.');
    executar(() => {});
  },
  trucoDupla() {
    const s = randomSeed();
    const gente = app.dados.personagens.filter((x) => x.tipo !== 'chefao');
    const sorteio = [...gente].sort(() => Math.random() - 0.5).slice(0, 3);
    const pessoas = { 1: sorteio[0].id, 2: sorteio[1].id, 3: sorteio[2].id };
    const perfis = Object.fromEntries(Object.entries(pessoas).map(([j, id]) => [j, perfilDe(app.dados, app.dados.personagensPorId[id])]));
    app.partida = new PartidaDupla({ seed: s, perfis, pontosVitoria: app.dados.regras.classico.pontosVitoria });
    app.partida.pessoas = pessoas;
    app.tela = 'classico';
    app.falaClassico = null;
    app.sel = [];
    executar(() => {});
  },
  sinalizar(chave) {
    if (app.tela === 'classico') return executar(() => app.partida.sinalizar(chave), { limparSel: false });
    executar(() => app.jogo.sinalizar(chave), { limparSel: false });
  },
  async evento(i) {
    const j = app.jogo;
    const ev = j.evento;
    let res;
    try {
      res = j.resolverEvento(Number(i));
    } catch (e) {
      toast(e.message);
      return render();
    }
    gravarSave();
    if (res.roleta) await girarRoleta(app.dados.eventos.roleta, res.roleta.indice);
    const textos = res.textos.join(' · ');
    if (textos) toast(`${ev.icone} ${textos}`);
    audio.tocar(res.roleta && !res.roleta.bom ? 'derrota' : 'moeda');
    render();
  },
  irLogin() { app.tela = 'login'; },
  escolherBaralho(id) { app.baralhoSel = id; },
  escolherJogador(id) {
    app.jogadorSel = id;
    const item = app.dados.bazarPorId[`jogador_${id}`];
    if (item) { equiparItem(app.dados, app.perfil, item.id); salvarPerfil(); }
  },
  adminCarta(i) {
    const v = (id) => document.getElementById(id)?.value;
    executar(() => { app.jogo.adminCarta(Number(i), v(`adm-r${i}`), v(`adm-s${i}`)); toast('Carta trocada'); }, { limparSel: true });
  },
  adminVira() {
    const v = (id) => document.getElementById(id)?.value;
    executar(() => { app.jogo.adminVira(v('adm-vr'), v('adm-vs')); toast('Vira trocada'); });
  },
  adminPersonagem() {
    executar(() => { app.jogo.adminPersonagem(document.getElementById('adm-jog').value); toast(`Agora você é ${app.jogo.jogador.nome}`); });
  },
  adminRecarregar() { executar(() => { app.jogo.adminRecarregarPoder(); toast('Poder recarregado'); }); },
  adminComparsa() {
    executar(() => { app.jogo.adminComparsa(document.getElementById('adm-comp').value); toast('Comparsa adicionado'); });
  },
  adminConsumivel() {
    const [tipo, id] = document.getElementById('adm-cons').value.split(':');
    executar(() => { app.jogo.adminConsumivel(tipo, id); toast('Item adicionado'); });
  },
  adminValores() {
    const n = (id) => { const x = document.getElementById(id)?.value; return x === '' || x == null ? null : Number(x); };
    executar(() => {
      app.jogo.adminValores({ reis: n('adm-reis'), tentos: n('adm-tentos'), maos: n('adm-maos'), trocas: n('adm-trocas'), pontos: n('adm-pontos') });
      toast('Valores aplicados');
    });
  },
  irBazarPersonagem() { app.tela = 'bazar'; app.bazarCat = 'personagem'; },
  poder() {
    const j = app.jogo;
    executar(() => {
      const texto = j.usarPoder([...app.sel]);
      audio.tocar('raio', 6);
      toast(`⚡ ${texto}`);
    });
  },
  novaSeed() { app.seed = randomSeed(); },
  comecarRun() {
    const input = document.getElementById('seed-input');
    const seed = (input?.value || app.seed).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || randomSeed();
    novaRunCom(seed, app.baralhoSel);
  },
  continuar() {
    const s = lerSave();
    if (!s) return;
    const bus = new GameEventBus();
    bus.on('*', (ev) => app.fila.push(ev));
    app.jogo = Jogo.carregar(app.dados, s, bus);
    app.tela = 'jogo';
    app.resumo = false;
    executar(() => {});
  },
  classico() {
    const pessoa = app.dados.personagensPorId[CLASSICO_PESSOA];
    app.partida = new PartidaClassica({ seed: randomSeed(), perfil: perfilDe(app.dados, pessoa), pontosVitoria: app.dados.regras.classico.pontosVitoria });
    app.tela = 'classico';
    app.falaClassico = pick(falasDe(app.dados, pessoa, 'entrada'));
    app.sel = [];
    app.fila.push({ tipo: 'OnFala', texto: app.falaClassico, pessoa: pessoa.id });
    executar(() => {});
  },
  modal(nome) { app.modal = nome; },
  fecharModal() { app.modal = null; app.detalhe = null; },
  detalhe(arg) {
    const i = arg.indexOf(':');
    app.detalhe = { tipo: arg.slice(0, i), id: arg.slice(i + 1) };
    app.modal = 'detalhe';
  },
  mudo() {
    app.perfil.opcoes.mudo = !app.perfil.opcoes.mudo;
    audio.configurar(app.perfil.opcoes);
    salvarPerfil();
  },

  // conta
  async entrar() { await fazerLogin(app.loginModo === 'criar'); },
  loginModo(m) { app.loginModo = m; },
  convidado() {
    try { localStorage.setItem('trucatro.convidado', '1'); } catch { /* ignora */ }
    abrirConta(convidado());
  },
  async sairConta() {
    await descarregar();
    await app.usuario.conta.sair?.();
    app.perfil = null;
    app.jogo = null;
    app.usuario = { ...app.usuario, conta: null };
    app.admin = { jogadores: null, convites: null, novos: null };
    try { localStorage.removeItem('trucatro.convidado'); } catch { /* ignora */ }
    aplicarVisual();
    app.tela = 'login';
    app.modal = null;
    render();
  },

  // admin
  irAdmin() { app.tela = 'admin'; carregarAdmin(); },
  async criarConvites() {
    const qtd = Number(document.getElementById('adm-qtd')?.value);
    const obs = document.getElementById('adm-obs')?.value ?? '';
    await acaoAdmin(async (adm) => {
      app.admin.novos = await adm.criarConvites(qtd, obs);
      toast(`${app.admin.novos.length} convite${app.admin.novos.length > 1 ? 's' : ''} criado${app.admin.novos.length > 1 ? 's' : ''}`);
    });
  },
  async apagarConvite(codigo) {
    await acaoAdmin(async (adm) => { await adm.apagarConvite(codigo); toast('Convite apagado'); });
  },
  async salvarJogador(nome) {
    const linha = document.querySelector(`[data-jogador="${CSS.escape(nome)}"]`);
    const ler = (campo) => {
      const v = linha?.querySelector(`[data-campo="${campo}"]`)?.value.trim();
      return v === '' || v == null ? null : Number(v);
    };
    const tampinhas = ler('tampinhas');
    const reis = ler('reis');
    if ([tampinhas, reis].some((v) => v != null && (!Number.isInteger(v) || v < 0))) return toast('Use números inteiros a partir de 0');
    await acaoAdmin(async (adm) => {
      await adm.definir(nome, tampinhas, reis);
      // A própria conta do admin: aplica já, sem esperar o próximo salvamento
      if (nome.toLowerCase() === app.usuario.conta.nome.toLowerCase()) aplicarAjustes({ tampinhas, reis: app.jogo || app.perfil.save ? reis : null });
      toast(`${nome} atualizado`);
    });
  },
  async copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      toast('Copiado!');
    } catch { toast('Não deu para copiar: selecione o texto e copie'); }
  },

  // bazar
  bazarCat(id) { app.bazarCat = id; },
  comprarBazar(id) {
    try {
      comprarItem(app.dados, app.perfil, id);
      audio.tocar('tampinha');
      toast(`${app.dados.bazarPorId[id].nome}: comprado e equipado!`);
      aplicarVisual();
      salvarPerfil();
    } catch (e) { toast(e.message); }
  },
  equiparBazar(id) {
    equiparItem(app.dados, app.perfil, id);
    audio.tocar('selecionar');
    aplicarVisual();
    salvarPerfil();
  },
  ouvir(id) {
    const item = app.dados.bazarPorId[id];
    if (item.musica) {
      audio.destravar();
      audio.musica(item.musica);
      toast(`Tocando ${item.nome} por alguns segundos`);
      clearTimeout(app.timerPrevia);
      app.timerPrevia = setTimeout(() => audio.musica(equipado('musica').musica), 12000);
      return;
    }
    const texto = item.categoria === 'falaTruco' ? item.falas.pedir[0] : item.falas[0];
    audio.falar(texto, VOZ_JOGADOR);
    if (!audio.temVoz()) toast('Este navegador não tem voz sintetizada');
  },

  // mapa
  sentar() { executar(() => app.jogo.iniciarMesa()); },
  pularMesa() {
    executar(() => {
      app.jogo.pularMesa();
      toast(`Promessa recebida: ${app.jogo.run.ultimaPromessa.descricao}`);
    });
  },

  // mesa
  carta(id) {
    if (app.tela === 'classico') return acaoCartaClassico(id);
    const j = app.jogo;
    const rd = j.rodada;
    if (!rd || rd.fase === 'fim' || rd.fase === 'vira') return;
    const st = rd.mao;
    const podeJogar = rd.fase === 'jogo' ? st.vez === 0 && !st.pedido : rd.iniciante === 0;
    const i = app.sel.indexOf(id);
    if (i >= 0) {
      if (app.sel.length === 1 && podeJogar) return executar(() => j.jogarCarta(id));
      app.sel.splice(i, 1);
    } else if (rd.fase === 'jogo') {
      app.sel = [id];
    } else {
      app.sel.push(id);
    }
    audio.tocar('selecionar');
  },
  jogar() {
    if (app.tela === 'classico') return executar(() => app.partida.jogar(app.sel[0]));
    if (app.sel.length !== 1) return toast('Selecione uma carta');
    executar(() => app.jogo.jogarCarta(app.sel[0]));
  },
  trocar() { audio.tocar('embaralhar'); executar(() => app.jogo.trocar([...app.sel])); },
  abrir() { executar(() => app.jogo.comecarRodada()); },
  truco() {
    if (app.tela === 'classico') return executar(() => app.partida.truco(), { limparSel: false });
    executar(() => app.jogo.pedirTruco(), { limparSel: false });
  },
  responder(r) {
    if (app.tela === 'classico') return executar(() => app.partida.responder(r), { limparSel: false });
    executar(() => app.jogo.responderTruco(r), { limparSel: false });
  },
  escolherVira(i) { executar(() => app.jogo.escolherVira(Number(i))); },
  benzer() { executar(() => app.jogo.benzer(), { limparSel: false }); },
  proximaMao() {
    app.conta = null;
    executar(() => app.jogo.proximaMao());
  },
  usar(idx) {
    const j = app.jogo;
    const item = j.run.consumiveis[Number(idx)];
    const def = defConsumivel(app.dados, item);
    executar(() => {
      j.usarConsumivel(Number(idx), [...app.sel]);
      toast(item.tipo === 'simpatia' ? `${app.dados.jogadas[def.jogada].nome} subiu de nível!` : `${def.nome} usado`);
    });
  },
  descartarConsumivel(idx) { executar(() => app.jogo.descartarConsumivel(Number(idx))); },
  irBoteco() { app.conta = null; executar(() => app.jogo.irAoBoteco()); },
  verResumo() { app.resumo = true; },
  continuarInfinito() { app.resumo = false; executar(() => app.jogo.continuarInfinito()); },

  // boteco
  comprar(i) { audio.tocar('moeda'); executar(() => app.jogo.comprar(Number(i))); },
  vender(uid) { audio.tocar('moeda'); executar(() => app.jogo.venderComparsa(Number(uid))); },
  mover(arg) {
    const [uid, dir] = arg.split(':').map(Number);
    executar(() => app.jogo.moverComparsa(uid, dir));
  },
  reroll() { audio.tocar('embaralhar'); executar(() => app.jogo.reroll()); },
  seguir() { executar(() => app.jogo.sairDoBoteco()); },
  abandonar() {
    apagarSave();
    app.jogo = null;
    app.tela = 'menu';
    app.modal = null;
  },

  // clássico
  decidirOnze(arg) { executar(() => app.partida.decidirOnze(0, arg === 'jogar')); },
  proximaMaoClassico() { app.falaClassico = null; executar(() => app.partida.proximaMao()); },
};

async function fazerLogin(criar) {
  const nome = document.getElementById('login-nome')?.value ?? '';
  const senha = document.getElementById('login-senha')?.value ?? '';
  const convite = document.getElementById('login-convite')?.value ?? app.convite;
  if (app.ocupado) return;
  app.ocupado = true;
  render();
  try {
    const conta = await entrar(app.usuario.backend, { nome, senha, convite, criar });
    if (criar && app.convite) history.replaceState(null, '', location.pathname);
    app.ocupado = false;
    toast(criar ? `Conta criada. Bem-vindo, ${conta.nome}!` : `Bem-vindo de volta, ${conta.nome}!`);
    await abrirConta(conta);
  } catch (e) {
    app.ocupado = false;
    toast(e.message);
    render();
    document.getElementById('login-senha')?.focus();
  }
}

// ---------- painel do admin ----------

function linkConvite(codigo) {
  return `${location.origin}${location.pathname}?convite=${encodeURIComponent(codigo)}`;
}

async function acaoAdmin(fn) {
  const adm = app.usuario?.conta?.adm;
  if (!adm || app.ocupado) return;
  app.ocupado = true;
  render();
  try {
    await fn(adm);
    const [jogadores, convites] = await Promise.all([adm.jogadores(), adm.convites()]);
    Object.assign(app.admin, { jogadores, convites });
  } catch (e) {
    toast(e.message);
  } finally {
    app.ocupado = false;
    render();
  }
}

function carregarAdmin() {
  acaoAdmin(async () => {});
}

function acaoCartaClassico(id) {
  const p = app.partida;
  if (p.fase !== 'jogo' || p.mao.vez !== 0 || p.mao.pedido || p.fase === 'onze') return;
  if (app.sel[0] === id) return executar(() => p.jogar(id));
  app.sel = [id];
  audio.tocar('selecionar');
}

raiz.addEventListener('click', (e) => {
  if (e.target.matches('[data-fundo-modal]')) {
    app.modal = null;
    app.detalhe = null;
    render();
    return;
  }
  const el = e.target.closest('[data-acao]');
  if (!el || el.disabled || app.ocupado || performance.now() < app.travaAte) return;
  const fn = acoes[el.dataset.acao];
  if (!fn) return;
  if (el.tagName === 'BUTTON' && !el.classList.contains('carta')) audio.tocar('clique');
  const resultado = fn(el.dataset.arg);
  if (!(resultado instanceof Promise)) render();
});

raiz.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'form-login') acoes.entrar();
});

// Controles de volume: atualizam sem redesenhar a tela
raiz.addEventListener('input', (e) => {
  const chave = e.target.dataset.opcao;
  if (!chave || !app.perfil) return;
  app.perfil.opcoes[chave] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
  audio.configurar(app.perfil.opcoes);
  document.body.classList.toggle('efeitos-leves', !!app.perfil.opcoes.efeitosLeves);
  salvarPerfil();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.modal) {
    app.modal = null;
    app.detalhe = null;
    render();
    return;
  }
  if (app.modal || app.ocupado || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  if (app.tela !== 'jogo' && app.tela !== 'classico') return;
  const clicar = (sel) => {
    const b = raiz.querySelector(sel);
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  };
  if (/^[1-5]$/.test(e.key)) {
    const cartas = raiz.querySelectorAll('.mao .carta');
    cartas[Number(e.key) - 1]?.click();
  } else if (e.key.toLowerCase() === 't') {
    clicar('[data-acao="truco"]') || clicar('[data-acao="responder"][data-arg="aumentar"]');
  } else if (e.key === 'Enter' && document.activeElement === document.body) {
    clicar('.sobreposto .btn.amarelo') || clicar('.mao-area .btn.amarelo:not([disabled])');
  }
});

// O navegador só libera som depois de um toque ou tecla
const destravar = () => audio.destravar();
document.addEventListener('pointerdown', destravar);
document.addEventListener('keydown', destravar);

// ---------- telas ----------

function render() {
  document.body.classList.toggle('ocupado', app.ocupado);
  document.body.classList.toggle('efeitos-leves', !!app.perfil?.opcoes?.efeitosLeves);
  let html = '';
  if (!app.dados || app.tela === 'carregando') html = '<section class="menu"><h1 class="logo">TRUCATRO</h1><p class="rotulo">Embaralhando...</p></section>';
  else if (app.tela === 'login') html = telaLogin();
  else if (app.tela === 'menu') html = telaMenu();
  else if (app.tela === 'selecao') html = telaSelecao();
  else if (app.tela === 'colecao') html = telaColecao();
  else if (app.tela === 'bazar') html = telaBazar();
  else if (app.tela === 'admin') html = telaAdmin();
  else if (app.tela === 'classico') html = dupla() ? telaDupla() : telaClassico();
  else if (app.tela === 'desafio') html = telaDesafio();
  else if (app.tela === 'jogo') html = telaJogo();
  const foco = document.activeElement?.id;
  const valores = {};
  for (const id of ['login-nome', 'login-senha', 'login-convite', 'seed-input', 'adm-qtd', 'adm-obs']) {
    const el = document.getElementById(id);
    if (el) valores[id] = el.value;
  }
  raiz.innerHTML = html + botaoSom() + modalHTML();
  const assinatura = `${app.tela}|${app.jogo?.run.fase ?? ''}|${raiz.querySelector('.sobreposto') ? 1 : 0}|${app.modal ?? ''}`;
  if (assinatura !== app.ultimaTela) {
    app.ultimaTela = assinatura;
    app.travaAte = performance.now() + 350;
  }
  for (const [id, v] of Object.entries(valores)) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }
  if (foco) document.getElementById(foco)?.focus();
}

function botaoSom() {
  if (!app.perfil) return '';
  const mudo = app.perfil.opcoes.mudo;
  return `<div class="som-flutuante">
    <button class="btn fantasma peq acao" data-acao="mudo" aria-pressed="${mudo}" aria-label="${mudo ? 'Ligar o som' : 'Desligar o som'}">${mudo ? '🔇' : '🔊'}</button>
    <button class="btn fantasma peq acao" data-acao="modal" data-arg="som">Som</button>
  </div>`;
}

function chipConta() {
  const u = app.usuario;
  const p = app.perfil;
  const moeda = `<span class="tampinhas" title="${esc(app.dados.bazar.moeda.descricao)}"><i class="tampa" aria-hidden="true"></i>${p.tampinhas} Tampinhas</span>`;
  let quem;
  if (u.conta.tipo === 'claude') quem = `<span>Conta do Claude: <b>${esc(u.conta.nome)}</b></span>`;
  else if (u.conta.tipo === 'servidor' || u.conta.tipo === 'online') quem = `<span>Jogador: <b>${esc(u.conta.nome)}</b>${u.conta.admin ? ' <span class="selo-admin">admin</span>' : ''}</span><button class="btn fantasma peq acao" data-acao="sairConta">Sair</button>`;
  else if (u.backend) quem = '<span>Sem conta (salva só neste aparelho)</span><button class="btn amarelo peq acao" data-acao="irLogin">Entrar</button>';
  else quem = '<span>Progresso salvo neste aparelho</span>';
  const eu = `<span class="eu"><span class="avatar-mini" aria-hidden="true">${esc(meuAvatar())}</span>${esc(equipado('titulo').nome)}</span>`;
  return `<div class="chip-conta">${eu}${quem}${moeda}${app.salvoErro ? '<span class="aviso">Sem conexão: salvo só aqui por enquanto</span>' : ''}</div>`;
}

function telaLogin() {
  const b = app.usuario?.backend;
  const criar = app.loginModo === 'criar';
  const primeira = b && app.usuario.temAdmin === false;
  const pedeConvite = criar && b?.exigeConvite && !primeira;
  return `<section class="menu">
    <h1 class="logo">TRUCATRO<small>${criar ? 'Crie sua conta para jogar' : 'Entre para jogar e guardar seu progresso'}</small></h1>
    <form class="lousa login" id="form-login" autocomplete="on">
      <div class="botoes abas-login">
        <button class="btn peq ${criar ? 'fantasma' : 'amarelo'} acao" type="button" data-acao="loginModo" data-arg="entrar" aria-pressed="${!criar}">Entrar</button>
        <button class="btn peq ${criar ? 'amarelo' : 'fantasma'} acao" type="button" data-acao="loginModo" data-arg="criar" aria-pressed="${criar}">Criar conta</button>
      </div>
      ${primeira && criar ? '<p class="aviso-login">Ainda não existe nenhuma conta: a primeira criada vira <b>admin</b> e não precisa de convite.</p>' : ''}
      <label class="rotulo" for="login-nome">Nome</label>
      <input id="login-nome" name="username" autocomplete="username" maxlength="20" required>
      <label class="rotulo" for="login-senha">Senha${criar ? ' (mínimo 6)' : ''}</label>
      <input id="login-senha" name="password" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}" maxlength="100" required>
      ${pedeConvite ? `<label class="rotulo" for="login-convite">Código do convite</label>
      <input id="login-convite" name="convite" value="${esc(app.convite)}" autocomplete="off" spellcheck="false" maxlength="9" placeholder="XXXX-XXXX" required>` : ''}
      <div class="botoes"><button class="btn amarelo" type="submit">${criar ? 'Criar conta e jogar' : 'Entrar'}</button></div>
      <p class="rotulo">${pedeConvite ? 'Para criar conta você precisa de um convite do admin.' : 'A conta guarda a run em andamento, suas Tampinhas e o que você comprou no Bazar. Se sair no meio de uma Mesa, continua de onde parou.'}</p>
      ${b?.exigeConta ? '' : '<button class="btn fantasma peq acao" type="button" data-acao="convidado">Jogar sem conta</button>'}
    </form>
  </section>`;
}

function telaMenu() {
  const leque = [
    { id: 'm1', rank: '4', suit: 'paus' }, { id: 'm2', rank: '7', suit: 'copas' },
    { id: 'm3', rank: 'A', suit: 'espadas' }, { id: 'm4', rank: '7', suit: 'ouros' },
  ];
  return `${chipConta()}
  <section class="menu">
    <div class="leque">${leque.map((c) => cartaHTML(c, { estatica: true })).join('')}</div>
    <h1 class="logo">TRUCATRO<small>Truco Paulista de mesa em mesa, até o Rei do Truco</small></h1>
    <div class="botoes">
      ${saveContinuavel() ? '<button class="btn amarelo acao" data-acao="continuar">Continuar run</button>' : ''}
      <button class="btn truco acao" data-acao="irSelecao">Nova run</button>
      <button class="btn amarelo acao" data-acao="irDesafio">Desafio do dia</button>
      <button class="btn acao" data-acao="classico">Truco clássico</button>
      <button class="btn acao" data-acao="trucoDupla">Truco em dupla</button>
      <button class="btn acao" data-acao="irBazar">Bazar das Tampinhas</button>
      ${app.usuario.conta.admin ? '<button class="btn amarelo acao" data-acao="irAdmin">Painel do admin</button>' : ''}
      <button class="btn fantasma acao" data-acao="irColecao">Coleção</button>
      <button class="btn fantasma acao" data-acao="modal" data-arg="ajuda">Como jogar</button>
    </div>
    ${app.perfil.recordes.runs ? `<p class="rotulo">Runs: ${app.perfil.recordes.runs} · Vitórias: ${app.perfil.recordes.vitorias} · Melhor bairro: ${app.perfil.recordes.melhorBairro}</p>` : ''}
  </section>`;
}

function telaSelecao() {
  const fichas = app.dados.baralhos.map((b) => `
    <button class="ficha ${b.id === app.baralhoSel ? 'escolhida' : ''}" data-acao="escolherBaralho" data-arg="${b.id}" style="text-align:left;border:0;cursor:pointer">
      <h3>${esc(b.nome)}</h3><p>${esc(b.descricao)}</p>
    </button>`).join('');
  const sel = app.jogadorSel ?? equipado('personagem')?.jogador ?? 'chico_baralho';
  const quem = app.dados.jogadores.map((jg) => {
    const item = app.dados.bazarPorId[`jogador_${jg.id}`];
    const tem = !item || app.perfil.compras.includes(item.id);
    return `<button class="ficha jogador-ficha ${jg.id === sel ? 'escolhida' : ''} ${tem ? '' : 'bloqueada'}" data-acao="${tem ? 'escolherJogador' : 'irBazarPersonagem'}" data-arg="${jg.id}" style="text-align:left;border:0;cursor:pointer">
      <div class="pessoa-cab"><span class="avatar grande" aria-hidden="true">${esc(jg.avatar)}</span><div><h3>${esc(jg.nome)}</h3><small>${esc(jg.titulo)}</small></div></div>
      <p class="poder-nome">⚡ ${esc(jg.poder.nome)}</p><p>${esc(jg.poder.descricao)}</p>
      <p class="rotulo">${jg.poder.gratis}× grátis por Mesa${jg.poder.custo ? ` · depois ${jg.poder.custo.reis ? `${jg.poder.custo.reis} réis` : `${jg.poder.custo.tentos} tento ao adversário`}` : ''}</p>
      ${tem ? '' : `<span class="cadeado">🔒 ${item.preco} Tampinhas no Bazar</span>`}
    </button>`;
  }).join('');
  return `<div class="topo"><h2>Quem vai jogar?</h2><button class="btn fantasma acao" data-acao="irMenu">Voltar</button></div>
    <div class="grade">${quem}</div>
    <h2 class="subtitulo-tela">Escolha o baralho</h2>
    <div class="grade">${fichas}</div>
    <div class="placa" style="margin-top:18px;display:grid;gap:12px">
      <div class="campo"><label class="rotulo" for="seed-input" style="color:var(--papel)">Seed</label>
        <input id="seed-input" value="${esc(app.seed)}" maxlength="16" autocomplete="off" spellcheck="false">
        <button class="btn fantasma peq acao" data-acao="novaSeed">Sortear outra</button></div>
      <div class="botoes"><button class="btn truco acao" data-acao="comecarRun">Começar run</button></div>
    </div>`;
}

function fichaPessoa(p) {
  return `<div class="ficha">
    ${infoBtn('pessoa', p.id, p.nome)}
    <div class="pessoa-cab">${avatarHTML(p)}<div><h3>${esc(p.nome)}</h3><small>${esc(p.titulo)}</small></div></div>
    <p class="manha"><b>Manha:</b> ${esc(p.regra)}</p>
    ${p.drop ? `<p class="rotulo-tinta">Deixa cair ${p.drop}+ Tampinhas</p>` : ''}
  </div>`;
}

function telaColecao() {
  const d = app.dados;
  const comps = d.comparsas.map((c) => `<div class="ficha">${infoBtn('comparsa', c.id, c.nome)}<span class="raridade r-${c.raridade}">${NOME_RARIDADE[c.raridade]}</span>${nomeComAvatar(c, 'h3')}<p>${esc(c.descricao)}</p><div class="rodape"><span class="preco">${c.preco} réis</span></div></div>`).join('');
  const causos = d.causos.map((c) => `<div class="ficha">${infoBtn('causo', c.id, c.nome)}<span class="raridade" style="background:#8a5a2b">Causo</span><h3>${esc(c.nome)}</h3><p>${esc(c.descricao)}</p></div>`).join('');
  const simps = d.simpatias.map((c) => `<div class="ficha">${infoBtn('simpatia', c.id, c.nome)}<span class="raridade" style="background:#5c4a8a">Simpatia</span><h3>${esc(c.nome)}</h3><p>${esc(c.descricao)}</p></div>`).join('');
  const melhorias = [
    ...Object.entries(d.cartas.melhorias).map(([id, m]) => `<div class="ficha">${infoBtn('melhoria', id, m.nome)}<span class="raridade" style="background:#2b5a7a">Melhoria</span><h3>${esc(m.nome)}</h3><p>${esc(m.descricao)}</p></div>`),
    ...Object.entries(d.cartas.selos).map(([id, s]) => `<div class="ficha">${infoBtn('selo', id, s.nome)}<span class="raridade" style="background:#2b5a7a">Selo</span><h3>${esc(s.nome)}</h3><p>${esc(s.descricao)}</p></div>`),
  ].join('');
  const grupo = (tipo) => d.personagens.filter((p) => p.tipo === tipo).map(fichaPessoa).join('');
  return `<div class="topo"><h2>Coleção</h2><button class="btn fantasma acao" data-acao="irMenu">Voltar</button></div>
    <p class="rotulo" style="margin-top:-8px">Toque no <span class="info-exemplo">i</span> de qualquer item para ver como ele funciona, com exemplo.</p>
    <div style="display:grid;gap:22px;margin-top:12px">
      <section><h3 class="secao">Comparsas</h3><div class="grade">${comps}</div></section>
      <section><h3 class="secao">Causos</h3><div class="grade">${causos}</div></section>
      <section><h3 class="secao">Simpatias</h3><div class="grade">${simps}</div></section>
      <section><h3 class="secao">Melhorias e selos de carta</h3><div class="grade">${melhorias}</div></section>
      <section><h3 class="secao">Mesas do Bar</h3><div class="grade">${grupo('bar')}</div></section>
      <section><h3 class="secao">Mesas do Fundo</h3><div class="grade">${grupo('fundo')}</div></section>
      <section><h3 class="secao">Chefões</h3><div class="grade">${grupo('chefao')}</div></section>
      <section class="lousa"><h2 style="margin-bottom:8px">Jogadas</h2>${tabelaJogadas(null)}</section>
    </div>`;
}

function tabelaJogadas(niveis) {
  const linhas = app.dados.jogadasLista.map((j) => {
    const v = valoresJogada(app.dados, niveis, j.id);
    const extra = j.id === 'cangada' ? `+${v.multProxima} Mult na próxima` : `${v.fichas} × ${v.mult}`;
    return `<tr><td>${esc(j.nome)}</td><td class="n">${niveis?.[j.id] ?? 1}</td><td class="n">${extra}</td><td style="font-size:0.82rem;color:var(--giz-fraco)">${esc(j.descricao)}</td></tr>`;
  }).join('');
  return `<div class="rolagem"><table class="tabela"><thead><tr><th>Jogada</th><th>Nível</th><th>Fichas × Mult</th><th>Quando</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}

// ---------- bazar ----------

function previewItem(item) {
  if (item.categoria === 'verso') return `<div class="${item.classe} preview">${versoHTML({ mini: false })}</div>`;
  if (item.categoria === 'frente') return `<div class="${item.classe} preview">${cartaHTML({ id: 'p1', rank: 'A', suit: 'espadas' }, { estatica: true })}${cartaHTML({ id: 'p2', rank: '7', suit: 'copas' }, { estatica: true })}</div>`;
  if (item.categoria === 'toalha') return `<div class="${item.classe} preview"><div class="toalha amostra"></div></div>`;
  if (item.categoria === 'raio') return `<div class="${item.classe} preview raio-preview"><svg viewBox="0 0 200 110" aria-hidden="true"><polyline class="raio brilho" points="10,20 60,45 45,58 110,70 95,82 190,95"/><polyline class="raio nucleo" points="10,20 60,45 45,58 110,70 95,82 190,95"/></svg></div>`;
  if (item.categoria === 'personagem') {
    const jg = app.dados.jogadoresPorId[item.jogador];
    return `<div class="preview personagem-preview"><span class="avatar-grande" aria-hidden="true">${esc(jg.avatar)}</span><p><b>⚡ ${esc(jg.poder.nome)}</b><br>${esc(jg.poder.descricao)}</p></div>`;
  }
  if (item.categoria === 'forma') return `<div class="preview raio-preview" data-forma="${esc(item.classe)}"><svg viewBox="0 0 200 110" aria-hidden="true">${formaPreview(item.classe)}</svg></div>`;
  if (item.categoria === 'efeito') return `<div class="${item.classe} preview efeito-preview"><div class="palco-carta">${cartaHTML({ id: 'p3', rank: '3', suit: 'paus' }, { estatica: true })}</div></div>`;
  if (item.categoria === 'cenario') return item.imagem ? `<div class="preview cenario-preview" style="background-image:url('${urlCenario(item.imagem)}')"></div>` : '<div class="preview"><p class="citacao">Só o xadrez do boteco</p></div>';
  if (item.categoria === 'musica') return `<div class="preview"><span class="nota-musical" aria-hidden="true">♪♫</span><p class="citacao">${esc(item.nome)}</p></div>`;
  if (item.categoria === 'avatar') return `<div class="preview"><span class="avatar-grande" aria-hidden="true">${esc(item.avatar)}</span></div>`;
  if (item.categoria === 'titulo') return `<div class="preview"><span class="faixa-titulo">${esc(item.nome)}</span></div>`;
  if (item.categoria === 'falaTruco') return `<div class="preview"><span class="carimbo-mini">${esc(item.carimbo)}</span><p class="citacao">“${esc(item.falas.pedir[0])}”</p></div>`;
  return `<div class="preview"><p class="citacao">${item.falas.map((f) => `“${esc(f)}”`).join('<br>')}</p></div>`;
}

// Desenho fixo de cada forma de raio para a prévia do Bazar
function formaPreview(classe) {
  const linha = (pts, extra = '') => `<polyline class="raio brilho ${extra}" points="${pts}"/><polyline class="raio nucleo ${extra}" points="${pts}"/>`;
  if (classe === 'forma-galho') return linha('10,20 60,45 45,58 110,70 95,82 190,95') + linha('60,45 80,20 95,25', 'fino') + linha('110,70 130,40 150,45', 'fino') + linha('45,58 30,90', 'fino');
  if (classe === 'forma-duplo') return linha('10,15 60,40 45,55 110,62 95,80 190,95') + linha('10,35 55,60 70,48 120,85 140,75 190,95');
  if (classe === 'forma-corrente') {
    const pts = Array.from({ length: 41 }, (_, i) => { const x = 10 + i * 4.5; const y = 20 + i * 1.9 + Math.sin(i / 40 * Math.PI * 4) * 16 * Math.sin(i / 40 * Math.PI); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
    return linha(pts);
  }
  return linha('10,20 60,45 45,58 110,70 95,82 190,95');
}

function telaBazar() {
  const d = app.dados;
  const p = app.perfil;
  const cat = d.bazar.categorias.find((c) => c.id === app.bazarCat) ?? d.bazar.categorias[0];
  const abas = d.bazar.categorias.map((c) => `<button class="btn peq ${c.id === cat.id ? 'amarelo' : 'fantasma'} acao" data-acao="bazarCat" data-arg="${c.id}" aria-pressed="${c.id === cat.id}">${esc(c.nome)}</button>`).join('');
  const itens = d.bazar.itens.filter((i) => i.categoria === cat.id).map((item) => {
    const tem = p.compras.includes(item.id);
    const usando = p.equipado[item.categoria] === item.id;
    let botao;
    if (usando) botao = '<span class="equipado">Usando</span>';
    else if (tem) botao = `<button class="btn peq acao" data-acao="equiparBazar" data-arg="${item.id}">Usar</button>`;
    else botao = `<button class="btn amarelo peq acao" data-acao="comprarBazar" data-arg="${item.id}" ${p.tampinhas < item.preco ? 'disabled' : ''}>Comprar</button>`;
    const ouvir = item.falas || item.musica ? `<button class="btn fantasma-escuro peq acao" data-acao="ouvir" data-arg="${item.id}">Ouvir</button>` : '';
    return `<div class="ficha item-bazar ${usando ? 'escolhida' : ''}">
      ${previewItem(item)}
      <h3>${esc(item.nome)}</h3>
      <div class="rodape"><span class="preco">${item.preco ? `<i class="tampa" aria-hidden="true"></i>${item.preco}` : 'Grátis'}</span><span class="botoes">${ouvir}${botao}</span></div>
    </div>`;
  }).join('');
  return `<div class="topo">
      <div><div class="rotulo">Gaste as Tampinhas dos Chefões</div><h2>Bazar das Tampinhas</h2></div>
      <div class="tampinhas grande"><i class="tampa" aria-hidden="true"></i>${p.tampinhas}</div>
      <button class="btn fantasma acao" data-acao="irMenu">Voltar</button>
    </div>
    <p class="explica">${esc(d.bazar.moeda.descricao)} O mapa mostra quanto cada Chefão deixa cair (mais 1 por bairro); vencer o Rei do Truco dá +${d.bazar.recompensas.vitoriaRun}.</p>
    <div class="botoes abas">${abas}</div>
    <p class="rotulo" style="margin:10px 0">${esc(cat.descricao)}</p>
    <div class="grade">${itens}</div>`;
}

function telaAdmin() {
  const a = app.admin;
  const carregando = '<p class="rotulo">Carregando...</p>';
  const novos = a.novos?.length ? `<div class="placa novos-convites">
      <h3>Convites novos</h3>
      <p>Mande o link para cada pessoa. Cada convite serve para criar 1 conta.</p>
      <ul class="lista-convites">${a.novos.map((c) => `<li><code>${esc(c)}</code><button class="btn peq acao" data-acao="copiar" data-arg="${esc(linkConvite(c))}">Copiar link</button></li>`).join('')}</ul>
      <button class="btn amarelo peq acao" data-acao="copiar" data-arg="${esc(a.novos.map(linkConvite).join('\n'))}">Copiar todos os links</button>
    </div>` : '';
  const convites = !a.convites ? carregando : !a.convites.length ? '<p class="rotulo">Nenhum convite ainda.</p>' : `<div class="rolagem"><table class="tabela">
      <thead><tr><th>Código</th><th>Situação</th><th>Observação</th><th></th></tr></thead>
      <tbody>${a.convites.map((c) => `<tr>
        <td><code>${esc(c.codigo)}</code></td>
        <td>${c.usadoPor ? `Usado por <b>${esc(c.usadoPor)}</b>` : '<span class="livre">Livre</span>'}</td>
        <td>${esc(c.observacao ?? '')}</td>
        <td class="botoes">${c.usadoPor ? '' : `<button class="btn peq acao" data-acao="copiar" data-arg="${esc(linkConvite(c.codigo))}">Copiar link</button><button class="btn peq fantasma acao" data-acao="apagarConvite" data-arg="${esc(c.codigo)}">Apagar</button>`}</td>
      </tr>`).join('')}</tbody></table></div>`;
  const jogadores = !a.jogadores ? carregando : `<div class="rolagem"><table class="tabela tabela-jogadores">
      <thead><tr><th>Jogador</th><th>Tampinhas</th><th>Réis (run atual)</th><th>Último jogo</th><th></th></tr></thead>
      <tbody>${a.jogadores.map((j) => `<tr data-jogador="${esc(j.nome)}">
        <td><b>${esc(j.nome)}</b>${j.admin ? ' <span class="selo-admin">admin</span>' : ''}</td>
        <td><input class="num-adm" type="number" min="0" step="1" inputmode="numeric" data-campo="tampinhas" value="${j.tampinhas}" aria-label="Tampinhas de ${esc(j.nome)}"></td>
        <td>${j.reis == null ? '<span class="rotulo">sem run</span>' : `<input class="num-adm" type="number" min="0" step="1" inputmode="numeric" data-campo="reis" value="${j.reis}" aria-label="Réis de ${esc(j.nome)}">`}</td>
        <td class="rotulo">${j.atualizadoEm ? new Date(j.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
        <td><button class="btn amarelo peq acao" data-acao="salvarJogador" data-arg="${esc(j.nome)}">Salvar</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  const livres = a.convites?.filter((c) => !c.usadoPor).length ?? 0;
  return `<div class="topo">
      <div><div class="rotulo">Só você vê esta tela</div><h2>Painel do admin</h2></div>
      <button class="btn fantasma acao" data-acao="irMenu">Voltar</button>
    </div>
    <div class="painel-admin">
      <section class="lousa">
        <h2>Convites</h2>
        <p class="rotulo">Quem não tem convite não consegue criar conta. Escolha quantos criar (até 100 de uma vez).${a.convites ? ` Livres agora: ${livres}.` : ''}</p>
        <div class="campo-admin">
          <label for="adm-qtd">Quantidade</label>
          <input id="adm-qtd" type="number" min="1" max="100" step="1" value="5" inputmode="numeric">
          <label for="adm-obs">Observação (opcional)</label>
          <input id="adm-obs" maxlength="60" placeholder="ex.: turma do trabalho">
          <button class="btn amarelo acao" data-acao="criarConvites">Criar convites</button>
        </div>
        ${novos}
        ${convites}
      </section>
      <section class="lousa">
        <h2>Jogadores</h2>
        <p class="rotulo">Mude as Tampinhas (ficam entre as runs) ou os réis da run em andamento e toque em Salvar. Se a pessoa estiver jogando, o valor muda no próximo salvamento dela.</p>
        ${jogadores}
      </section>
    </div>`;
}

function telaJogo() {
  const r = app.jogo.run;
  if (r.fase === 'mapa') return telaMapa();
  if (r.fase === 'boteco') return telaBoteco();
  if ((r.fase === 'derrota' || r.fase === 'vitoria') && (app.resumo || !r.mesa)) return telaFim();
  return telaMesa();
}

// ---------- mapa ----------

function bairrosHTML(r) {
  const total = app.dados.regras.bairros;
  let html = '';
  for (let b = 1; b <= Math.max(total, r.bairro); b++) html += `<span class="${b < r.bairro ? 'feito' : b === r.bairro ? 'agora' : ''}" title="Bairro ${b}">${b}</span>`;
  return `<div class="bairros" aria-label="Bairro ${r.bairro} de ${total}">${html}</div>`;
}

function telaMapa() {
  const j = app.jogo;
  const r = j.run;
  const E = app.dados.regras.economia;
  const cards = TIPOS_MESA.map((tipo, idx) => {
    const info = j.infoMesa(r.bairro, idx);
    const p = info.pessoa;
    const estado = idx < r.mesaIdx ? 'feita' : idx === r.mesaIdx ? 'agora' : 'futura';
    const rotulo = { feita: 'Concluída', agora: 'Próxima', futura: 'Depois' }[estado];
    const atual = estado === 'agora';
    const extra = info.regras.recompensaExtra ? ` + ${info.regras.recompensaExtra} da manha` : '';
    const tampas = j.tampinhasDaMesa(r.bairro === app.dados.regras.bairros && !r.infinito, info.chefao, r.bairro);
    return `<div class="ficha mesa-card ${estado} ${info.chefao ? 'chefe' : ''}">
      ${infoBtn('pessoa', p.id, p.nome)}
      <span class="estado">${rotulo} · ${NOME_MESA[tipo]}</span>
      <div class="pessoa-cab">${avatarHTML(p, true)}<div><h3>${esc(p.nome)}</h3><small>${esc(p.titulo)}</small></div></div>
      <div><span class="meta">${fmt(info.meta)}</span> <span>pontos de meta</span></div>
      <p class="manha ${info.chefao ? 'chefe' : ''}"><b>${info.chefao ? 'Regra do Chefão' : 'Manha'}:</b> ${esc(p.regra)}</p>
      <p>Recompensa: ${E.recompensaMesa[tipo]} réis + 1 por mão que sobrar${extra}</p>
      ${info.chefao ? `<p class="drop"><i class="tampa" aria-hidden="true"></i>Deixa cair <b>${tampas} Tampinhas</b></p>` : ''}
      ${atual && r.avisos?.length ? `<ul class="avisos-mesa">${r.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      ${atual ? `<div class="botoes" style="margin-top:auto">
        <button class="btn truco acao" data-acao="sentar" ${j.evento ? 'disabled title="Resolva o evento primeiro"' : ''}>Sentar com ${esc(p.nome)}</button>
        ${r.promessa ? `<button class="btn acao" data-acao="pularMesa" title="Pular esta Mesa">Pular: ${esc(r.promessa.descricao)}</button>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
  return `<div class="topo">
      <div><div class="rotulo">Bairro ${r.bairro} · seed ${esc(r.seed)}</div><h2>${esc(j.nomeBairro())}</h2></div>
      ${bairrosHTML(r)}
      <div class="num" style="color:var(--lampada);font-size:1.4rem">${r.reis} réis</div>
    </div>
    ${r.desafio ? `<p class="faixa-desafio">Desafio do dia ${esc(r.desafio)}${app.perfil.desafios[r.desafio] ? ' · treino (só a 1ª tentativa vale)' : ' · valendo para o ranking'}</p>` : ''}
    ${r.divida ? `<p class="faixa-divida">📒 Você deve ${r.divida} réis ao dono do bar. Ele cobra no fim da próxima Mesa.</p>` : ''}
    ${eventoHTML(j)}
    <div class="mesas">${cards}</div>
    ${painelColecaoRun(j, false)}
    <div class="botoes" style="margin-top:18px"><button class="btn fantasma peq acao" data-acao="modal" data-arg="sair">Sair da run</button></div>`;
}

function eventoHTML(j) {
  const ev = j.evento;
  if (!ev) return '';
  const r = j.run;
  const ops = ev.opcoes.map((op, i) => {
    const custo = j.custoOpcao(op);
    return `<button class="btn ${i === 0 ? 'amarelo' : 'fantasma'} acao" data-acao="evento" data-arg="${i}" ${custo > r.reis ? 'disabled' : ''}>
      <span>${esc(op.rotulo)}</span><small>${esc(op.resumo)}</small></button>`;
  }).join('');
  return `<section class="evento ${ev.especial ? 'especial' : ''}" aria-label="Evento do bairro">
    <div class="evento-icone" aria-hidden="true">${ev.icone}</div>
    <div class="evento-corpo">
      <span class="rotulo">${ev.especial ? 'Mesa especial' : 'Evento do bairro'}</span>
      <h3>${esc(ev.nome)}</h3>
      <p>${esc(ev.texto)}</p>
      <div class="evento-opcoes">${ops}</div>
    </div>
  </section>`;
}

// Roleta da Rodada da Sorte: gira e para na fatia sorteada
function girarRoleta(fatias, indice) {
  return new Promise((fim) => {
    const n = fatias.length;
    const cores = ['#b3261e', '#2b5a7a', '#d9a536', '#2f6b3a', '#5c4a8a', '#8a5a2b', '#1f7a7a'];
    const grad = fatias.map((f, i) => `${cores[i % cores.length]} ${(i / n) * 360}deg ${((i + 1) / n) * 360}deg`).join(', ');
    const rotulos = fatias.map((f, i) => `<span style="--a:${((i + 0.5) / n) * 360}deg">${esc(f.texto.replace(/[!.]+$/, ''))}</span>`).join('');
    const el = document.createElement('div');
    el.className = 'roleta-palco';
    el.innerHTML = `<div class="roleta-seta" aria-hidden="true">▼</div><div class="roleta" style="background:conic-gradient(${grad})">${rotulos}</div><p class="roleta-texto" aria-live="polite"></p>`;
    document.body.appendChild(el);
    const roda = el.querySelector('.roleta');
    const alvo = 360 * 6 + (360 - ((indice + 0.5) / n) * 360);
    audio.tocar('embaralhar');
    requestAnimationFrame(() => { roda.style.transform = `rotate(${alvo}deg)`; });
    const tique = setInterval(() => audio.tocar('clique'), 160);
    setTimeout(() => {
      clearInterval(tique);
      el.querySelector('.roleta-texto').textContent = fatias[indice].texto;
      el.classList.add(fatias[indice].bom ? 'bom' : 'ruim');
      audio.tocar(fatias[indice].bom ? 'vitoria' : 'derrota');
      setTimeout(() => { el.remove(); fim(); }, 1600);
    }, reduzido ? 100 : 4200);
  });
}

function painelColecaoRun(j, loja) {
  return `<div class="faixa" style="margin-top:18px">
    ${slotsComparsas(j, loja)}
    ${slotsConsumiveis(j)}
  </div>
  <div class="botoes" style="margin-top:12px">
    <button class="btn fantasma peq acao" data-acao="modal" data-arg="baralho">Baralho (${j.run.deck.length})</button>
    <button class="btn fantasma peq acao" data-acao="modal" data-arg="jogadas">Jogadas</button>
  </div>`;
}

function slotsComparsas(j, loja = false, compacto = false) {
  const r = j.run;
  const html = r.comparsas.map((inst, i) => {
    const def = app.dados.comparsasPorId[inst.id];
    const extras = loja ? `<div class="acoes-slot">
      <button class="btn peq acao" data-acao="mover" data-arg="${inst.uid}:-1" ${i === 0 ? 'disabled' : ''} aria-label="Mover para a esquerda">◀</button>
      <button class="btn peq acao" data-acao="mover" data-arg="${inst.uid}:1" ${i === r.comparsas.length - 1 ? 'disabled' : ''} aria-label="Mover para a direita">▶</button>
      <button class="btn peq acao" data-acao="vender" data-arg="${inst.uid}">Vender ${j.precoVenda(inst.uid)}</button></div>` : '';
    return slotComparsa(def, inst, extras);
  });
  if (!compacto) for (let i = r.comparsas.length; i < r.slotsComparsa; i++) html.push('<div class="slot vazio">Comparsa</div>');
  return `<div class="slots ${compacto ? 'compacto' : ''}" aria-label="Comparsas (${r.comparsas.length} de ${r.slotsComparsa})">${html.join('')}</div>`;
}

function slotsConsumiveis(j, compacto = false) {
  const r = j.run;
  const html = r.consumiveis.map((item, i) => {
    const def = defConsumivel(app.dados, item);
    const podeUsar = item.tipo === 'simpatia' || j.podeUsarCausoAgora();
    return `<div class="slot consumivel ${item.tipo}">
      ${infoBtn(item.tipo, item.id, def.nome)}
      <span class="raridade" style="background:${item.tipo === 'causo' ? '#8a5a2b' : '#5c4a8a'}">${item.tipo === 'causo' ? 'Causo' : 'Simpatia'}</span>
      <b>${esc(def.nome)}</b><span>${esc(def.descricao)}</span>
      <div class="acoes-slot">
        <button class="btn peq acao" data-acao="usar" data-arg="${i}" ${podeUsar ? '' : 'disabled'} title="${item.tipo === 'causo' ? 'Selecione as cartas da mão e use antes da 1ª rodada' : ''}">Usar</button>
        <button class="btn peq fantasma acao" data-acao="descartarConsumivel" data-arg="${i}" style="color:var(--tinta);box-shadow:inset 0 0 0 2px rgba(0,0,0,.2)" aria-label="Descartar">✕</button>
      </div></div>`;
  });
  if (!compacto) for (let i = r.consumiveis.length; i < r.slotsConsumivel; i++) html.push('<div class="slot vazio">Causo ou Simpatia</div>');
  return `<div class="slots cons ${compacto ? 'compacto' : ''}" aria-label="Causos e Simpatias">${html.join('')}</div>`;
}

// ---------- mesa ----------

function contaHTML() {
  const c = app.conta;
  return `<div class="conta" id="conta" aria-live="polite">
    <div class="jogada">${esc(c?.jogada ?? 'Fichas × Mult')}</div>
    <div class="fxm"><div class="caixa f">${c?.fichas != null ? fmt(c.fichas) : '—'}</div><span class="num">×</span><div class="caixa m">${c?.mult != null ? c.mult : '—'}</div></div>
    <div class="origem">${esc(c?.origem ?? 'Vença rodadas para pontuar')}</div>
    <div class="total">${c?.total != null ? fmt(c.total) : ''}</div>
  </div>`;
}

function lousaMesa(j) {
  const r = j.run;
  const m = r.mesa;
  const p = j.pessoa;
  const perc = Math.min(100, (m.pontos / m.meta) * 100);
  return `<aside class="lousa" aria-label="Placar">
    <div class="rotulo">Bairro ${r.bairro} · ${esc(j.nomeBairro())}</div>
    <h2 class="titulo-mesa">${NOME_MESA[m.tipo]}</h2>
    <div class="regra-chefao ${j.chefao ? '' : 'manha-giz'}">${infoBtn('pessoa', p.id, p.nome)}<b>${j.chefao ? 'Regra do Chefão' : 'Manha'}:</b> ${esc(p.regra)}</div>
    <div class="linha-giz" style="display:block">
      <div class="meta-linha"><span class="rotulo">Pontos / Meta</span><span class="num">${fmt(m.pontos)} / ${fmt(m.meta)}</span></div>
      <div class="barra" role="progressbar" aria-valuenow="${Math.round(perc)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${perc}%"></i></div>
    </div>
    ${tentosHTML(j)}
    ${poderHTML(j)}
    <div class="stats">
      <div class="linha-giz"><span class="rotulo">Mãos</span><span class="num">${m.maosRestantes}</span></div>
      <div class="linha-giz"><span class="rotulo">Trocas</span><span class="num">${m.trocasRestantes}</span></div>
      <div class="linha-giz"><span class="rotulo">Réis</span><span class="num" style="color:var(--lampada)">${r.reis}</span></div>
    </div>
    ${contaHTML()}
    ${podeTestar() ? `<button class="btn fantasma peq acao btn-teste" data-acao="modal" data-arg="testes">🛠️ Testes (admin)${r.testada ? ' · usado' : ''}</button>` : ''}
    <div class="botoes botoes-lousa" style="margin-top:12px">
      <button class="btn fantasma peq acao" data-acao="modal" data-arg="baralho">Baralho (${r.deck.length})</button>
      <button class="btn fantasma peq acao" data-acao="modal" data-arg="jogadas">Jogadas</button>
    </div>
  </aside>`;
}

// Segundo relógio: tentos do adversário até 12
function tentosHTML(j) {
  const m = j.run.mesa;
  const max = j.tentosParaPerder;
  const perc = Math.min(100, (m.tentosAdv / max) * 100);
  const perigo = m.tentosAdv >= max - 3;
  return `<div class="linha-giz tentos ${perigo ? 'perigo' : ''}" style="display:block" title="Se o adversário chegar a ${max} tentos, você perde a Mesa">
    <div class="meta-linha"><span class="rotulo">Tentos dele</span><span class="num">${m.tentosAdv} / ${max}</span></div>
    <div class="barra tentos-barra" role="progressbar" aria-valuenow="${m.tentosAdv}" aria-valuemin="0" aria-valuemax="${max}"><i style="width:${perc}%"></i></div>
  </div>`;
}

function poderHTML(j) {
  const jg = j.jogador;
  const p = jg.poder;
  const m = j.run.mesa;
  const gratis = Math.max(0, p.gratis - m.poderUsos);
  const custo = gratis ? `${gratis} grátis` : p.custo ? (p.custo.reis ? `custa ${p.custo.reis} réis` : `custa ${p.custo.tentos} tento`) : 'acabou';
  const motivo = j.motivoSemPoder([...app.sel]);
  return `<div class="poder">
    <span class="avatar" aria-hidden="true">${esc(jg.avatar)}</span>
    <div><b>${esc(jg.nome)}</b> ${infoBtn('poder', jg.id, p.nome)}<br><small>${esc(p.descricao)}</small></div>
    <button class="btn amarelo peq acao" data-acao="poder" ${motivo ? `disabled title="${esc(motivo)}"` : ''}>⚡ ${esc(p.nome)} <small>(${custo})</small></button>
    ${motivo && p.id === 'embaralhada' && app.sel.length !== 1 ? '<small class="rotulo poder-dica" style="grid-column:1/-1;flex:1 1 100%">Na sua vez, selecione 1 carta e toque no poder.</small>' : ''}
  </div>`;
}

function viraVisivel(j) {
  const rd = j.rodada;
  if (!rd.vira) return false;
  const ate = j.regrasMesa.viraEscondidaAte;
  if (ate == null) return true;
  return (rd.mao?.vazas.length ?? 0) >= ate;
}

// Nomes dos lugares na dupla: 0 você, 1 e 3 adversários, 2 parceiro
function nomeLugar(j, nomes) {
  return j === 0 ? 'Você' : nomes?.[j] ?? (j === 2 ? 'Parceiro' : 'Adversário');
}

function vazasHTML(rd, ctx, nomeAdv, nomes = null) {
  const st = rd.mao;
  const n = rd.numVazas;
  const slots = [];
  for (let i = 0; i < n; i++) {
    const v = st?.vazas[i];
    if (v) {
      const res = v.vencedor === 0 ? '<span class="res v">Sua</span>' : v.vencedor === 1 ? '<span class="res p">Dele</span>' : '<span class="res e">Cangou</span>';
      const pts = rd.vazasPontuadas.find((x) => x.indice === i);
      const ordem = v.cartas.length > 2 ? [1, 3, 2, 0] : [1, 0];
      slots.push(`<div class="vaza ${v.cartas.length > 2 ? 'quatro' : ''}">
        <div class="par">${ordem.map((k) => cartaHTML(v.cartas[k], { ctx, mini: true, estatica: true, perdeu: v.vencedor !== 'empate' && k % 2 !== v.vencedor })).join('')}</div>
        ${res}${pts ? `<span class="pts">${fmt(pts.total)}</span>` : ''}
      </div>`);
    } else if (st && !st.fim && i === st.vazas.length) {
      const quatro = st.maos.length > 2;
      const ordem = quatro ? [1, 3, 2, 0] : [1, 0];
      const vazio = '<div class="carta mini verso" style="opacity:.15"></div>';
      const quem = st.pedido ? 'Truco na mesa' : st.vez === 0 ? 'Sua vez' : `Vez de ${quatro ? nomeLugar(st.vez, nomes) : nomeAdv}`;
      slots.push(`<div class="vaza atual ${quatro ? 'quatro' : ''}">
        <div class="par">${ordem.map((k) => { const x = st.mesa.find((m) => m.jogador === k); return x ? cartaHTML(x.carta, { ctx, mini: true, estatica: true, entra: true }) : vazio; }).join('')}</div>
        <span class="quem-joga">${quem}</span></div>`);
    } else {
      slots.push(`<div class="vaza"><span class="quem-joga" style="margin:auto">${i + 1}ª rodada</span></div>`);
    }
  }
  return `<div class="vazas" style="--n:${n}">${slots.join('')}</div>`;
}

// Os outros três da mesa em dupla, com cartas na mão e o sinal que você viu
function lugaresDupla({ st, nomes, avatares, sinais, vistos, maos }) {
  const vez = st && !st.fim ? (st.pedido ? null : st.vez) : null;
  const lugar = (k) => {
    const n = (st ? st.maos[k] : maos[k])?.length ?? 0;
    const sinal = sinais?.[k] && (k === 2 || vistos?.includes(k)) ? SINAIS[sinais[k]] : null;
    const papel = k === 2 ? 'Seu parceiro' : 'Adversário';
    return `<div class="lugar ${k === 2 ? 'parceiro' : 'contra'} ${vez === k ? 'vez' : ''}">
      <span class="avatar" aria-hidden="true">${esc(avatares[k])}</span>
      <div><span class="rotulo">${papel}</span><b>${esc(nomes[k])}</b></div>
      <div class="cartas-lugar">${Array.from({ length: n }, () => versoHTML({ mini: true })).join('')}</div>
      ${sinal ? `<div class="sinal ${k === 2 ? '' : 'pego'}" title="${esc(sinal.nome)}">${sinal.emoji} <span>${k === 2 ? '' : 'Você pegou: '}${esc(sinal.gesto)} (${esc(sinal.nome)})</span></div>` : ''}
    </div>`;
  };
  return `<div class="lugares">${lugar(1)}${lugar(2)}${lugar(3)}</div>`;
}

function botoesSinal(meu) {
  return `<div class="sinais-meus"><span class="rotulo">Seu sinal pro parceiro:</span>${Object.entries(SINAIS).map(([k, s]) => `<button class="btn peq ${meu === k ? 'amarelo' : 'fantasma'} acao" data-acao="sinalizar" data-arg="${k}" title="${esc(s.gesto)}: ${esc(s.nome)}">${s.emoji} ${esc(s.nome)}</button>`).join('')}</div>`;
}

function acoesMesa(j) {
  const rd = j.rodada;
  const m = j.run.mesa;
  const st = rd.mao;
  const botoes = [];
  let dica = '';
  const n = app.sel.length;
  const benz = j.regra('benzedeira') && m.benzedeiraUsos > 0 && !rd.revelada && rd.fase !== 'fim';
  const nome = j.pessoa.nome;

  if (rd.fase === 'vira') {
    dica = 'Vira-Lata: escolha qual vira vale nesta mão.';
  } else if (rd.fase === 'troca') {
    dica = rd.onze ? 'Mão de onze: vale 3, sem truco.' : rd.iniciante === 0 ? 'Você abre. Toque 2 vezes numa carta para jogar, ou marque até 3 e troque.' : `${nome} abre. Quer trocar cartas antes?`;
    if (m.trocasRestantes > 0) botoes.push(`<button class="btn acao" data-acao="trocar" ${n ? '' : 'disabled'}>Trocar ${n || ''} (${m.trocasRestantes})</button>`);
    if (rd.iniciante === 0) botoes.push(`<button class="btn amarelo acao" data-acao="jogar" ${n === 1 ? '' : 'disabled'}>Jogar carta</button>`);
    else botoes.push('<button class="btn amarelo acao" data-acao="abrir">Pronto, pode abrir</button>');
    if (j.podePedirTruco()) botoes.push(`<button class="btn truco acao" data-acao="truco">${NOME_VALOR[proximoValor(rd.mao?.valor ?? valorInicial(j))] ?? NOME_VALOR[3]}</button>`);
  } else if (rd.fase === 'jogo') {
    if (st.pedido && st.pedido.por === 1) {
      const prox = proximoValor(st.pedido.valor, st.valores);
      const quemPediu = st.jogadores === 4 ? nomeLugar(st.pedido.jogador, nomesDupla(j)) : nome;
      dica = `${quemPediu} pediu ${st.pedido.valor}. Aceitar, aumentar ou correr?`;
      botoes.push(`<button class="btn amarelo acao" data-acao="responder" data-arg="aceitar">Aceitar (${st.pedido.valor})</button>`);
      if (prox) botoes.push(`<button class="btn truco acao" data-acao="responder" data-arg="aumentar">${NOME_VALOR[prox]}</button>`);
      botoes.push(`<button class="btn fantasma acao" data-acao="responder" data-arg="correr">Correr</button>`);
    } else if (st.pedido) {
      dica = 'Esperando a resposta...';
    } else if (st.vez === 0) {
      dica = 'Sua vez: toque numa carta e toque de novo para jogar.';
      botoes.push(`<button class="btn amarelo acao" data-acao="jogar" ${n === 1 ? '' : 'disabled'}>Jogar carta</button>`);
      if (j.podePedirTruco()) botoes.push(`<button class="btn truco acao" data-acao="truco">${NOME_VALOR[proximoValor(st.valor, st.valores)]}</button>`);
    } else {
      dica = `${st.jogadores === 4 ? nomeLugar(st.pedido ? null : st.vez, nomesDupla(j)) : nome} está pensando`;
    }
  }
  if (benz) botoes.push('<button class="btn fantasma acao" data-acao="benzer">Benzer (revelar cartas)</button>');
  return { botoes: botoes.join(''), dica };
}

function nomesDupla(j) {
  const m = j.run.mesa;
  const P = app.dados.personagensPorId;
  return { 1: j.pessoa.nome, 2: P[m.parceiroId]?.nome, 3: P[m.adv2Id]?.nome };
}

function minhaVez(j) {
  const rd = j.rodada;
  if (!rd || app.animando) return false;
  if (rd.fase === 'troca') return true;
  const st = rd.mao;
  return rd.fase === 'jogo' && !st.fim && (st.pedido ? st.pedido.por === 1 : st.vez === 0);
}

// Bolinhas das 3 rodadas: verde (sua), vermelha (dele), cinza (cangou), vazia (falta jogar)
function placarRodadas(rd) {
  const vazas = rd.mao?.vazas ?? [];
  const bolas = Array.from({ length: rd.numVazas }, (_, i) => {
    const v = vazas[i]?.vencedor;
    const [classe, rotulo] = v === 0 ? ['v', 'sua'] : v === 1 ? ['p', 'dele'] : v === 'empate' ? ['e', 'cangou'] : ['', 'a jogar'];
    return `<i class="bola ${classe}" title="${i + 1}ª rodada: ${rotulo}"></i>`;
  }).join('');
  return `<span class="bolas" aria-label="Rodadas">${bolas}</span>`;
}

function valorInicial(j) {
  const rd = j.rodada;
  if (rd.onze) return app.dados.regras.mesa.valorMaoDeOnze;
  if (j.regrasMesa.valorInicial) return j.regrasMesa.valorInicial;
  if (j.run.mesa.maoIdx === 0 && j.regra('valorInicialPrimeiraMao')) return j.regra('valorInicialPrimeiraMao').valor;
  return 1;
}

function overlayMesa(j) {
  if (app.animando) return '';
  const r = j.run;
  const rd = j.rodada;
  const pessoa = j.pessoa;
  if (r.fase === 'recompensa') {
    const rm = r.resultadoMesa;
    return `<div class="sobreposto" role="dialog" aria-modal="true" aria-label="Mesa vencida"><div class="lousa resultado">
      <h2>Mesa vencida!</h2>
      ${rm.fala ? `<div class="pessoa-cab giz">${avatarHTML(pessoa)}<div class="fala">${esc(rm.fala)}</div></div>` : ''}
      <div class="grande">${fmt(rm.pontos)}</div><div class="rotulo" style="text-align:center">de ${fmt(rm.meta)} de meta</div>
      <div class="linha-giz"><span>Recompensa da Mesa</span><span class="num">+${rm.base}</span></div>
      <div class="linha-giz"><span>Mãos que sobraram</span><span class="num">+${rm.porMao}</span></div>
      <div class="linha-giz"><span>Juros</span><span class="num">+${rm.juros}</span></div>
      ${rm.extra ? `<div class="linha-giz"><span>Manha e eventos</span><span class="num">+${rm.extra}</span></div>` : ''}
      ${rm.fiado ? `<div class="linha-giz"><span>📒 Fiado pago ao dono do bar</span><span class="num">−${rm.fiado.pago}</span></div>${rm.fiado.comparsa ? `<div class="regra-chefao">Faltou dinheiro: o dono do bar levou ${esc(app.dados.comparsasPorId[rm.fiado.comparsa].nome)}.</div>` : ''}` : ''}
      <div class="linha-giz"><span>Réis agora</span><span class="num" style="color:var(--lampada)">${r.reis}</span></div>
      ${rm.tampinhas ? `<div class="drop-grande"><i class="tampa" aria-hidden="true"></i>+${rm.tampinhas} Tampinhas<small>${esc(pessoa.nome)} deixou cair. Gaste no Bazar (menu).</small></div>` : ''}
      <div class="botoes"><button class="btn amarelo acao" data-acao="irBoteco">Ir ao Boteco</button></div>
    </div></div>`;
  }
  if (r.fase === 'derrota' || r.fase === 'vitoria') {
    const venceu = r.fase === 'vitoria';
    const rm = r.resultadoMesa;
    return `<div class="sobreposto" role="dialog" aria-modal="true"><div class="lousa resultado">
      <h2>${venceu ? 'Você é o novo Rei do Truco!' : 'Fim da linha, parceiro'}</h2>
      <p>${venceu ? 'Ninguém em São Paulo segura esse baralho.' : rm?.motivo === 'tentos' ? `${esc(pessoa.nome)} chegou a ${j.tentosParaPerder} tentos antes de você bater a meta.` : `${esc(pessoa.nome)} venceu. Faltaram ${fmt(r.mesa.meta - r.mesa.pontos)} pontos para a meta.`}</p>
      ${venceu && rm?.tampinhas ? `<div class="drop-grande"><i class="tampa" aria-hidden="true"></i>+${rm.tampinhas} Tampinhas</div>` : ''}
      <div class="botoes"><button class="btn amarelo acao" data-acao="verResumo">Ver resumo</button></div>
    </div></div>`;
  }
  if (rd?.fase !== 'fim' || !rd.resultado) return '';
  const res = rd.resultado;
  const titulo = res.venceu ? (rd.maoParceiro ? 'A mão é de vocês!' : 'A mão é sua!') : res.vencedor === null ? 'Ninguém levou' : rd.maoParceiro ? 'A mão foi deles' : `A mão foi de ${pessoa.nome}`;
  const linhas = [];
  const fuga = rd.vazasPontuadas.find((v) => v.fuga);
  if (res.correu === 1) linhas.push(`<p>${esc(pessoa.nome)} correu do truco.${fuga ? ` Sua melhor carta (${esc(fuga.carta.rank)}) pontuou ${fmt(fuga.total)}.` : ''}</p>`);
  if (res.correu === 0) linhas.push('<p>Você correu.</p>');
  for (const p of res.passos) {
    linhas.push(`<div class="linha-giz"><span>${esc(p.origem)}</span><span class="num">${p.tipo === 'x' ? `×${p.valor}` : `+${fmt(p.valor)}`}</span></div>`);
  }
  for (const g of rd.ganhos) linhas.push(`<div class="linha-giz"><span>${esc(g.origem)}</span><span class="num" style="color:var(--lampada)">+${g.valor} réis</span></div>`);
  if (res.penalidade) linhas.push(`<div class="regra-chefao">Blefe pago: seu truco foi aceito e você perdeu. −${res.penalidade} mão extra.</div>`);
  if (res.comparsaPerdida) linhas.push(`<div class="regra-chefao">A Viúva Negra desativou ${esc(app.dados.comparsasPorId[res.comparsaPerdida].nome)} nesta Mesa.</div>`);
  if (rd.quebradas.length) linhas.push('<p>Uma Carta de Vidro quebrou e saiu do baralho.</p>');
  return `<div class="sobreposto" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="lousa resultado">
    <h2>${esc(titulo)}</h2>
    <div class="grande">${res.venceu ? `+${fmt(res.pontos)}` : '0'}</div>
    ${linhas.join('')}
    ${res.tentos ? `<div class="linha-giz tentos perigo"><span>Tentos para ${esc(rd.maoParceiro ? 'eles' : pessoa.nome)}</span><span class="num">+${res.tentos} (${r.mesa.tentosAdv} / ${j.tentosParaPerder})</span></div>` : ''}
    <div class="linha-giz"><span>Pontos na Mesa</span><span class="num">${fmt(r.mesa.pontos)} / ${fmt(r.mesa.meta)}</span></div>
    <div class="botoes"><button class="btn amarelo acao" data-acao="proximaMao" autofocus>Próxima mão</button></div>
  </div></div>`;
}

function telaMesa() {
  const j = app.jogo;
  const r = j.run;
  const m = r.mesa;
  const rd = j.rodada;
  const st = rd.mao;
  const visivel = viraVisivel(j);
  const ctx = visivel ? j.ctxForca() : null;
  const pessoa = j.pessoa;

  const advCartas = st ? st.maos[1] : rd.maoAdv;
  const adv = advCartas.map((c) => (rd.revelada || rd.reveladas?.includes(c.id) ? cartaHTML(c, { ctx, mini: true, estatica: true }) : versoHTML({ mini: true }))).join('');

  let vira;
  if (rd.fase === 'vira') {
    vira = rd.viras.map((v, i) => `<div style="display:grid;gap:6px;justify-items:center">${cartaHTML(v, { mini: true, estatica: true })}<button class="btn peq acao" data-acao="escolherVira" data-arg="${i}">Esta</button></div>`).join('');
  } else {
    vira = visivel ? cartaHTML(rd.vira, { mini: true, estatica: true, dados: app.dados }) : versoHTML({ mini: true });
  }

  const minhas = st ? st.maos[0] : m.mao.map((id) => j.carta(id));
  const mao = minhas.map((c) => cartaHTML(c, { ctx, sel: app.sel.includes(c.id), dados: app.dados })).join('');
  const { botoes, dica } = acoesMesa(j);
  const valor = st ? st.valor : valorInicial(j);
  const suaVez = minhaVez(j);
  const pensando = rd.fase === 'jogo' && !st.fim && (st.pedido ? st.pedido.por === 0 : st.vez === 1);
  const emDupla = !!rd.maoParceiro;
  const P = app.dados.personagensPorId;
  const nomes = emDupla ? nomesDupla(j) : null;
  const dupl = emDupla ? lugaresDupla({
    st, nomes, avatares: { 1: pessoa.avatar, 2: P[m.parceiroId].avatar, 3: P[m.adv2Id].avatar },
    sinais: rd.sinais, vistos: rd.sinaisVistos, maos: { 1: rd.maoAdv, 2: rd.maoParceiro, 3: rd.maoAdv2 },
  }) : '';
  const temItens = r.comparsas.length || r.consumiveis.length;

  return `<div class="mesa-layout">
    ${lousaMesa(j)}
    <div class="mesa-centro">
      ${temItens ? `<div class="faixa compacta">${slotsComparsas(j, false, true)}${slotsConsumiveis(j, true)}</div>` : ''}
      <section class="toalha" aria-label="Mesa">
        <div class="adversario">
          <div class="quem">${avatarHTML(pessoa, true)}${rd.cara ? `<span class="cara" title="Como ${esc(pessoa.nome)} parece estar com a mão (às vezes é blefe)">${rd.cara.emoji}</span>` : ''}<div><span class="rotulo" style="color:var(--papel)">${esc(pessoa.titulo)}</span><h3>${esc(pessoa.nome)}</h3></div></div>
          ${rd.fala ? `<div class="fala">${esc(rd.fala)}</div>` : pensando ? '<div class="fala pensando" aria-label="pensando"><i></i><i></i><i></i></div>' : ''}
          <div class="cartas-adv">${adv}</div>
          <div class="vira-box"><span class="rotulo">Vira</span>${vira}</div>
        </div>
        ${dupl}
        ${vazasHTML(rd, ctx, pessoa.nome, nomes)}
        <div class="valendo">
          <span class="rotulo" style="color:var(--papel)">${emDupla ? 'Mesa Dupla · ' : ''}Mão ${m.maoIdx + 1}${rd.onze ? ' · mão de onze' : ''}</span>
          ${placarRodadas(rd)}
          <span class="rotulo" style="color:var(--papel)">valendo</span><span class="num">${valor}</span>
        </div>
      </section>
      <section class="mao-area ${suaVez ? 'sua-vez' : ''}" aria-label="Sua mão">
        ${suaVez ? '<span class="selo-vez">Sua vez</span>' : ''}
        ${app.falaJogador ? `<div class="fala jogador"><span class="avatar-mini" aria-hidden="true">${esc(meuAvatar())}</span>${esc(app.falaJogador)}</div>` : ''}
        <div class="mao">${mao}</div>
        <div class="dica">${esc(dica)}</div>
        <div class="botoes">${botoes}</div>
        ${emDupla && rd.sinais && (rd.fase === 'troca' || rd.fase === 'vira') ? botoesSinal(rd.sinais[0]) : ''}
      </section>
    </div>
  </div>${overlayMesa(j)}`;
}

// ---------- boteco ----------

function telaBoteco() {
  const j = app.jogo;
  const r = j.run;
  const itens = r.loja.itens.map((it, i) => {
    let corpo;
    if (it.tipo === 'comparsa') {
      const d = app.dados.comparsasPorId[it.id];
      corpo = `${infoBtn('comparsa', d.id, d.nome)}<span class="raridade r-${d.raridade}">${NOME_RARIDADE[d.raridade]} · Comparsa</span>${nomeComAvatar(d, 'h3')}<p>${esc(d.descricao)}</p>`;
    } else if (it.tipo === 'carta') {
      const c = it.carta;
      const detalhes = [c.melhoria && ['melhoria', c.melhoria, app.dados.cartas.melhorias[c.melhoria]], c.selo && ['selo', c.selo, app.dados.cartas.selos[c.selo]]].filter(Boolean);
      corpo = `<span class="raridade" style="background:#2b5a7a">Carta para o baralho</span>
        <div style="display:flex;gap:12px;align-items:center">${cartaHTML(c, { estatica: true, dados: app.dados })}
        <div>${detalhes.length ? detalhes.map(([tipo, id, x]) => `<p><b>${esc(x.nome)}</b> ${infoBtn(tipo, id, x.nome).replace('class="info acao"', 'class="info inline acao"')}<br>${esc(x.descricao)}</p>`).join('') : '<p>Carta comum, sem melhorias. Entra no seu baralho.</p>'}</div></div>`;
    } else {
      const d = defConsumivel(app.dados, it);
      corpo = `${infoBtn(it.tipo, d.id, d.nome)}<span class="raridade" style="background:${it.tipo === 'causo' ? '#8a5a2b' : '#5c4a8a'}">${it.tipo === 'causo' ? 'Causo' : 'Simpatia'}</span><h3>${esc(d.nome)}</h3><p>${esc(d.descricao)}</p>`;
    }
    return `<div class="ficha" style="${it.vendido ? 'opacity:.4' : ''}">${corpo}
      <div class="rodape"><span class="preco">${it.preco} réis</span>
      <button class="btn amarelo peq acao" data-acao="comprar" data-arg="${i}" ${it.vendido || it.preco > r.reis ? 'disabled' : ''}>${it.vendido ? 'Vendido' : 'Comprar'}</button></div></div>`;
  }).join('');
  const prox = j.infoMesa(r.mesaIdx + 1 > 2 ? r.bairro + 1 : r.bairro, (r.mesaIdx + 1) % 3);
  return `<div class="topo">
      <div><div class="rotulo">Entre uma mesa e outra</div><h2>Boteco Pé-Sujo</h2></div>
      <div class="num" style="color:var(--lampada);font-size:1.6rem">${r.reis} réis</div>
      <div class="botoes">
        <button class="btn acao" data-acao="reroll" ${r.reis < r.loja.rerollCusto ? 'disabled' : ''}>Outras ofertas (${r.loja.rerollCusto})</button>
        <button class="btn truco acao" data-acao="seguir">Próxima: ${esc(prox.pessoa.nome)}</button>
      </div>
    </div>
    <div class="grade">${itens}</div>
    ${painelColecaoRun(j, true)}`;
}

// ---------- fim ----------

function telaFim() {
  const j = app.jogo;
  const r = j.run;
  const s = r.stats;
  const venceu = r.fase === 'vitoria';
  const linhas = [
    ['Bairro alcançado', `${r.bairro} · ${j.nomeBairro()}`],
    ['Mesas vencidas', s.mesasVencidas],
    ['Mãos jogadas / vencidas', `${s.maosJogadas} / ${s.maosVencidas}`],
    ['Trucos pedidos', s.trucosPedidos],
    ['Adversário correu', s.adversarioCorreu],
    ['Maior mão', fmt(s.maiorMao)],
    ['Causos usados', s.causosUsados],
    ['Tampinhas ganhas', s.tampinhas ?? 0],
    ['Baralho', app.dados.baralhosPorId[r.baralhoId].nome],
  ].map(([k, v]) => `<div class="linha-giz"><span>${k}</span><span class="num">${esc(v)}</span></div>`).join('');
  const d = r.desafioResultado;
  const blocoDesafio = d ? `<div class="lousa resultado-desafio">
      <span class="rotulo">Desafio do dia ${esc(d.dia)}</span>
      <div class="grande">${fmt(d.pontos)}</div>
      <p>${d.testada ? 'Run com o modo de testes: não vale para o ranking.' : d.valeu ? (d.posicao ? `Você está em <b>${d.posicao}º</b> no ranking de hoje!` : d.erro ? `Não deu para enviar ao ranking: ${esc(d.erro)}` : 'Resultado enviado.') : 'Treino: só a primeira tentativa do dia vale para o ranking.'}</p>
      ${d.tampinhas ? `<div class="drop-grande"><i class="tampa" aria-hidden="true"></i>+${d.tampinhas} Tampinhas por jogar o desafio</div>` : ''}
      <button class="btn amarelo acao" data-acao="irDesafio">Ver ranking</button>
    </div>` : '';
  return `<section class="menu" style="padding-top:2vh">
    <h1 class="logo">${venceu ? 'REI DO TRUCO' : 'FIM DA RUN'}</h1>
    ${blocoDesafio}
    <div class="lousa" style="width:min(100%,480px);text-align:left">
      ${linhas}
      <div class="linha-giz"><span>Seed</span><span class="num" style="color:var(--lampada);user-select:all">${esc(r.seed)}</span></div>
    </div>
    <div class="botoes">
      ${venceu ? '<button class="btn amarelo acao" data-acao="continuarInfinito">Seguir no modo infinito</button>' : ''}
      <button class="btn truco acao" data-acao="irSelecao">Nova run</button>
      <button class="btn fantasma acao" data-acao="abandonar">Menu</button>
    </div>
  </section>`;
}

// ---------- clássico ----------

function telaClassico() {
  const p = app.partida;
  const st = p.mao;
  const ctx = { vira: st.vira };
  const pessoa = app.dados.personagensPorId[CLASSICO_PESSOA];
  const adv = st.maos[1].map(() => versoHTML({ mini: true })).join('');
  const minhas = st.maos[0].map((c) => (p.ferro && !st.fim
    ? versoHTML({ acao: 'carta', arg: c.id })
    : cartaHTML(c, { ctx, sel: app.sel.includes(c.id) }))).join('');
  const rd = { mao: st, numVazas: 3, vazasPontuadas: [] };
  const botoes = [];
  let dica = '';
  let overlay = '';
  if (p.fase === 'onze') {
    dica = 'Mão de onze: veja suas cartas. Jogar vale 3; correr dá 1 ponto ao adversário.';
    botoes.push('<button class="btn amarelo acao" data-acao="decidirOnze" data-arg="jogar">Jogar a mão</button>');
    botoes.push('<button class="btn fantasma acao" data-acao="decidirOnze" data-arg="correr">Correr</button>');
  } else if (p.fase === 'jogo') {
    if (st.pedido && st.pedido.por === 1) {
      const prox = proximoValor(st.pedido.valor);
      dica = `${pessoa.nome} pediu ${st.pedido.valor}.`;
      botoes.push(`<button class="btn amarelo acao" data-acao="responder" data-arg="aceitar">Aceitar (${st.pedido.valor})</button>`);
      if (prox) botoes.push(`<button class="btn truco acao" data-acao="responder" data-arg="aumentar">${NOME_VALOR[prox]}</button>`);
      botoes.push('<button class="btn fantasma acao" data-acao="responder" data-arg="correr">Correr</button>');
    } else if (st.vez === 0 && !st.pedido) {
      dica = p.ferro ? 'Mão de ferro: todo mundo joga às cegas.' : 'Sua vez. Toque numa carta e de novo para jogar.';
      botoes.push(`<button class="btn amarelo acao" data-acao="jogar" ${app.sel.length === 1 ? '' : 'disabled'}>Jogar carta</button>`);
      if (st.trucoPermitido && st.ultimoAumento !== 0 && proximoValor(st.valor)) botoes.push(`<button class="btn truco acao" data-acao="truco">${NOME_VALOR[proximoValor(st.valor)]}</button>`);
    } else dica = `${pessoa.nome} está pensando...`;
  } else if (!app.animando) {
    const res = p.ultimoResultado;
    const fim = p.fase === 'fim';
    const titulo = fim ? (p.vencedor === 0 ? 'Partida sua!' : `Partida de ${pessoa.nome}`) : res.vencedor === 0 ? 'A mão é sua' : res.vencedor === null ? 'Ninguém levou' : `A mão foi de ${pessoa.nome}`;
    overlay = `<div class="sobreposto" role="dialog" aria-modal="true"><div class="lousa resultado">
      <h2>${esc(titulo)}</h2>
      ${res.vencedor !== null ? `<div class="grande">+${res.pontos}</div>` : ''}
      ${res.correu === 1 ? `<p>${esc(pessoa.nome)} correu.</p>` : res.correu === 0 ? '<p>Você correu.</p>' : ''}
      <div class="linha-giz"><span>Nós</span><span class="num">${p.placar[0]}</span></div>
      <div class="linha-giz"><span>Eles</span><span class="num">${p.placar[1]}</span></div>
      <div class="botoes">${fim ? '<button class="btn truco acao" data-acao="classico">Nova partida</button><button class="btn fantasma acao" data-acao="irMenu">Menu</button>' : '<button class="btn amarelo acao" data-acao="proximaMaoClassico">Próxima mão</button>'}</div>
    </div></div>`;
  }
  return `<div class="mesa-layout">
    <aside class="lousa">
      <div class="rotulo">Truco clássico · até ${p.pontosVitoria}</div>
      <h2>Nós ${p.placar[0]} × ${p.placar[1]} Eles</h2>
      <div class="linha-giz"><span class="rotulo">Mão</span><span class="num">${p.maoNumero}</span></div>
      <div class="linha-giz"><span class="rotulo">Valendo</span><span class="num" style="color:var(--lampada)">${st.valor}</span></div>
      <div class="linha-giz"><span class="rotulo">Quem abre</span><span>${p.pe === 0 ? 'Você' : pessoa.nome}</span></div>
      ${p.ferro ? '<div class="regra-chefao">Mão de ferro: cartas às cegas</div>' : ''}
      <div class="botoes" style="margin-top:12px"><button class="btn fantasma peq acao" data-acao="irMenu">Sair</button></div>
    </aside>
    <div class="mesa-centro">
      <section class="toalha">
        <div class="adversario">
          <div class="quem">${avatarHTML(pessoa, true)}<div><span class="rotulo" style="color:var(--papel)">${esc(pessoa.titulo)}</span><h3>${esc(pessoa.nome)}</h3></div></div>
          ${app.falaClassico ? `<div class="fala">${esc(app.falaClassico)}</div>` : ''}
          <div class="cartas-adv">${adv}</div>
          <div class="vira-box"><span class="rotulo">Vira</span>${cartaHTML(st.vira, { mini: true, estatica: true })}</div>
        </div>
        ${vazasHTML(rd, ctx, pessoa.nome)}
      </section>
      <section class="mao-area">
        ${app.falaJogador ? `<div class="fala jogador">${esc(app.falaJogador)}</div>` : ''}
        <div class="mao">${minhas}</div><div class="dica">${esc(dica)}</div><div class="botoes">${botoes.join('')}</div></section>
    </div>
  </div>${overlay}`;
}

// ---------- truco em dupla ----------

function telaDupla() {
  const p = app.partida;
  const st = p.mao;
  const ctx = { vira: st.vira };
  const P = app.dados.personagensPorId;
  const nomes = { 1: P[p.pessoas[1]].nome, 2: P[p.pessoas[2]].nome, 3: P[p.pessoas[3]].nome };
  const avatares = { 1: P[p.pessoas[1]].avatar, 2: P[p.pessoas[2]].avatar, 3: P[p.pessoas[3]].avatar };
  const minhas = st.maos[0].map((c) => (p.ferro && !st.fim ? versoHTML({ acao: 'carta', arg: c.id }) : cartaHTML(c, { ctx, sel: app.sel.includes(c.id) }))).join('');
  const rd = { mao: st, numVazas: 3, vazasPontuadas: [] };
  const botoes = [];
  let dica = '';
  let overlay = '';
  if (p.fase === 'jogo') {
    if (st.pedido && st.pedido.por === 1) {
      const prox = proximoValor(st.pedido.valor);
      dica = `${nomes[st.pedido.jogador]} pediu ${st.pedido.valor}. Você responde pela dupla.`;
      botoes.push(`<button class="btn amarelo acao" data-acao="responder" data-arg="aceitar">Aceitar (${st.pedido.valor})</button>`);
      if (prox) botoes.push(`<button class="btn truco acao" data-acao="responder" data-arg="aumentar">${NOME_VALOR[prox]}</button>`);
      botoes.push('<button class="btn fantasma acao" data-acao="responder" data-arg="correr">Correr</button>');
    } else if (st.vez === 0 && !st.pedido) {
      dica = p.onze ? 'Mão de onze: vale 3, sem truco.' : p.ferro ? 'Mão de ferro: todo mundo joga às cegas.' : 'Sua vez. Toque numa carta e de novo para jogar.';
      botoes.push(`<button class="btn amarelo acao" data-acao="jogar" ${app.sel.length === 1 ? '' : 'disabled'}>Jogar carta</button>`);
      if (st.trucoPermitido && st.ultimoAumento !== 0 && proximoValor(st.valor)) botoes.push(`<button class="btn truco acao" data-acao="truco">${NOME_VALOR[proximoValor(st.valor)]}</button>`);
    } else dica = `${st.pedido ? nomes[1] : nomeLugar(st.vez, nomes)} está pensando...`;
  } else if (!app.animando) {
    const res = p.ultimoResultado;
    const fim = p.fase === 'fim';
    const titulo = fim ? (p.vencedor === 0 ? 'Partida de vocês!' : 'Partida deles') : res.vencedor === 0 ? 'A mão é de vocês' : res.vencedor === null ? 'Ninguém levou' : 'A mão foi deles';
    overlay = `<div class="sobreposto" role="dialog" aria-modal="true"><div class="lousa resultado">
      <h2>${esc(titulo)}</h2>
      ${res.vencedor !== null ? `<div class="grande">+${res.pontos}</div>` : ''}
      ${res.correu === 1 ? '<p>Eles correram.</p>' : res.correu === 0 ? '<p>Vocês correram.</p>' : ''}
      <div class="linha-giz"><span>Nós (você e ${esc(nomes[2])})</span><span class="num">${p.placar[0]}</span></div>
      <div class="linha-giz"><span>Eles (${esc(nomes[1])} e ${esc(nomes[3])})</span><span class="num">${p.placar[1]}</span></div>
      <div class="botoes">${fim ? '<button class="btn truco acao" data-acao="trucoDupla">Nova partida</button><button class="btn fantasma acao" data-acao="irMenu">Menu</button>' : '<button class="btn amarelo acao" data-acao="proximaMaoClassico">Próxima mão</button>'}</div>
    </div></div>`;
  }
  const podeSinal = p.fase === 'jogo' && !st.vazas.length;
  return `<div class="mesa-layout">
    <aside class="lousa">
      <div class="rotulo">Truco em dupla · até ${p.pontosVitoria}</div>
      <h2>Nós ${p.placar[0]} × ${p.placar[1]} Eles</h2>
      <div class="linha-giz"><span class="rotulo">Mão</span><span class="num">${p.maoNumero}</span></div>
      <div class="linha-giz"><span class="rotulo">Valendo</span><span class="num" style="color:var(--lampada)">${st.valor}</span></div>
      <div class="linha-giz"><span class="rotulo">Quem abre</span><span>${nomeLugar(p.pe, nomes)}</span></div>
      ${p.ferro ? '<div class="regra-chefao">Mão de ferro: cartas às cegas</div>' : ''}
      <details class="ajuda-sinais"><summary>Sinais do truco</summary>${Object.values(SINAIS).map((s) => `<div>${s.emoji} ${esc(s.gesto)}: <b>${esc(s.nome)}</b></div>`).join('')}
        <p>Seu parceiro sempre te mostra o sinal. Às vezes você pega o sinal de um adversário.</p></details>
      <div class="botoes" style="margin-top:12px"><button class="btn fantasma peq acao" data-acao="irMenu">Sair</button></div>
    </aside>
    <div class="mesa-centro">
      <section class="toalha">
        <div class="adversario"><div class="vira-box"><span class="rotulo">Vira</span>${cartaHTML(st.vira, { mini: true, estatica: true })}</div>
          ${app.falaClassico ? `<div class="fala">${esc(app.falaClassico)}</div>` : ''}</div>
        ${lugaresDupla({ st, nomes, avatares, sinais: p.sinais, vistos: p.sinaisVistos })}
        ${vazasHTML(rd, ctx, nomes[1], nomes)}
        <div class="valendo">${placarRodadas(rd)}<span class="rotulo" style="color:var(--papel)">valendo</span><span class="num">${st.valor}</span></div>
      </section>
      <section class="mao-area ${p.fase === 'jogo' && (st.pedido ? st.pedido.por === 1 : st.vez === 0) && !app.animando ? 'sua-vez' : ''}">
        ${app.falaJogador ? `<div class="fala jogador">${esc(app.falaJogador)}</div>` : ''}
        <div class="mao">${minhas}</div><div class="dica">${esc(dica)}</div><div class="botoes">${botoes.join('')}</div>
        ${podeSinal ? botoesSinal(p.sinais[0]) : ''}
      </section>
    </div>
  </div>${overlay}`;
}

// ---------- desafio do dia ----------

function telaDesafio() {
  const dia = diaDeHoje();
  const meu = app.perfil.desafios[dia];
  const rk = app.ranking;
  const global = app.usuario.conta.desafio?.global;
  let lista;
  if (!rk?.linhas) lista = '<p class="rotulo">Carregando ranking...</p>';
  else if (!rk.linhas.length) lista = `<p class="rotulo">${rk.erro ? `Não deu para carregar: ${esc(rk.erro)}` : 'Ninguém jogou ainda hoje. Seja o primeiro!'}</p>`;
  else lista = `<ol class="ranking">${rk.linhas.map((l, i) => `<li class="${l.eu ? 'eu' : ''}"><span class="pos">${i + 1}º</span><span class="nome">${esc(l.nome)}</span><span class="info">Bairro ${l.bairro} · ${l.mesas} Mesas</span><b class="num">${fmt(l.pontos)}</b></li>`).join('')}</ol>`;
  return `<div class="topo"><div><div class="rotulo">Todo mundo joga a mesma run hoje</div><h2>Desafio do dia</h2></div><button class="btn fantasma acao" data-acao="irMenu">Voltar</button></div>
    <div class="dupla">
      <div class="lousa">
        <div class="linha-giz"><span class="rotulo">Dia</span><span class="num">${esc(dia.split('-').reverse().join('/'))}</span></div>
        <div class="linha-giz"><span class="rotulo">Seed</span><span class="num">${esc(sementeDoDia(dia))}</span></div>
        <div class="linha-giz"><span class="rotulo">Baralho</span><span>${esc(app.dados.baralhosPorId[BARALHO_DESAFIO].nome)}</span></div>
        <p>Mesmas cartas, mesmos adversários e mesmos eventos para todo mundo. Pontuação: <b>1.000 por Mesa vencida</b> + todos os pontos que você fizer.</p>
        <p>Só a <b>primeira tentativa do dia</b> vale para o ranking e dá <b>+${TAMPINHAS_DESAFIO} Tampinhas</b>. Depois disso, é treino.</p>
        ${meu ? `<div class="drop-grande">Sua marca hoje: ${fmt(meu.pontos)}<small>Bairro ${meu.bairro} · ${meu.mesas} Mesas</small></div>` : ''}
        <div class="botoes"><button class="btn truco acao" data-acao="jogarDesafio">${meu ? 'Treinar o desafio' : 'Jogar o desafio'}</button></div>
      </div>
      <div class="lousa">
        <h3>Ranking de hoje</h3>
        ${global ? '' : '<p class="rotulo">Sem conta online: aqui só aparece o seu resultado. Entre com uma conta para disputar com os outros.</p>'}
        ${lista}
        <div class="botoes"><button class="btn fantasma peq acao" data-acao="irDesafio">Atualizar</button></div>
      </div>
    </div>`;
}

// ---------- explicações ("i") ----------

function nivelTexto(v) {
  return v < 0.15 ? 'quase nunca' : v < 0.3 ? 'pouco' : v < 0.5 ? 'às vezes' : v < 0.7 ? 'bastante' : 'muito';
}

function estiloDeJogo(pessoa) {
  const p = perfilDe(app.dados, pessoa);
  const corre = p.coragem <= 0.05 ? 'nunca' : p.coragem >= 0.7 ? 'fácil' : p.coragem >= 0.5 ? 'às vezes' : 'só com mão ruim';
  return `<ul class="lista-estilo">
    <li><b>Pede truco:</b> ${nivelTexto(p.agressividade)}</li>
    <li><b>Blefa:</b> ${nivelTexto(p.blefe * 2.5)}</li>
    <li><b>Corre do truco:</b> ${corre}</li>
    <li><b>Joga as cartas:</b> ${p.estrategiaCarta === 'forte_primeiro' ? 'abre com a mais forte' : 'guarda as fortes para o fim'}</li>
  </ul>`;
}

function blocoDetalhe(rotulo, nome, curta, longa, extra = '') {
  return {
    titulo: nome,
    corpo: `<span class="raridade" style="background:#2b5a7a">${esc(rotulo)}</span>
      <p class="curta">${esc(curta)}</p>
      ${longa ? `<h3 class="secao-giz">Como funciona</h3><p>${esc(longa)}</p>` : ''}
      ${extra}`,
  };
}

function detalheConteudo({ tipo, id }) {
  if (tipo === 'poder') {
    const jg = app.dados.jogadoresPorId[id];
    return blocoDetalhe('Poder', `${jg.avatar} ${jg.nome}: ${jg.poder.nome}`, jg.poder.descricao, jg.poder.detalhe);
  }
  const d = app.dados;
  if (tipo === 'comparsa') {
    const c = d.comparsasPorId[id];
    return blocoDetalhe(`Comparsa ${NOME_RARIDADE[c.raridade]}`, c.nome, c.descricao, c.detalhe,
      `<p class="rotulo">Comparsas ficam nos slots e agem sozinhos, da esquerda para a direita. A ordem importa: somar Mult antes de um ×Mult rende mais. Preço: ${c.preco} réis (vende pela metade).</p>`);
  }
  if (tipo === 'causo') {
    const c = d.causosPorId[id];
    const alvo = c.alvosMin === c.alvosMax ? `${c.alvosMin} carta${c.alvosMin > 1 ? 's' : ''}` : `de ${c.alvosMin} a ${c.alvosMax} cartas`;
    return blocoDetalhe('Causo', c.nome, c.descricao, c.detalhe,
      `<h3 class="secao-giz">Como usar</h3><p>Na Mesa, antes de jogar a 1ª carta da mão: selecione ${alvo} na sua mão e toque em Usar. A mudança é permanente no seu baralho. O Causo é gasto.</p>`);
  }
  if (tipo === 'simpatia') {
    const s = d.simpatiasPorId[id];
    const jog = d.jogadas[s.jogada];
    const niveis = app.jogo?.run.niveis ?? null;
    const n = niveis?.[s.jogada] ?? 1;
    const agora = valoresJogada(d, niveis, s.jogada);
    const depois = valoresJogada(d, { ...(niveis ?? {}), [s.jogada]: n + 1 }, s.jogada);
    const txt = s.jogada === 'cangada'
      ? `+${agora.multProxima} → +${depois.multProxima} Mult na próxima rodada`
      : `${agora.fichas} × ${agora.mult} → ${depois.fichas} × ${depois.mult}`;
    return blocoDetalhe('Simpatia', s.nome, s.descricao, `Sobe a Jogada "${jog.nome}" (${jog.descricao.toLowerCase()}) do nível ${n} para o ${n + 1}. Fichas × Mult da Jogada: ${txt}. Pode usar a qualquer momento; o nível vale até o fim da run.`);
  }
  if (tipo === 'jogada') {
    const j = d.jogadas[id];
    return blocoDetalhe('Jogada', j.nome, j.descricao, `Nível 1: ${j.fichas} Fichas × ${j.mult} Mult. Cada nível: +${j.fichasPorNivel} Fichas e +${j.multPorNivel} Mult.`);
  }
  if (tipo === 'melhoria') {
    const m = d.cartas.melhorias[id];
    return blocoDetalhe('Melhoria de carta', m.nome, m.descricao, m.detalhe);
  }
  if (tipo === 'selo') {
    const s = d.cartas.selos[id];
    return blocoDetalhe('Selo de carta', s.nome, s.descricao, s.detalhe);
  }
  if (tipo === 'pessoa') {
    const p = d.personagensPorId[id];
    const rotulo = p.tipo === 'chefao' ? (p.final ? 'Chefão final' : 'Chefão') : p.tipo === 'bar' ? 'Mesa do Bar' : 'Mesa do Fundo';
    return {
      titulo: p.nome,
      corpo: `<div class="pessoa-cab giz">${avatarHTML(p, true)}<div><span class="raridade ${p.tipo === 'chefao' ? 'r-rara' : 'r-comum'}">${rotulo}</span><div class="sub">${esc(p.titulo)}</div></div></div>
        <p class="curta">${esc(p.bio)}</p>
        <h3 class="secao-giz">${p.tipo === 'chefao' ? 'Regra do Chefão' : 'Manha da Mesa'}: ${esc(p.regra)}</h3>
        <p>${esc(p.detalhe)}</p>
        <h3 class="secao-giz">Estilo de jogo</h3>${estiloDeJogo(p)}
        ${p.drop ? `<p class="drop"><i class="tampa" aria-hidden="true"></i>Deixa cair ${p.drop} Tampinhas, mais 1 por bairro.</p>` : ''}`,
    };
  }
  return { titulo: 'Detalhe', corpo: '' };
}

// ---------- modais ----------

// Painel do admin: escolher cartas, vira, personagem/poder, Comparsas, itens e valores da Mesa
function painelTestes(j) {
  const r = j.run;
  const m = r.mesa;
  const rd = j.rodada;
  const opcoes = (lista, sel) => lista.map(([v, n]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const ranks = RANKS.map((x) => [x, x]);
  const naipes = SUITS.map((x) => [x, SUIT_NOME[x]]);
  const cartas = m && rd ? m.mao.map((id, i) => {
    const c = j.carta(id);
    return `<div class="carta-escolha">${i + 1}ª: <select id="adm-r${i}" aria-label="Valor da carta ${i + 1}">${opcoes(ranks, c.rank)}</select>
      <select id="adm-s${i}" aria-label="Naipe da carta ${i + 1}">${opcoes(naipes, c.suit)}</select>
      <button class="btn peq amarelo acao" data-acao="adminCarta" data-arg="${i}">Trocar</button></div>`;
  }).join('') : '<small>Sente numa Mesa para mexer nas cartas.</small>';
  const vira = rd?.vira ?? rd?.viras?.[0];
  const cons = [...app.dados.causos.map((c) => [`causo:${c.id}`, `Causo: ${c.nome}`]), ...app.dados.simpatias.map((s) => [`simpatia:${s.id}`, `Simpatia: ${s.nome}`])];
  return `<div class="painel-teste">
    <p><small>Só você vê isto. Uma run que usa os testes não vale para o ranking do Desafio do dia.</small></p>
    <fieldset><legend>Cartas da sua mão</legend><div class="linha">${cartas}</div>
      <small>Dica: com a vira de 4, a manilha é o 5; com vira 3, a manilha é o 4.</small></fieldset>
    ${rd ? `<fieldset><legend>Vira</legend><div class="linha carta-escolha">
      <select id="adm-vr" aria-label="Valor da vira">${opcoes(ranks, vira?.rank)}</select>
      <select id="adm-vs" aria-label="Naipe da vira">${opcoes(naipes, vira?.suit)}</select>
      <button class="btn peq amarelo acao" data-acao="adminVira">Trocar vira</button></div></fieldset>` : ''}
    <fieldset><legend>Personagem e poder</legend><div class="linha">
      <select id="adm-jog" aria-label="Personagem">${opcoes(app.dados.jogadores.map((x) => [x.id, `${x.nome}: ${x.poder.nome}`]), r.jogador)}</select>
      <button class="btn peq amarelo acao" data-acao="adminPersonagem">Trocar</button>
      <button class="btn peq acao" data-acao="adminRecarregar">Recarregar poder</button></div></fieldset>
    <fieldset><legend>Comparsas</legend><div class="linha">
      <select id="adm-comp" aria-label="Comparsa">${opcoes(app.dados.comparsas.map((c) => [c.id, `${c.nome} (${NOME_RARIDADE[c.raridade]})`]))}</select>
      <button class="btn peq amarelo acao" data-acao="adminComparsa">Adicionar</button></div>
      <small>Se os espaços estiverem cheios, ganha um espaço a mais.</small></fieldset>
    <fieldset><legend>Causos e Simpatias</legend><div class="linha">
      <select id="adm-cons" aria-label="Causo ou Simpatia">${opcoes(cons)}</select>
      <button class="btn peq amarelo acao" data-acao="adminConsumivel">Adicionar</button></div></fieldset>
    <fieldset><legend>Valores</legend><div class="linha">
      <label>Réis <input id="adm-reis" type="number" min="0" value="${r.reis}" style="width:6em"></label>
      ${m ? `<label>Tentos dele <input id="adm-tentos" type="number" min="0" max="11" value="${m.tentosAdv}" style="width:5em"></label>
      <label>Mãos <input id="adm-maos" type="number" min="1" value="${m.maosRestantes}" style="width:5em"></label>
      <label>Trocas <input id="adm-trocas" type="number" min="0" value="${m.trocasRestantes}" style="width:5em"></label>
      <label>Pontos <input id="adm-pontos" type="number" min="0" value="${m.pontos}" style="width:7em"></label>` : ''}
      <button class="btn peq amarelo acao" data-acao="adminValores">Aplicar</button></div></fieldset>
  </div>`;
}

function modalHTML() {
  if (!app.modal) return '';
  let titulo = '';
  let corpo = '';
  let larga = false;
  if (app.modal === 'detalhe' && app.detalhe) {
    ({ titulo, corpo } = detalheConteudo(app.detalhe));
  } else if (app.modal === 'baralho' && app.jogo) {
    titulo = `Seu baralho (${app.jogo.run.deck.length})`;
    larga = true;
    corpo = SUITS.map((s) => {
      const cartas = app.jogo.run.deck.filter((c) => c.suit === s).sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank));
      return `<div><div class="rotulo">${SUIT_NOME[s]} (${cartas.length})</div><div class="baralho-lista">${cartas.map((c) => cartaHTML(c, { mini: true, estatica: true, dados: app.dados })).join('')}</div></div>`;
    }).join('');
  } else if (app.modal === 'jogadas') {
    titulo = 'Jogadas';
    larga = true;
    corpo = `<p class="rotulo">Cada rodada vencida é uma Jogada. A pontuação é Fichas × Mult; Simpatias sobem o nível.</p>${tabelaJogadas(app.jogo?.run.niveis ?? null)}`;
  } else if (app.modal === 'sair') {
    titulo = 'Sair da run?';
    corpo = '<p>A run atual será apagada.</p><div class="botoes"><button class="btn truco acao" data-acao="abandonar">Sair e apagar</button><button class="btn fantasma acao" data-acao="fecharModal">Continuar jogando</button></div>';
  } else if (app.modal === 'som' && app.perfil) {
    titulo = 'Som';
    const o = app.perfil.opcoes;
    const faixa = (chave, nome) => `<label class="faixa-som"><span>${nome}</span><input type="range" min="0" max="1" step="0.05" value="${o[chave]}" data-opcao="${chave}" aria-label="${nome}"></label>`;
    corpo = `${faixa('musica', 'Música (baião)')}${faixa('ambiente', 'Ambiente do bar')}${faixa('efeitos', 'Efeitos')}${faixa('vozes', 'Vozes')}
      <label class="faixa-som"><span>Tudo mudo</span><input type="checkbox" ${o.mudo ? 'checked' : ''} data-opcao="mudo"></label>
      <label class="faixa-som"><span>Efeitos leves (sem tremida nem clarões)</span><input type="checkbox" ${o.efeitosLeves ? 'checked' : ''} data-opcao="efeitosLeves"></label>
      <p class="rotulo">${audio.temVoz() ? 'As vozes usam a fala do seu navegador; o sotaque depende das vozes instaladas no aparelho.' : 'Este navegador não tem voz sintetizada: as falas aparecem só em balões.'}</p>`;
  } else if (app.modal === 'testes' && app.jogo && podeTestar()) {
    titulo = '🛠️ Modo de testes';
    larga = true;
    corpo = painelTestes(app.jogo);
  } else if (app.modal === 'ajuda') {
    titulo = 'Como jogar';
    larga = true;
    corpo = `
      <p><b>Truco Paulista.</b> Baralho de 40 cartas (sem 8, 9, 10). Força: 4 &lt; 5 &lt; 6 &lt; 7 &lt; Q &lt; J &lt; K &lt; A &lt; 2 &lt; 3. A carta seguinte à <b>vira</b> é a <b>manilha</b>, que vence tudo: Pica-fumo (♦) &lt; Espadilha (♠) &lt; Copas (♥) &lt; Zap (♣).</p>
      <p><b>Mão:</b> melhor de 3 rodadas. Empate (cangou) na 1ª: decide a 2ª. Ganhou a 1ª e cangou a 2ª: leva quem ganhou a 1ª.</p>
      <p><b>Truco:</b> a mão vale 1 e o truco sobe para 3, 6, 9 e 12. Quem recebe pode aceitar, correr ou aumentar.</p>
      <p><b>Na run:</b> você enfrenta 3 pessoas por bairro, em 8 bairros. Cada uma tem uma meta de pontos, um número de mãos e uma <b>manha</b>: uma regra só daquela Mesa. Você recebe 3 cartas e, antes da 1ª rodada, pode trocar 1, 2 ou as 3 (cada troca gasta 1 das trocas da Mesa). Se perde a mão, não leva nada; se o seu truco foi aceito e você perdeu, perde uma mão extra. Se o adversário corre do seu truco, sua melhor carta pontua como uma rodada vencida.</p>
      <p>A última mão de cada Mesa é a <b>mão de onze</b>: vale 3, sem truco.</p>
      <p><b>Dois relógios:</b> você vence a Mesa batendo a meta de pontos. Mas cada mão que o adversário ganha vale <b>tentos</b> para ele (1, ou o valor do truco). Se ele chegar a <b>12 tentos</b>, você perde, mesmo com mãos sobrando. Com 11 tentos dele, a mão é de onze. Truco aceito é ótimo para pontuar e perigoso para o relógio.</p>
      <p><b>Jogadas da mão:</b> além de cada rodada, o jeito de ganhar a mão pontua: Queda Limpa (todas), Virada (perdeu a 1ª e virou), Na Raça (ganhou, perdeu, ganhou), No Empate (com uma rodada empatada) e Fujão (o adversário correu).</p>
      <p><b>Personagem:</b> cada um tem um <b>poder</b> (botão ⚡ na lousa) com usos grátis por Mesa; depois custa réis ou dá tentos ao adversário.</p>
      <p><b>Cara do adversário:</b> o rostinho ao lado dele mostra como ele parece estar com a mão. 😎 forte, 😐 mais ou menos, 😟 fraca. Quem blefa muito mente na cara.</p>
      <p><b>Manilhas por cor:</b> a borda da manilha mostra a força. Azul é o Pica-fumo, verde a Espadilha, laranja a de Copas e vermelho o Zap. A carta que perdeu a rodada fica cinza.</p>
      <h3 class="secao-giz">Glossário</h3>
      <dl class="glossario">
        <dt>Fichas × Mult</dt><dd>A conta de cada rodada vencida. Fichas vêm da carta (Ás = 10, 3 = 15, manilha = 20, Zap = 30) e da Jogada; Mult vem da Jogada e dos bônus. Depois a mão é multiplicada pelo valor do truco.</dd>
        <dt>Jogada</dt><dd>O jeito que você venceu a rodada: Rodada Simples, Matar Seco, Manilhada, Zapada... Cada uma tem Fichas e Mult próprios. Veja em "Jogadas".</dd>
        <dt>Manha</dt><dd>A regra de cada pessoa da Mesa (Seu Joaquim dá réis por rodada, Rita Navalha tira uma troca...). Chefões têm regras mais duras.</dd>
        <dt>Réis</dt><dd>Dinheiro da run. Ganha vencendo Mesas; gasta no Boteco. Cada 5 réis guardados rendem 1 de juros (até 5). Some quando a run acaba.</dd>
        <dt>Tampinhas</dt><dd>Moeda que fica com você para sempre. Só Chefões deixam cair, cada um um valor. Gaste no Bazar das Tampinhas em visual de cartas, toalhas e falas.</dd>
        <dt>Comparsa</dt><dd>Ajudante permanente da run. Fica num slot e dá bônus sozinho. A ordem dos slots importa.</dd>
        <dt>Causo</dt><dd>Item de uso único que muda cartas do seu baralho para sempre (naipe, melhoria, cópia...). Use antes da 1ª rodada.</dd>
        <dt>Simpatia</dt><dd>Item de uso único que sobe o nível de uma Jogada até o fim da run.</dd>
        <dt>Promessa</dt><dd>Prêmio por pular uma Mesa que não é de Chefão.</dd>
      </dl>
      <p>Toque no <span class="info-exemplo">i</span> de qualquer Comparsa, Causo, Simpatia ou pessoa para ver a explicação completa com exemplo.</p>
      <h3 class="secao-giz">Conta e progresso</h3>
      <p>${app.usuario?.conta?.tipo === 'claude' ? 'Você está jogando com a sua conta do Claude: o progresso fica salvo nela.' : app.usuario?.conta?.tipo === 'servidor' ? 'Você entrou com nome e senha: o progresso fica salvo no servidor.' : 'Sem conta, o progresso fica salvo só neste navegador.'} A run é salva a cada jogada; se fechar o jogo, use "Continuar run".</p>`;
  }
  return `<div class="sobreposto" role="dialog" aria-modal="true" aria-label="${esc(titulo)}" data-fundo-modal>
    <div class="lousa ${larga ? 'larga' : ''}">
      <div class="topo" style="margin:0"><h2>${esc(titulo)}</h2><button class="btn fantasma peq acao" data-acao="fecharModal">Fechar</button></div>
      ${corpo}
    </div></div>`;
}

// ---------- início ----------

async function carregarDados() {
  const raw = {};
  await Promise.all(ARQUIVOS_DADOS.map(async (nome) => {
    const resp = await fetch(`data/${nome}.json`);
    if (!resp.ok) throw new Error(`Falha ao carregar data/${nome}.json`);
    raw[nome] = await resp.json();
  }));
  return montarDados(raw);
}

// ?debug expõe o estado no console (window.trucatro) para testar
if (new URLSearchParams(location.search).has('debug')) window.trucatro = { app, render, executar };

render();
Promise.all([carregarDados(), detectarConta()])
  .then(async ([dados, det]) => {
    app.dados = dados;
    app.usuario = det;
    let escolheuConvidado = false;
    try { escolheuConvidado = localStorage.getItem('trucatro.convidado') === '1'; } catch { /* ignora */ }
    if (app.convite) app.loginModo = 'criar';
    if (det.conta.tipo === 'local' && det.backend && (det.backend.exigeConta || !escolheuConvidado)) {
      if (det.temAdmin === false) app.loginModo = 'criar';
      app.tela = 'login';
      render();
      document.getElementById('login-nome')?.focus();
    } else {
      await abrirConta(det.conta);
    }
  })
  .catch((e) => {
    console.error(e);
    raiz.innerHTML = `<p class="toast" style="position:static;transform:none">${esc(e.message)}</p>`;
  });

// Carta da mão inclina e brilha seguindo o mouse
raiz.addEventListener('pointermove', (e) => {
  const c = e.target.closest?.('.mao .carta');
  if (!c || e.pointerType !== 'mouse') return;
  const r = c.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  c.style.setProperty('--mx', `${(x * 100).toFixed(0)}%`);
  c.style.setProperty('--my', `${(y * 100).toFixed(0)}%`);
  c.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(1)}deg`);
  c.style.setProperty('--rx', `${((0.5 - y) * 18).toFixed(1)}deg`);
});
