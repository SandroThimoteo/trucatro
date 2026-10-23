// Cena de entrada dos Chefões: o boteco dele (renderizado no Blender, tools/blender/cenarios.py),
// faixas de cinema, a lâmpada piscando, o Chefão saindo do escuro e três falas com voz.
// Toque avança a fala; "Pular" fecha a cena.

import { esc } from './componentes.js';
import { audio } from './audio.js';

const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function urlCenario(id) {
  // absoluta: dentro de var(--cenario) um caminho relativo seria lido a partir da pasta do CSS
  return new URL(`assets/cenarios/${id}.jpg`, document.baseURI).href;
}

// pessoa: personagem do Chefão · bairro: número · vozDe: voz pt-BR do personagem
export function cenaChefao(pessoa, { bairro, nomeBairro, final = false }) {
  return new Promise((fim) => {
    const linhas = pessoa.falas?.intro?.length ? pessoa.falas.intro : [pessoa.bio];
    const el = document.createElement('div');
    el.className = `cena ${final ? 'final' : ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `${pessoa.nome} entra no boteco`);
    el.innerHTML = `
      <div class="cena-fundo" style="background-image:url('${urlCenario(`chefe_${pessoa.id}`)}')"></div>
      <div class="cena-luz" aria-hidden="true"></div>
      <div class="cena-faixa topo" aria-hidden="true"></div>
      <div class="cena-faixa base" aria-hidden="true"></div>
      <div class="cena-conteudo">
        <div class="cena-rotulo">${final ? 'Chefão final' : 'Chefão'} · Bairro ${bairro} · ${esc(nomeBairro)}</div>
        <div class="cena-chefe" aria-hidden="true">${esc(pessoa.avatar)}</div>
        <h2 class="cena-nome">${esc(pessoa.nome)}</h2>
        <div class="cena-titulo">${esc(pessoa.titulo)}</div>
        <p class="cena-fala" aria-live="polite"></p>
        <div class="cena-regra"><b>Manha:</b> ${esc(pessoa.regra)}</div>
      </div>
      <button type="button" class="btn fantasma peq cena-pular">Pular cena</button>
      <div class="cena-dica">Toque para continuar</div>`;
    document.body.appendChild(el);
    audio.tocar('truco');

    const fala = el.querySelector('.cena-fala');
    let i = -1;
    let digitando = null;
    let fechado = false;

    function fechar() {
      if (fechado) return;
      fechado = true;
      clearInterval(digitando);
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      el.classList.add('saindo');
      setTimeout(() => { el.remove(); fim(); }, reduzido ? 0 : 450);
    }

    function proxima() {
      if (digitando) {
        // primeiro toque completa a frase que está sendo escrita
        clearInterval(digitando);
        digitando = null;
        fala.textContent = linhas[i];
        return;
      }
      i++;
      if (i >= linhas.length) {
        el.classList.add('mostra-regra');
        audio.tocar('total');
        if (i > linhas.length) fechar();
        return;
      }
      const texto = linhas[i];
      audio.falar(texto, pessoa.voz ?? {});
      audio.tocar('carta');
      fala.textContent = '';
      let n = 0;
      digitando = setInterval(() => {
        n++;
        fala.textContent = texto.slice(0, n);
        if (n >= texto.length) { clearInterval(digitando); digitando = null; }
      }, reduzido ? 0 : 28);
    }

    el.querySelector('.cena-pular').addEventListener('click', (e) => { e.stopPropagation(); fechar(); });
    el.addEventListener('click', proxima);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fechar();
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); proxima(); }
    });
    el.tabIndex = -1;
    el.focus();
    setTimeout(proxima, reduzido ? 0 : 1300);
  });
}
