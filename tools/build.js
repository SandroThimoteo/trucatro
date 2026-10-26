// Monta o site estático em _site/ (usado pelo GitHub Pages): node tools/build.js
// index.html é um fragmento (formato de Artifact); aqui ele ganha o esqueleto HTML completo.

import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const saida = join(raiz, '_site');

const fragmento = await readFile(join(raiz, 'index.html'), 'utf8');
await rm(saida, { recursive: true, force: true });
await mkdir(saida, { recursive: true });
await cp(join(raiz, 'data'), join(saida, 'data'), { recursive: true });
await cp(join(raiz, 'src'), join(saida, 'src'), { recursive: true });
await cp(join(raiz, 'assets'), join(saida, 'assets'), { recursive: true });
// Versão em todos os endereços: cada publicação força o navegador a baixar o CSS, os
// scripts e os dados novos, em vez de usar a cópia antiga guardada em cache.
const versao = (process.env.GITHUB_SHA ?? Date.now().toString(36)).slice(0, 10);
const comVersao = (url) => `${url}?v=${versao}`;
const scripts = async (pasta) => {
  for (const nome of await readdir(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, nome.name);
    if (nome.isDirectory()) await scripts(caminho);
    else if (nome.name.endsWith('.js')) {
      let t = await readFile(caminho, 'utf8');
      t = t.replace(/(from\s+|import\(\s*)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g, (_, a, q, url) => `${a}${q}${comVersao(url)}${q}`);
      t = t.replace('fetch(`data/${nome}.json`)', `fetch(\`data/\${nome}.json?v=${versao}\`)`);
      await writeFile(caminho, t);
    }
  }
};
await scripts(join(saida, 'src'));
const pagina = fragmento
  .replace('href="src/ui/estilo.css"', `href="${comVersao('src/ui/estilo.css')}"`)
  .replace('src="src/ui/main.js"', `src="${comVersao('src/ui/main.js')}"`);
await writeFile(join(saida, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${pagina}</body></html>`);
await writeFile(join(saida, '.nojekyll'), '');
console.log('Site pronto em _site/');
