import 'server-only';
import { FORMATOS, EJES, PIEZAS_UGC } from './catalogo.js';
import { REGLAS_SOUL } from './reglas.js';
import { validarGuion, hayBloqueos } from './validar.js';

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const PRECIOS = {
  entrada: num(process.env.PRECIO_ENTRADA_MILLON, 2) / 1e6,
  salida: num(process.env.PRECIO_SALIDA_MILLON, 10) / 1e6,
  busqueda: num(process.env.PRECIO_BUSQUEDA, 0.01),
};

export const GLOSARIO = 'Wild Soul, Soul Bar, Wild Foods, Juanita Ringeling, maqui, chía, dátiles, Cachagua, Nut Bar, cacao nibs, cranberry.';

const MODELO = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ENDPOINT = (metodo) => `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:${metodo}?key=${process.env.GEMINI_API_KEY}`;

async function llamarGemini(cuerpo) {
  const r = await fetch(ENDPOINT('generateContent'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) {
    const detalle = await r.text();
    throw new Error(`Gemini respondió ${r.status}: ${detalle.slice(0, 300)}`);
  }
  return r.json();
}

function costoDe(respuesta) {
  const u = respuesta?.usageMetadata || {};
  return num(u.promptTokenCount, 0) * PRECIOS.entrada + num(u.candidatesTokenCount, 0) * PRECIOS.salida;
}

function partesDe(respuesta) {
  return respuesta?.candidates?.[0]?.content?.parts || [];
}

// ---------- Transcripción ----------

export async function transcribir(blob, nombre = 'audio.wav') {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const cuerpo = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Transcribe literalmente el audio de este video de redes sociales en español de Chile. Corrige por contexto errores obvios de nombres propios (por ejemplo "solo bar" es "Soul Bar"). Nombres que pueden aparecer: ${GLOSARIO}. Devuelve solo el texto transcrito, sin comentarios ni formato adicional. Si el audio no tiene voz, responde con un texto vacío.`,
          },
          { inline_data: { mime_type: blob.type || 'audio/wav', data: buffer.toString('base64') } },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };
  let r;
  try {
    r = await llamarGemini(cuerpo);
  } catch (e) {
    throw new Error(`La transcripción falló: ${e.message}`);
  }
  const texto = partesDe(r).map((p) => p.text || '').join('').trim();
  return { texto, costo: costoDe(r) };
}

// ---------- Guion (Gemini function calling) ----------

const HERRAMIENTA_GUION = {
  name: 'entregar_guion',
  description: 'Entrega el guion terminado para Wild Soul.',
  parameters: {
    type: 'object',
    properties: {
      titulo: { type: 'string', description: 'Título corto del guion, en español.' },
      formato: { type: 'string', enum: Object.keys(FORMATOS) },
      eje: { type: 'string', enum: EJES },
      texto_referente: {
        type: 'string',
        description: 'Solo referentes: transcripción literal limpia de la voz y del texto en pantalla, o el texto de cada lámina en orden.',
      },
      que_funciona: { type: 'string', description: 'Dos o tres líneas sobre el gancho, el ritmo y el recurso que vale la pena replicar (o, en UGC, por qué este ángulo funciona).' },
      piezas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pieza: { type: 'string', description: 'Nombre de la pieza o lámina.' },
            voz: { type: 'string', description: 'Lo que se dice, o el texto de la lámina.' },
            visual: { type: 'string', description: 'Qué se ve: plano, acción, texto en pantalla.' },
            fuente_url: { type: 'string', description: 'URL exacta de la fuente del dato, si la pieza usa un dato.' },
            fuente_titulo: { type: 'string' },
            cierra_bucle: { type: 'boolean', description: 'UGC: true en el cuerpo que cierra el bucle anterior.' },
          },
          required: ['pieza', 'voz', 'visual'],
        },
      },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            texto: { type: 'string' },
            tipo: { type: 'string', enum: ['permitido', 'a_validar'] },
          },
          required: ['texto', 'tipo'],
        },
      },
      datos_faltantes: { type: 'array', items: { type: 'string' }, description: 'Lo que falta confirmar antes de grabar.' },
    },
    required: ['titulo', 'formato', 'eje', 'que_funciona', 'piezas', 'claims'],
  },
};

const SISTEMA_GUION = `Eres el equipo de contenido de Wild Soul. Escribes guiones listos para grabar o diseñar, en español de Chile, siguiendo estas reglas al pie de la letra:

${REGLAS_SOUL}

Entrega siempre el resultado llamando a la función entregar_guion. Todo claim que uses va en la lista claims. No inventes datos, cifras ni experiencias de personas.`;

const INSTRUCCION_REFERENTE = `Te paso un referente de otra cuenta. Puede ser un video (transcripción de la voz y algunos cuadros) o un carrusel (capturas de cada lámina en orden).
1. En texto_referente escribe la transcripción literal limpia: corrige por contexto errores obvios de nombres (por ejemplo "solo bar" es Soul Bar) y agrega el texto en pantalla que se vea en los cuadros. En carruseles, el texto de cada lámina en orden ("Lámina 1: ..."). Si una palabra es dudosa, márcala con [?].
2. En que_funciona explica qué vale la pena replicar.
3. Elige el formato para Wild Soul: un carrusel se adapta como carrusel. Un video se adapta como video_juanita si el referente es una persona hablando a cámara para explicar algo; si no, como video_corto.
4. Elige el eje temático que mejor calce.
5. Escribe el guion nuevo para Wild Soul adaptando la estructura, nunca copiando el texto. En videos, una pieza por escena en orden (por ejemplo Gancho, Desarrollo, Cierre y CTA) con voz y visual. En carruseles, una pieza por lámina ("Lámina 1 (portada)", ...).`;

function extraerGuion(respuesta) {
  const parte = partesDe(respuesta).find((p) => p.functionCall?.name === 'entregar_guion');
  if (!parte) throw new Error('Gemini no entregó el guion en el formato esperado.');
  return { parte, guion: parte.functionCall.args };
}

async function escribirConReintento({ contenidoUsuario, fuentesPermitidas }) {
  let costo = 0;
  const base = {
    system_instruction: { parts: [{ text: SISTEMA_GUION }] },
    tools: [{ function_declarations: [HERRAMIENTA_GUION] }],
    tool_config: { function_calling_config: { mode: 'ANY', allowed_function_names: ['entregar_guion'] } },
    generationConfig: { temperature: 0.4, maxOutputTokens: 6000 },
  };

  const contents1 = [{ role: 'user', parts: contenidoUsuario }];
  const r1 = await llamarGemini({ ...base, contents: contents1 });
  costo += costoDe(r1);
  const { parte, guion: g1 } = extraerGuion(r1);
  const alertas1 = validarGuion(g1, { fuentesPermitidas });
  if (!hayBloqueos(alertas1)) return { guion: g1, alertas: alertas1, costo };

  const problemas = alertas1.filter((a) => a.bloquea).map((a) => `- ${a.mensaje}`).join('\n');
  const contents2 = [
    ...contents1,
    { role: 'model', parts: partesDe(r1) },
    {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'entregar_guion',
            response: { error: `El guion tiene estos problemas:\n${problemas}\nCorrígelos y vuelve a entregarlo completo con entregar_guion.` },
          },
        },
      ],
    },
  ];
  const r2 = await llamarGemini({ ...base, contents: contents2 });
  costo += costoDe(r2);
  const { guion: g2 } = extraerGuion(r2);
  return { guion: g2, alertas: validarGuion(g2, { fuentesPermitidas }), costo };
}

// ---------- Referentes ----------

export async function guionDesdeReferente({ tipo, transcripcion, imagenes, nombreArchivo }) {
  const contenido = [
    { text: INSTRUCCION_REFERENTE },
    { text: `Archivo: ${nombreArchivo || 'sin nombre'}. Tipo: ${tipo === 'carrusel' ? 'carrusel' : 'video'}.` },
  ];
  if (tipo !== 'carrusel') {
    contenido.push({ text: `Transcripción automática de la voz:\n${transcripcion || '(el video no tiene voz)'}` });
  }
  (imagenes || []).forEach((img, i) => {
    contenido.push({ text: tipo === 'carrusel' ? `Lámina ${i + 1}:` : `Cuadro ${i + 1}:` });
    contenido.push({ inline_data: { mime_type: img.media_type, data: img.data } });
  });
  return escribirConReintento({ contenidoUsuario: contenido, fuentesPermitidas: null });
}

// ---------- UGC (Gemini con Google Search) ----------

async function investigarProducto(producto) {
  const cuerpo = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Producto de Wild Soul: ${producto}.
Investiga para un video UGC y entrega notas con 6 a 10 datos concretos y verificables, cada uno con la URL exacta de donde lo sacaste:
1. La ficha del producto en thewildfoods.com: ingredientes, formato y claims de la etiqueta.
2. Evidencia sobre el ingrediente clave (fibra, dátiles, maqui, chía u otro que tenga el producto), idealmente estudios o fuentes de salud reconocidas.
3. Opiniones o reviews de clientes si existen.
4. Datos de la categoría de snacks saludables o de consumo de fibra, idealmente de Chile.
No inventes nada. Si no encuentras algo, dilo.`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
  };

  const r = await llamarGemini(cuerpo);
  const notas = partesDe(r).map((p) => p.text || '').join('').trim();
  const fuentes = new Map();
  const chunks = r?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  chunks.forEach((c) => {
    const web = c?.web;
    if (web?.uri) fuentes.set(web.uri, web.title || web.uri);
  });
  return {
    notas,
    fuentes: [...fuentes].map(([url, titulo]) => ({ url, titulo })),
    costo: costoDe(r) + PRECIOS.busqueda,
  };
}

export async function guionUGC({ producto }) {
  const inv = await investigarProducto(producto);
  const listaFuentes = inv.fuentes.map((f, i) => `${i + 1}. ${f.titulo} | ${f.url}`).join('\n') || '(sin fuentes)';
  const texto = `Escribe un guion UGC para Wild Soul sobre: ${producto}.

Usa exactamente estas 8 piezas, con estos nombres y en este orden: ${PIEZAS_UGC.join(', ')}.
- formato: ugc.
- Cada cuerpo (Cuerpo 1, Cuerpo 2, Cuerpo 3) lleva un solo dato, de menos a más potente, con fuente_url copiada EXACTAMENTE de la lista de fuentes de abajo.
- Cuerpo 2 cierra el Bucle abierto 1 y Cuerpo 3 cierra el Bucle abierto 2: marca cierra_bucle en true en ambos.
- Un solo CTA, en la última pieza.
- En visual describe qué se ve (persona a cámara, producto, texto en pantalla).
- Si un dato de salud no tiene fuente sólida, no lo uses.

Notas de investigación:
${inv.notas || '(sin notas)'}

Fuentes disponibles (usa solo estas URLs):
${listaFuentes}`;

  const escrito = await escribirConReintento({
    contenidoUsuario: [{ text: texto }],
    fuentesPermitidas: inv.fuentes.map((f) => f.url),
  });
  return { ...escrito, costo: escrito.costo + inv.costo, fuentes: inv.fuentes, notas: inv.notas };
}
