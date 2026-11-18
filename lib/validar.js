import { FORMATOS, EJES, PIEZAS_UGC } from './catalogo.js';
import { FRASES_PROHIBIDAS } from './reglas.js';

const normalizar = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const contarPalabras = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/**
 * Revisa un guion contra las reglas que se pueden comprobar con código.
 * @param {object} g  { formato, eje, piezas: [{pieza, voz, visual, fuente_url, cierra_bucle}] }
 * @param {object} opciones  { fuentesPermitidas: string[] | null }
 * @returns {Array<{codigo:string, mensaje:string, bloquea:boolean, pieza?:number}>}
 */
export function validarGuion(g, opciones = {}) {
  const alertas = [];
  const agregar = (codigo, mensaje, bloquea = true, pieza) =>
    alertas.push({ codigo, mensaje, bloquea, ...(pieza !== undefined ? { pieza } : {}) });

  if (!g || !Array.isArray(g.piezas) || g.piezas.length === 0) {
    agregar('sin_piezas', 'El guion no tiene piezas.');
    return alertas;
  }
  if (!FORMATOS[g.formato]) agregar('formato', 'El formato no es válido.');
  if (!EJES.includes(g.eje)) agregar('eje', 'El eje temático no es válido.', false);

  g.piezas.forEach((p, i) => {
    if (!String(p.voz || '').trim()) agregar('pieza_vacia', `La pieza ${i + 1} no tiene texto.`, true, i);
  });

  if (g.formato === 'ugc') {
    if (g.piezas.length !== PIEZAS_UGC.length) {
      agregar('ugc_piezas', `Un UGC lleva ${PIEZAS_UGC.length} piezas y este tiene ${g.piezas.length}.`);
    } else {
      PIEZAS_UGC.forEach((nombre, i) => {
        if (!normalizar(g.piezas[i].pieza).startsWith(normalizar(nombre))) {
          agregar('ugc_orden', `La pieza ${i + 1} debería ser "${nombre}".`, true, i);
        }
      });
      const permitidas = Array.isArray(opciones.fuentesPermitidas) ? new Set(opciones.fuentesPermitidas) : null;
      [2, 4, 6].forEach((i) => {
        const url = String(g.piezas[i].fuente_url || '').trim();
        if (!url) agregar('fuente_falta', `${PIEZAS_UGC[i]} no tiene fuente.`, true, i);
        else if (permitidas && !permitidas.has(url)) {
          agregar('fuente_no_verificada', `La fuente de ${PIEZAS_UGC[i]} no salió de la búsqueda. Revísala antes de aprobar.`, true, i);
        }
      });
      [4, 6].forEach((i) => {
        if (!g.piezas[i].cierra_bucle) agregar('bucle_abierto', `${PIEZAS_UGC[i]} no cierra el bucle anterior.`, true, i);
      });
    }
  }

  if (g.formato === 'carrusel' && (g.piezas.length < 6 || g.piezas.length > 8)) {
    agregar('carrusel_largo', `Un carrusel lleva de 6 a 8 láminas y este tiene ${g.piezas.length}.`, false);
  }

  const palabras = g.piezas.reduce((n, p) => n + contarPalabras(p.voz), 0);
  if (g.formato === 'video_corto' && palabras > 90) {
    agregar('largo', `Tiene ${palabras} palabras: es largo para un video de 15 a 30 segundos.`, false);
  }
  if (g.formato === 'video_juanita' && palabras > 170) {
    agregar('largo', `Tiene ${palabras} palabras: es largo para un video de 30 a 60 segundos.`, false);
  }

  g.piezas.forEach((p, i) => {
    const texto = `${p.voz || ''} ${p.visual || ''}`;
    FRASES_PROHIBIDAS.forEach(({ patron, motivo }) => {
      if (patron.test(texto)) agregar('frase_prohibida', `Pieza ${i + 1}: ${motivo}`, true, i);
    });
  });

  return alertas;
}

export const hayBloqueos = (alertas) => (alertas || []).some((a) => a.bloquea);
