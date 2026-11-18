'use client';

import { LIMITES } from './catalogo.js';

const esImagen = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name);
const esVideo = (f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name);

/** Decide si lo que soltaron es un video o un carrusel. Lanza un Error con un mensaje para el usuario. */
export function detectarTipo(archivos) {
  const lista = [...archivos];
  if (lista.length === 0) throw new Error('No llegó ningún archivo.');
  if (lista.every(esImagen)) {
    if (lista.length > LIMITES.imagenes) throw new Error(`Un carrusel puede tener hasta ${LIMITES.imagenes} capturas.`);
    return 'carrusel';
  }
  if (lista.length === 1 && esVideo(lista[0])) return 'video';
  if (lista.some(esVideo) && lista.length > 1) throw new Error('Sube un video a la vez.');
  throw new Error('Formato no soportado. Sube un MP4 o MOV, o capturas JPG o PNG.');
}

/** Ordena capturas por el número que traigan en el nombre (captura 2 antes que captura 10). */
export function ordenarCapturas(archivos) {
  return [...archivos].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
}

const aBase64 = (canvas, calidad = 0.75) => canvas.toDataURL('image/jpeg', calidad).split(',')[1];

function dibujar(fuente, anchoOriginal, altoOriginal, maximo) {
  const escala = Math.min(1, maximo / Math.max(anchoOriginal, altoOriginal));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(anchoOriginal * escala);
  canvas.height = Math.round(altoOriginal * escala);
  canvas.getContext('2d').drawImage(fuente, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Reduce cada captura a 1024 px como máximo y la devuelve en base64. */
export async function procesarImagenes(archivos) {
  const salida = [];
  for (const archivo of ordenarCapturas(archivos)) {
    const bitmap = await createImageBitmap(archivo).catch(() => {
      throw new Error(`No pudimos abrir ${archivo.name}. Prueba con JPG o PNG.`);
    });
    const canvas = dibujar(bitmap, bitmap.width, bitmap.height, 1024);
    salida.push({ media_type: 'image/jpeg', data: aBase64(canvas, 0.8) });
  }
  return salida;
}

function codificarWav(muestras, frecuencia) {
  const buffer = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(buffer);
  const texto = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  texto(0, 'RIFF');
  v.setUint32(4, 36 + muestras.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, frecuencia, true);
  v.setUint32(28, frecuencia * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, muestras.length * 2, true);
  for (let i = 0; i < muestras.length; i += 1) {
    const s = Math.max(-1, Math.min(1, muestras[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Saca el audio del video en mono a 16 kHz. Devuelve null si el video no tiene audio legible. */
async function extraerAudio(archivo) {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  const ctx = new Contexto();
  try {
    const decodificado = await ctx.decodeAudioData(await archivo.arrayBuffer());
    const frecuencia = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(decodificado.duration * frecuencia), frecuencia);
    const fuente = offline.createBufferSource();
    fuente.buffer = decodificado;
    fuente.connect(offline.destination);
    fuente.start();
    const render = await offline.startRendering();
    return { wav: codificarWav(render.getChannelData(0), frecuencia), duracion: decodificado.duration };
  } catch {
    return null;
  } finally {
    ctx.close();
  }
}

/** Saca hasta 15 cuadros repartidos en el video. Devuelve [] si Chrome no puede reproducirlo. */
async function extraerCuadros(archivo) {
  const url = URL.createObjectURL(archivo);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise((ok, mal) => {
      const t = setTimeout(() => mal(new Error('tiempo')), 10000);
      video.onloadeddata = () => { clearTimeout(t); ok(); };
      video.onerror = () => { clearTimeout(t); mal(new Error('codec')); };
    });
    const duracion = video.duration;
    if (!Number.isFinite(duracion) || duracion <= 0) return { cuadros: [], duracion: 0 };
    const cantidad = Math.min(LIMITES.cuadros, Math.max(1, Math.ceil(duracion / 2)));
    const cuadros = [];
    for (let i = 0; i < cantidad; i += 1) {
      const momento = Math.min(duracion - 0.05, (i + 0.5) * (duracion / cantidad));
      await new Promise((ok) => {
        video.onseeked = () => ok();
        video.currentTime = momento;
      });
      const canvas = dibujar(video, video.videoWidth, video.videoHeight, 512);
      cuadros.push({ media_type: 'image/jpeg', data: aBase64(canvas, 0.7) });
    }
    return { cuadros, duracion };
  } catch {
    return { cuadros: [], duracion: 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Prepara un video para enviarlo: audio en WAV y cuadros en JPEG.
 * @returns {{ wav: Blob|null, duracion: number, cuadros: Array, avisos: string[] }}
 */
export async function procesarVideo(archivo, alAvanzar = () => {}) {
  alAvanzar('Leyendo el audio');
  const audio = await extraerAudio(archivo);
  const duracionAudio = audio?.duracion || 0;
  if (duracionAudio > LIMITES.videoSegundos) {
    throw new Error(`El video dura ${Math.round(duracionAudio)} segundos y el máximo es ${LIMITES.videoSegundos}.`);
  }
  alAvanzar('Sacando cuadros del video');
  const { cuadros, duracion } = await extraerCuadros(archivo);
  if (!audio && cuadros.length === 0) {
    throw new Error('No pudimos leer este video. Prueba con un MP4 o con una grabación de pantalla.');
  }
  const avisos = [];
  if (!audio) avisos.push('El video no tiene audio legible: el guion se basa solo en los cuadros.');
  if (cuadros.length === 0) avisos.push('Chrome no pudo mostrar los cuadros de este video: el guion se basa solo en el audio.');
  return { wav: audio?.wav || null, duracion: duracionAudio || duracion, cuadros, avisos };
}
