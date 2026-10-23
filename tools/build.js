// Monta o site estático em _site/ (usado pelo GitHub Pages): node tools/build.js
// index.html é um fragmento (formato de Artifact); aqui ele ganha o esqueleto HTML completo.

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const saida = join(raiz, '_site');

const fragmento = await readFile(join(raiz, 'index.html'), 'utf8');
await rm(saida, { recursive: true, force: true });
await mkdir(saida, { recursive: true });
await cp(join(raiz, 'data'), join(saida, 'data'), { recursive: true });
await cp(join(raiz, 'src'), join(saida, 'src'), { recursive: true });
await writeFile(join(saida, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${fragmento}</body></html>`);
await writeFile(join(saida, '.nojekyll'), '');
console.log('Site pronto em _site/');
