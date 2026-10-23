// Testa supabase/schema.sql num Postgres local (PGlite). Uso: npm install && npm run testar-banco
// O pgcrypto do Supabase é trocado por funções falsas (pgcrypto-falso.sql) só aqui no teste.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8').replace(/create extension if not exists pgcrypto[^;]*;/, '');
await db.exec(readFileSync(new URL('./pgcrypto-falso.sql', import.meta.url), 'utf8'));
await db.exec(schema);
await db.exec(schema); // rodar 2x não pode quebrar
const rpc = async (fn, args) => {
  const nomes = Object.keys(args);
  const vals = nomes.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
  const sql = `select ${fn}(${nomes.map((n, i) => `${n} => $${i + 1}${typeof args[n] === 'object' && args[n] !== null ? '::jsonb' : ''}`).join(', ')}) as r`;
  try { return (await db.query(sql, vals)).rows[0].r; } catch (e) { return { erro: e.message }; }
};
const ok = (cond, msg) => { if (!cond) { console.error('FALHOU:', msg); process.exitCode = 1; } else console.log('ok -', msg); };

ok((await rpc('trucatro_status', {})).temAdmin === false, 'sem admin no começo');
const adm = await rpc('trucatro_cadastrar', { p_nome: 'Sandro', p_senha: 'segredo1' });
ok(adm.admin === true && adm.token, 'primeira conta vira admin sem convite ' + JSON.stringify(adm));
ok((await rpc('trucatro_cadastrar', { p_nome: 'Outro', p_senha: 'segredo1' })).erro?.includes('Convite'), 'segunda conta precisa de convite');
ok((await rpc('trucatro_cadastrar', { p_nome: 'Outro', p_senha: 'segredo1', p_convite: 'ABCD-EFGH' })).erro?.includes('Convite'), 'convite falso não vale');
const cods = await rpc('trucatro_admin_criar_convites', { p_token: adm.token, p_quantidade: 5, p_observacao: 'amigos' });
ok(Array.isArray(cods) && cods.length === 5 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(cods[0]), 'admin cria 5 convites no formato XXXX-XXXX ' + JSON.stringify(cods));
ok((await rpc('trucatro_admin_criar_convites', { p_token: adm.token, p_quantidade: 0 })).erro, 'quantidade 0 recusada');
ok((await rpc('trucatro_admin_criar_convites', { p_token: adm.token, p_quantidade: 101 })).erro, 'quantidade 101 recusada');
const ze = await rpc('trucatro_cadastrar', { p_nome: 'Zéca', p_senha: 'senha123', p_convite: cods[0].toLowerCase() });
ok(ze.token && ze.admin === false, 'cadastro com convite (sem diferenciar maiúsculas) e não é admin ' + JSON.stringify(ze));
ok((await rpc('trucatro_cadastrar', { p_nome: 'Maria', p_senha: 'senha123', p_convite: cods[0] })).erro?.includes('Convite'), 'convite só serve uma vez');
ok((await rpc('trucatro_admin_criar_convites', { p_token: ze.token, p_quantidade: 1 })).erro?.includes('admin'), 'jogador comum não cria convite');
ok((await rpc('trucatro_admin_jogadores', { p_token: ze.token })).erro?.includes('admin'), 'jogador comum não lista jogadores');
ok((await rpc('trucatro_admin_definir', { p_token: ze.token, p_nome: 'Zéca', p_tampinhas: 999 })).erro, 'jogador comum não muda Tampinhas');
ok((await rpc('trucatro_cadastrar', { p_nome: 'zéca', p_senha: 'senha123', p_convite: cods[1] })).erro?.includes('já tem conta'), 'nome repetido recusado');
ok((await rpc('trucatro_entrar', { p_nome: 'ZÉCA', p_senha: 'errada' })).erro?.includes('errados'), 'senha errada');
const ze2 = await rpc('trucatro_entrar', { p_nome: 'ZÉCA', p_senha: 'senha123' });
ok(ze2.token && ze2.nome === 'Zéca', 'login sem diferenciar maiúsculas');
ok((await rpc('trucatro_eu', { p_token: ze2.token })).nome === 'Zéca', 'eu');
ok((await rpc('trucatro_carregar', { p_token: ze2.token })).perfil === null, 'perfil vazio no começo');
const run = JSON.stringify({ fase: 'mesa', reis: 7, bairro: 2 });
let s = await rpc('trucatro_salvar', { p_token: ze2.token, p_perfil: { tampinhas: 3, save: run } });
ok(s.ok && s.ajustes === null, 'salvar sem ajustes ' + JSON.stringify(s));
ok((await rpc('trucatro_admin_definir', { p_token: adm.token, p_nome: 'zéca', p_tampinhas: 40, p_reis: 25 })).ok, 'admin define Tampinhas e réis');
const lista = await rpc('trucatro_admin_jogadores', { p_token: adm.token });
const linha = lista.find((j) => j.nome === 'Zéca');
ok(linha.tampinhas === 40 && linha.reis === 25 && linha.convite === cods[0], 'lista mostra valores novos e o convite usado ' + JSON.stringify(linha));
s = await rpc('trucatro_salvar', { p_token: ze2.token, p_perfil: { tampinhas: 3, save: run, outra: 1 } });
ok(s.ajustes?.tampinhas === 40 && s.ajustes?.reis === 25, 'salvar devolve o ajuste do admin');
const c1 = await rpc('trucatro_carregar', { p_token: ze2.token });
ok(c1.perfil.tampinhas === 40 && JSON.parse(c1.perfil.save).reis === 25 && c1.perfil.outra === 1, 'perfil salvo já com o ajuste aplicado');
s = await rpc('trucatro_salvar', { p_token: ze2.token, p_perfil: c1.perfil });
ok(s.ajustes === null, 'ajuste entregue só uma vez');
ok((await rpc('trucatro_admin_definir', { p_token: adm.token, p_nome: 'Zéca', p_tampinhas: 5 })).ok, 'admin muda só Tampinhas');
const c2 = await rpc('trucatro_carregar', { p_token: ze2.token });
ok(c2.perfil.tampinhas === 5 && JSON.parse(c2.perfil.save).reis === 25, 'réis ficam iguais quando só Tampinhas muda');
ok((await rpc('trucatro_admin_definir', { p_token: adm.token, p_nome: 'Ninguém', p_tampinhas: 5 })).erro?.includes('não encontrado'), 'jogador inexistente');
ok((await rpc('trucatro_admin_definir', { p_token: adm.token, p_nome: 'Zéca', p_tampinhas: -1 })).erro, 'Tampinhas negativas recusadas');
const conv = await rpc('trucatro_admin_convites', { p_token: adm.token });
ok(conv.length === 5 && conv.find((v) => v.codigo === cods[0]).usadoPor === 'Zéca', 'lista de convites mostra quem usou');
ok((await rpc('trucatro_admin_apagar_convite', { p_token: adm.token, p_codigo: cods[0] })).erro, 'convite usado não pode ser apagado');
ok((await rpc('trucatro_admin_apagar_convite', { p_token: adm.token, p_codigo: cods[4] })).ok, 'apaga convite não usado');
ok((await rpc('trucatro_cadastrar', { p_nome: 'Maria', p_senha: 'senha123', p_convite: cods[4] })).erro?.includes('Convite'), 'convite apagado não vale');
await rpc('trucatro_sair', { p_token: ze2.token });
ok((await rpc('trucatro_eu', { p_token: ze2.token })).erro?.includes('Sessão'), 'sair invalida o token');
ok((await rpc('trucatro_eu', { p_token: ze.token })).nome === 'Zéca', 'outra sessão continua valendo');
ok((await rpc('trucatro_salvar', { p_token: ze.token, p_perfil: [1, 2] })).erro, 'perfil que não é objeto é recusado');
ok((await rpc('trucatro_cadastrar', { p_nome: 'ab', p_senha: 'senha123', p_convite: cods[2] })).erro?.includes('Nome'), 'nome curto recusado');
ok((await rpc('trucatro_cadastrar', { p_nome: 'Carlos', p_senha: '123', p_convite: cods[2] })).erro?.includes('Senha'), 'senha curta recusada');
for (let i = 0; i < 8; i++) await rpc('trucatro_entrar', { p_nome: 'Sandro', p_senha: 'x' });
ok((await rpc('trucatro_entrar', { p_nome: 'Sandro', p_senha: 'segredo1' })).erro?.includes('Muitas'), 'limite de tentativas de login');
