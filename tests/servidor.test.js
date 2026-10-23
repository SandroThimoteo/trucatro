import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const porta = 6100 + Math.floor(Math.random() * 800);
const base = `http://localhost:${porta}`;
const pasta = mkdtempSync(join(tmpdir(), 'trucatro-contas-'));
let servidor;

before(async () => {
  servidor = spawn(process.execPath, [join(raiz, 'server.js')], { env: { ...process.env, PORT: String(porta), TRUCATRO_CONTAS: pasta }, stdio: 'pipe' });
  await new Promise((ok, falha) => {
    servidor.stdout.on('data', (d) => { if (String(d).includes('Trucatro em')) ok(); });
    servidor.on('exit', () => falha(new Error('servidor caiu')));
  });
});
after(() => {
  servidor?.kill();
  rmSync(pasta, { recursive: true, force: true });
});

const api = async (caminho, { metodo = 'GET', corpo, token } = {}) => {
  const r = await fetch(`${base}/api/${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, dados: await r.json() };
};

test('cadastro, login, salvar e carregar o progresso', async () => {
  assert.equal((await api('status')).dados.trucatro, true);
  const cad = await api('cadastro', { metodo: 'POST', corpo: { nome: 'Zé Teste', senha: 'truco123' } });
  assert.equal(cad.status, 200);
  assert.equal((await api('cadastro', { metodo: 'POST', corpo: { nome: 'zé teste', senha: 'outra' } })).status, 409, 'nome repetido');

  const token = cad.dados.token;
  assert.equal((await api('perfil', { token })).dados.perfil, null);
  assert.equal((await api('perfil', { metodo: 'PUT', token, corpo: { perfil: { tampinhas: 9, save: '{}' } } })).status, 200);

  const login = await api('entrar', { metodo: 'POST', corpo: { nome: 'ZÉ TESTE', senha: 'truco123' } });
  assert.equal(login.status, 200);
  assert.equal((await api('perfil', { token: login.dados.token })).dados.perfil.tampinhas, 9);
  assert.equal((await api('eu', { token: login.dados.token })).dados.nome, 'Zé Teste');
});

test('senha errada, token inválido e sair', async () => {
  await api('cadastro', { metodo: 'POST', corpo: { nome: 'Maria', senha: 'abcd' } });
  assert.equal((await api('entrar', { metodo: 'POST', corpo: { nome: 'Maria', senha: 'errada' } })).status, 401);
  assert.equal((await api('perfil', { token: 'f'.repeat(64) })).status, 401);
  const { dados } = await api('entrar', { metodo: 'POST', corpo: { nome: 'Maria', senha: 'abcd' } });
  await api('sair', { metodo: 'POST', token: dados.token });
  assert.equal((await api('eu', { token: dados.token })).status, 401);
});

test('validação de cadastro e pasta de contas protegida', async () => {
  assert.equal((await api('cadastro', { metodo: 'POST', corpo: { nome: 'ab', senha: 'abcd' } })).status, 400);
  assert.equal((await api('cadastro', { metodo: 'POST', corpo: { nome: 'Fulano', senha: '12' } })).status, 400);
  assert.equal((await fetch(`${base}/.contas/contas.json`)).status, 403);
  assert.equal((await fetch(`${base}/index.html`)).status, 200);
});
