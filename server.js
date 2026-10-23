// Servidor para jogar localmente: node server.js
// Serve os arquivos do jogo e uma API simples de contas (nome + senha) que guarda o progresso
// em .contas/ (fora do que é servido). index.html é um fragmento (formato de Artifact);
// aqui ele ganha o esqueleto HTML.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const raiz = dirname(fileURLToPath(import.meta.url));
const porta = Number(process.env.PORT ?? 5173);
const pastaContas = process.env.TRUCATRO_CONTAS ?? join(raiz, '.contas');
const arquivoContas = join(pastaContas, 'contas.json');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const LIMITE_CORPO = 1024 * 1024;

// ---------- contas ----------

let contas = null;
async function lerContas() {
  if (contas) return contas;
  try { contas = JSON.parse(await readFile(arquivoContas, 'utf8')); } catch { contas = { usuarios: {} }; }
  return contas;
}
async function gravarJSON(arquivo, dados) {
  await mkdir(dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.tmp`;
  await writeFile(tmp, JSON.stringify(dados));
  await rename(tmp, arquivo);
}
const gravarContas = () => gravarJSON(arquivoContas, contas);
const chaveDe = (nome) => nome.trim().toLowerCase();
const hashToken = (t) => createHash('sha256').update(t).digest('hex');
const arquivoPerfil = (chave) => join(pastaContas, 'perfis', `${createHash('sha256').update(chave).digest('hex').slice(0, 32)}.json`);

async function hashSenha(senha, sal) {
  return (await scryptAsync(senha, sal, 64)).toString('hex');
}

function novoToken(u) {
  const token = randomBytes(32).toString('hex');
  u.tokens = [...(u.tokens ?? []).slice(-9), hashToken(token)];
  return token;
}

async function usuarioDoToken(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '');
  if (!m) return null;
  const h = hashToken(m[1]);
  const { usuarios } = await lerContas();
  for (const [chave, u] of Object.entries(usuarios)) if (u.tokens?.includes(h)) return { chave, u, h };
  return null;
}

// Limite simples de tentativas de login por IP
const tentativas = new Map();
function podeTentar(ip) {
  const agora = Date.now();
  const lista = (tentativas.get(ip) ?? []).filter((t) => agora - t < 60_000);
  lista.push(agora);
  tentativas.set(ip, lista);
  return lista.length <= 10;
}

function validar(nome, senha) {
  if (typeof nome !== 'string' || !/^[\p{L}\p{N} _.-]{3,20}$/u.test(nome.trim())) return 'Nome: de 3 a 20 letras ou números';
  if (typeof senha !== 'string' || senha.length < 4 || senha.length > 100) return 'Senha: pelo menos 4 caracteres';
  return null;
}

async function lerCorpo(req) {
  let tamanho = 0;
  const partes = [];
  for await (const p of req) {
    tamanho += p.length;
    if (tamanho > LIMITE_CORPO) throw Object.assign(new Error('Progresso grande demais'), { status: 413 });
    partes.push(p);
  }
  if (!partes.length) return {};
  try { return JSON.parse(Buffer.concat(partes).toString('utf8')); } catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}

const rotas = {
  'GET status': async () => ({ trucatro: true }),
  'POST cadastro': async (req) => {
    const { nome, senha } = await lerCorpo(req);
    const erro = validar(nome, senha);
    if (erro) return { status: 400, erro };
    const c = await lerContas();
    const chave = chaveDe(nome);
    if (c.usuarios[chave]) return { status: 409, erro: 'Esse nome já tem conta. Use Entrar.' };
    const sal = randomBytes(16).toString('hex');
    const u = { nome: nome.trim(), sal, hash: await hashSenha(senha, sal), criadoEm: Date.now() };
    const token = novoToken(u);
    c.usuarios[chave] = u;
    await gravarContas();
    return { token, nome: u.nome };
  },
  'POST entrar': async (req) => {
    if (!podeTentar(req.socket.remoteAddress)) return { status: 429, erro: 'Muitas tentativas. Espere um minuto.' };
    const { nome, senha } = await lerCorpo(req);
    if (typeof nome !== 'string' || typeof senha !== 'string') return { status: 400, erro: 'Informe nome e senha' };
    const c = await lerContas();
    const u = c.usuarios[chaveDe(nome)];
    const esperado = u ? Buffer.from(u.hash, 'hex') : randomBytes(64);
    const recebido = Buffer.from(await hashSenha(senha, u?.sal ?? 'x'), 'hex');
    if (!u || !timingSafeEqual(esperado, recebido)) return { status: 401, erro: 'Nome ou senha errados' };
    const token = novoToken(u);
    await gravarContas();
    return { token, nome: u.nome };
  },
  'GET eu': async (req) => {
    const s = await usuarioDoToken(req);
    return s ? { nome: s.u.nome } : { status: 401, erro: 'Sessão expirada' };
  },
  'POST sair': async (req) => {
    const s = await usuarioDoToken(req);
    if (s) {
      s.u.tokens = s.u.tokens.filter((t) => t !== s.h);
      await gravarContas();
    }
    return { ok: true };
  },
  'GET perfil': async (req) => {
    const s = await usuarioDoToken(req);
    if (!s) return { status: 401, erro: 'Sessão expirada' };
    try { return { perfil: JSON.parse(await readFile(arquivoPerfil(s.chave), 'utf8')) }; } catch { return { perfil: null }; }
  },
  'PUT perfil': async (req) => {
    const s = await usuarioDoToken(req);
    if (!s) return { status: 401, erro: 'Sessão expirada' };
    const { perfil } = await lerCorpo(req);
    if (!perfil || typeof perfil !== 'object' || Array.isArray(perfil)) return { status: 400, erro: 'Perfil inválido' };
    await gravarJSON(arquivoPerfil(s.chave), perfil);
    return { ok: true };
  },
};

async function responderApi(req, res, nome) {
  const rota = rotas[`${req.method} ${nome}`];
  let r;
  try {
    r = rota ? await rota(req) : { status: 404, erro: 'Rota não existe' };
  } catch (e) {
    r = { status: e.status ?? 500, erro: e.status ? e.message : 'Erro no servidor' };
    if (!e.status) console.error(e);
  }
  const { status = 200, ...corpo } = r;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

// ---------- arquivos ----------

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return responderApi(req, res, url.pathname.slice(5));
  const caminho = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const arquivo = normalize(join(raiz, caminho));
  // Nada fora da pasta do jogo, nem arquivos/pastas ocultos (as contas ficam em .contas)
  if (!arquivo.startsWith(raiz) || caminho.split('/').some((p) => p.startsWith('.'))) {
    res.writeHead(403).end();
    return;
  }
  try {
    let corpo = await readFile(arquivo);
    if (caminho === '/index.html') {
      corpo = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${corpo}</body></html>`;
    }
    res.writeHead(200, { 'Content-Type': `${tipos[extname(arquivo)] ?? 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(corpo);
  } catch {
    res.writeHead(404).end('Não encontrado');
  }
}).listen(porta, () => console.log(`Trucatro em http://localhost:${porta}`));
