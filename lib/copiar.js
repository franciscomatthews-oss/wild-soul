'use client';

import { FORMATOS } from './catalogo.js';

const escapar = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const celdaMd = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');

export function textoPlano(fila) {
  const piezas = fila.guion?.piezas || [];
  const lineas = [`${fila.titulo} (${FORMATOS[fila.formato] || ''} · ${fila.eje || ''})`, ''];
  piezas.forEach((p, i) => {
    lineas.push(`${i + 1}. ${p.pieza}`);
    lineas.push(`Voz: ${p.voz}`);
    if (p.visual) lineas.push(`Visual: ${p.visual}`);
    if (p.fuente_url) lineas.push(`Fuente: ${p.fuente_url}`);
    lineas.push('');
  });
  return lineas.join('\n').trim();
}

function tablaNotion(fila) {
  const piezas = fila.guion?.piezas || [];
  const filas = piezas
    .map(
      (p) =>
        `<tr><td>${escapar(p.pieza)}</td><td>${escapar(p.voz)}</td><td>${escapar(p.visual)}</td><td>${
          p.fuente_url ? `<a href="${escapar(p.fuente_url)}">${escapar(p.fuente_titulo || p.fuente_url)}</a>` : ''
        }</td></tr>`
    )
    .join('');
  const html = `<h3>${escapar(fila.titulo)}</h3><table><tr><th>Pieza</th><th>Voz</th><th>Visual</th><th>Fuente</th></tr>${filas}</table>`;
  const md = [
    `### ${fila.titulo}`,
    '',
    '| Pieza | Voz | Visual | Fuente |',
    '|---|---|---|---|',
    ...piezas.map((p) => `| ${celdaMd(p.pieza)} | ${celdaMd(p.voz)} | ${celdaMd(p.visual)} | ${celdaMd(p.fuente_url)} |`),
  ].join('\n');
  return { html, md };
}

export async function copiarTexto(fila) {
  await navigator.clipboard.writeText(textoPlano(fila));
}

export async function copiarParaNotion(fila) {
  const { html, md } = tablaNotion(fila);
  if (window.ClipboardItem) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([md], { type: 'text/plain' }),
      }),
    ]);
  } else {
    await navigator.clipboard.writeText(md);
  }
}
