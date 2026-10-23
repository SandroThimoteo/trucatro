// Conta do jogador: onde o perfil (progresso, Tampinhas, run em andamento) é salvo.
//  - "claude":   página publicada no claude.ai; entra com a conta do Claude, perfil privado no banco do artifact.
//  - "online":   site no GitHub Pages com banco Supabase (data/online.json); login, convites e admin.
//  - "servidor": jogando com `node server.js`; login com nome e senha, perfil salvo no servidor.
//  - "local":    sem conta; perfil salvo só neste navegador.

const CHAVE_TOKEN = 'trucatro.token';
const CHAVE_LOCAL = 'trucatro.perfil.v1';
const CHAVE_SAVE_ANTIGO = 'trucatro.save.v1';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignora */ } },
};

function lerJSON(k) {
  const s = ls.get(k);
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

// Perfil local (convidado). Traz a run salva pela versão antiga, se houver.
function contaLocal() {
  return {
    tipo: 'local',
    nome: '',
    logado: false,
    async carregar() {
      const p = lerJSON(CHAVE_LOCAL);
      const antigo = ls.get(CHAVE_SAVE_ANTIGO);
      if (antigo && !p?.save) return { ...(p ?? {}), save: antigo };
      return p;
    },
    async salvar(perfil) {
      ls.set(CHAVE_LOCAL, JSON.stringify(perfil));
      ls.del(CHAVE_SAVE_ANTIGO);
    },
  };
}

async function contaClaude() {
  if (typeof window.claude?.use !== 'function') return null;
  const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
  if (!db || !user) return null;
  const id = await user.id();
  if (!id) return null;
  const me = await user.me();
  const doc = db.doc(`data/users/${id}/perfil`);
  let gravando = Promise.resolve();
  return {
    tipo: 'claude',
    nome: me.name || 'Você',
    logado: true,
    async carregar() {
      const snap = await doc.get();
      return snap.exists ? snap.data() : null;
    },
    // Uma escrita por vez no mesmo documento
    salvar(perfil) {
      gravando = gravando.catch(() => {}).then(() => doc.set(JSON.parse(JSON.stringify(perfil))));
      return gravando;
    },
  };
}

// ---------- backends com login (nome + senha) ----------

// Supabase: o site chama as funções trucatro_* (supabase/schema.sql) pela API REST.
function backendSupabase(cfg) {
  const base = cfg.supabaseUrl.replace(/\/+$/, '');
  const chave = cfg.supabaseChave;
  const rpc = async (fn, args = {}, { manter = false } = {}) => {
    const corpo = JSON.stringify(args);
    const resp = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      // Chaves antigas (JWT "eyJ...") também vão no Authorization; as novas (sb_publishable_...) só no apikey
      headers: { apikey: chave, ...(chave.startsWith('eyJ') ? { Authorization: `Bearer ${chave}` } : {}), 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: manter && corpo.length < 60000,
    });
    let dados = null;
    try { dados = await resp.json(); } catch { /* sem corpo */ }
    if (!resp.ok) throw new Error(dados?.message ?? `Erro ${resp.status} no servidor`);
    if (dados?.erro) throw new Error(dados.erro);
    return dados;
  };
  return {
    tipo: 'online',
    exigeConta: true,
    exigeConvite: true,
    status: () => rpc('trucatro_status'),
    cadastrar: (nome, senha, convite) => rpc('trucatro_cadastrar', { p_nome: nome, p_senha: senha, p_convite: convite || null }),
    entrar: (nome, senha) => rpc('trucatro_entrar', { p_nome: nome, p_senha: senha }),
    eu: (token) => rpc('trucatro_eu', { p_token: token }),
    sair: (token) => rpc('trucatro_sair', { p_token: token }),
    carregar: async (token) => (await rpc('trucatro_carregar', { p_token: token })).perfil,
    salvar: (token, perfil) => rpc('trucatro_salvar', { p_token: token, p_perfil: perfil }, { manter: true }),
    admin: {
      jogadores: (token) => rpc('trucatro_admin_jogadores', { p_token: token }),
      definir: (token, nome, tampinhas, reis) => rpc('trucatro_admin_definir', { p_token: token, p_nome: nome, p_tampinhas: tampinhas, p_reis: reis }),
      criarConvites: (token, quantidade, observacao) => rpc('trucatro_admin_criar_convites', { p_token: token, p_quantidade: quantidade, p_observacao: observacao || null }),
      convites: (token) => rpc('trucatro_admin_convites', { p_token: token }),
      apagarConvite: (token, codigo) => rpc('trucatro_admin_apagar_convite', { p_token: token, p_codigo: codigo }),
    },
  };
}

// node server.js: login simples, sem convites nem admin.
function backendServidor() {
  const api = async (caminho, { metodo = 'GET', corpo, token } = {}) => {
    const resp = await fetch(`api/${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      keepalive: metodo !== 'GET' && (corpo ? JSON.stringify(corpo).length < 60000 : true),
    });
    let dados = null;
    try { dados = await resp.json(); } catch { /* sem corpo */ }
    if (!resp.ok) throw new Error(dados?.erro ?? `Erro ${resp.status}`);
    return dados;
  };
  return {
    tipo: 'servidor',
    exigeConta: false,
    exigeConvite: false,
    status: () => api('status'),
    cadastrar: (nome, senha) => api('cadastro', { metodo: 'POST', corpo: { nome, senha } }),
    entrar: (nome, senha) => api('entrar', { metodo: 'POST', corpo: { nome, senha } }),
    eu: (token) => api('eu', { token }),
    sair: (token) => api('sair', { metodo: 'POST', token }),
    carregar: async (token) => (await api('perfil', { token })).perfil,
    salvar: (token, perfil) => api('perfil', { metodo: 'PUT', corpo: { perfil }, token }),
    admin: null,
  };
}

function contaDoBackend(backend, token, eu) {
  return {
    tipo: backend.tipo,
    nome: eu.nome,
    admin: !!eu.admin && !!backend.admin,
    logado: true,
    carregar: () => backend.carregar(token),
    // Devolve { ajustes } quando o admin mudou Tampinhas/réis enquanto você jogava
    salvar: (perfil) => backend.salvar(token, perfil),
    async sair() {
      try { await backend.sair(token); } catch { /* já saiu */ }
      ls.del(CHAVE_TOKEN);
    },
    // Ações do painel do admin (o banco confere se é admin mesmo)
    adm: backend.admin && eu.admin ? Object.fromEntries(Object.entries(backend.admin).map(([k, fn]) => [k, (...a) => fn(token, ...a)])) : null,
  };
}

async function lerConfigOnline() {
  // Jogando em localhost (node server.js) não mexe no banco de verdade, a não ser com ?online=1
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local && new URLSearchParams(location.search).get('online') !== '1') return null;
  try {
    const r = await fetch('data/online.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const c = await r.json();
    return c?.supabaseUrl && c?.supabaseChave ? c : null;
  } catch { return null; }
}

async function descobrirBackend() {
  const cfg = await lerConfigOnline();
  if (cfg) return backendSupabase(cfg);
  const servidor = backendServidor();
  try {
    if ((await servidor.status())?.trucatro === true) return servidor;
  } catch { /* sem servidor: site estático */ }
  return null;
}

// Descobre como salvar. Retorna { conta, backend, temAdmin }.
export async function detectarConta() {
  const claude = await contaClaude().catch(() => null);
  if (claude) return { conta: claude, backend: null };
  const backend = await descobrirBackend();
  if (backend) {
    const salvo = lerJSON(CHAVE_TOKEN);
    if (salvo?.token && salvo.tipo === backend.tipo) {
      try {
        const eu = await backend.eu(salvo.token);
        return { conta: contaDoBackend(backend, salvo.token, eu), backend };
      } catch { ls.del(CHAVE_TOKEN); }
    }
    let temAdmin = true;
    try { temAdmin = (await backend.status())?.temAdmin !== false; } catch { /* segue */ }
    return { conta: contaLocal(), backend, temAdmin };
  }
  return { conta: contaLocal(), backend: null };
}

export async function entrar(backend, { nome, senha, convite, criar }) {
  const r = criar ? await backend.cadastrar(nome, senha, convite) : await backend.entrar(nome, senha);
  ls.set(CHAVE_TOKEN, JSON.stringify({ token: r.token, tipo: backend.tipo }));
  return contaDoBackend(backend, r.token, r);
}

export function convidado() {
  return contaLocal();
}

// Cópia local de segurança de qualquer conta (se a rede cair, o progresso não some).
export function backupLocal(conta, perfil) {
  ls.set(`${CHAVE_LOCAL}.${conta.tipo}.${conta.nome}`, JSON.stringify(perfil));
}
export function lerBackupLocal(conta) {
  return lerJSON(`${CHAVE_LOCAL}.${conta.tipo}.${conta.nome}`);
}
