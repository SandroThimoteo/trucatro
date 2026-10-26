import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ARQUIVOS_DADOS, montarDados } from '../src/core/dados.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOVOS = ['marcador_de_giz', 'torcedor_sofredor', 'brigao_da_esquina', 'tecnico_da_varzea', 'rei_da_sinuca'];

function lerRaw() {
  const raw = {};
  for (const nome of ARQUIVOS_DADOS) raw[nome] = JSON.parse(readFileSync(join(raiz, 'data', `${nome}.json`), 'utf8'));
  return raw;
}

test('montarDados: com falas-comparsas, dados.falasComparsas tem os 5 Comparsas novos', () => {
  const dados = montarDados(lerRaw());
  for (const id of NOVOS) {
    const falas = dados.falasComparsas[id];
    assert.ok(Array.isArray(falas) && falas.length > 0, `${id} tem falas`);
    for (const f of falas) {
      assert.equal(typeof f, 'string');
      assert.ok(f.length > 0 && f.length <= 40, `${id}: fala curta (${f})`);
    }
    assert.ok(dados.comparsasPorId[id], `${id} existe em comparsas.json`);
  }
  // toda entrada de fala aponta para um Comparsa que existe
  for (const id of Object.keys(dados.falasComparsas)) assert.ok(dados.comparsasPorId[id], `fala de Comparsa inexistente: ${id}`);
});

test('montarDados: sem a chave falas-comparsas, dados.falasComparsas é {}', () => {
  const raw = lerRaw();
  delete raw['falas-comparsas'];
  const dados = montarDados(raw);
  assert.deepEqual(dados.falasComparsas, {});
  assert.ok(dados.comparsasPorId.marcador_de_giz, 'o resto continua carregando');
});
