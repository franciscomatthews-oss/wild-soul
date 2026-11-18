import test from 'node:test';
import assert from 'node:assert/strict';
import { validarGuion, hayBloqueos } from '../lib/validar.js';
import { PIEZAS_UGC } from '../lib/catalogo.js';

const ugcBase = () => ({
  formato: 'ugc',
  eje: 'Bienestar por dentro',
  piezas: PIEZAS_UGC.map((pieza, i) => ({
    pieza,
    voz: `Texto de ${pieza}`,
    visual: 'Persona a cámara',
    fuente_url: [2, 4, 6].includes(i) ? `https://ejemplo.cl/dato-${i}` : '',
    cierra_bucle: i === 4 || i === 6,
  })),
});
const fuentes = ['https://ejemplo.cl/dato-2', 'https://ejemplo.cl/dato-4', 'https://ejemplo.cl/dato-6'];

test('un UGC correcto pasa sin bloqueos', () => {
  const alertas = validarGuion(ugcBase(), { fuentesPermitidas: fuentes });
  assert.equal(hayBloqueos(alertas), false, JSON.stringify(alertas));
});

test('un cuerpo sin fuente bloquea', () => {
  const g = ugcBase();
  g.piezas[4].fuente_url = '';
  const alertas = validarGuion(g, { fuentesPermitidas: fuentes });
  assert.ok(alertas.some((a) => a.codigo === 'fuente_falta' && a.bloquea));
});

test('una fuente que no salió de la búsqueda bloquea', () => {
  const g = ugcBase();
  g.piezas[6].fuente_url = 'https://inventada.cl';
  const alertas = validarGuion(g, { fuentesPermitidas: fuentes });
  assert.ok(alertas.some((a) => a.codigo === 'fuente_no_verificada'));
});

test('piezas fuera de orden bloquean', () => {
  const g = ugcBase();
  [g.piezas[0], g.piezas[1]] = [g.piezas[1], g.piezas[0]];
  assert.ok(validarGuion(g, { fuentesPermitidas: fuentes }).some((a) => a.codigo === 'ugc_orden'));
});

test('un bucle sin cerrar bloquea', () => {
  const g = ugcBase();
  g.piezas[4].cierra_bucle = false;
  assert.ok(validarGuion(g, { fuentesPermitidas: fuentes }).some((a) => a.codigo === 'bucle_abierto'));
});

test('"sin azúcar" bloquea pero "sin azúcar añadida" no', () => {
  const g = { formato: 'video_corto', eje: 'Receta abierta', piezas: [{ pieza: 'Gancho', voz: 'Es sin azúcar', visual: '' }] };
  assert.ok(validarGuion(g).some((a) => a.codigo === 'frase_prohibida'));
  g.piezas[0].voz = 'Endulzada con dátiles, sin azúcar añadida';
  assert.equal(validarGuion(g).some((a) => a.codigo === 'frase_prohibida'), false);
});

test('promesas médicas y tono prohibido bloquean', () => {
  const g = { formato: 'video_corto', eje: 'Receta abierta', piezas: [{ pieza: 'Gancho', voz: 'Te ayuda a adelgazar, sin excusas', visual: '' }] };
  const codigos = validarGuion(g).filter((a) => a.codigo === 'frase_prohibida');
  assert.equal(codigos.length, 2);
});

test('un video corto muy largo avisa sin bloquear', () => {
  const voz = Array(100).fill('palabra').join(' ');
  const alertas = validarGuion({ formato: 'video_corto', eje: 'Tribu Soul', piezas: [{ pieza: 'A', voz, visual: '' }] });
  assert.ok(alertas.some((a) => a.codigo === 'largo' && !a.bloquea));
});

test('un carrusel de 4 láminas avisa', () => {
  const piezas = Array.from({ length: 4 }, (_, i) => ({ pieza: `Lámina ${i + 1}`, voz: 'texto', visual: '' }));
  const alertas = validarGuion({ formato: 'carrusel', eje: 'Receta abierta', piezas });
  assert.ok(alertas.some((a) => a.codigo === 'carrusel_largo'));
});
