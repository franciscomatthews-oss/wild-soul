import 'server-only';
import { FORMATOS, EJES, PIEZAS_UGC } from './catalogo.js';
import { REGLAS_SOUL } from './reglas.js';
import { validarGuion, hayBloqueos } from './validar.js';

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const PRECIOS = {
  entrada: num(process.env.PRECIO_ENTRADA_MILLON, 2) / 1e6,
  salida: num(process.env.PRECIO_SALIDA_MILLON, 10) / 1e6,
  busqueda: num(process.env.PRECIO_BUSQUEDA, 0.01),
  minutoAudio: num(process.env.PRECIO_MINUTO_AUDIO, 0.006),
};

export const GLOSARIO = 'Wild Soul, Soul Bar, Wild Foods, Juanita Ringeling, maqui, chía, dátiles, Cachagua, Nut Bar, cacao nibs, cranberry.';

// ---------- Transcripción (OpenAI) ----------

export async function transcribir(blob, nombre = 'audio.wav') {
  const form = new FormData();
  form.append('file', blob, nombre);
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe');
  form.append('language', 'es');
  form.append('response_format', 'json');
  form.append('prompt', `Video de redes sociales en español de Chile. Nombres que pueden aparecer: ${GLOSARIO}`);

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!r.ok) {
    const detalle = await r.text();
    throw new Error(`La transcripción falló (${r.status}): ${detalle.slice(0, 300)}`);
  }
  const datos = await r.json();
  return { texto: String(datos.text || '').trim() };
}

export const costoAudio = (segundos) => (num(segundos, 0) / 60) * PRECIOS.minutoAudio;

// ---------- Claude ----------

async function llamarClaude(cuerpo) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', ...cuerpo }),
  });
  if (!r.ok) {
    const detalle = await r.text();
    throw new Error(`Claude respondió ${r.status}: ${detalle.slice(0, 300)}`);
  }
  return r.json();
}

function costoDe(respuesta) {
  const u = respuesta?.usage || {};
  return (
    num(u.input_tokens, 0) * PRECIOS.entrada +
    num(u.cache_read_input_tokens, 0) * PRECIOS.entrada +
    num(u.output_tokens, 0) * PRECIOS.salida +
    num(u.server_tool_use?.web_search_requests, 0) * PRECIOS.busqueda
  );
}

const HERRAMIENTA_GUION = {
  name: 'entregar_guion',
  description: 'Entrega el guion terminado para Wild Soul.',
  input_schema: {
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

Entrega siempre el resultado llamando a la herramienta entregar_guion. Todo claim que uses va en la lista claims. No inventes datos, cifras ni experiencias de personas.`;

const INSTRUCCION_REFERENTE = `Te paso un referente de otra cuenta. Puede ser un video (transcripción de la voz y algunos cuadros) o un carrusel (capturas de cada lámina en orden).
1. En texto_referente escribe la transcripción literal limpia: corrige por contexto errores obvios de nombres (por ejemplo "solo bar" es Soul Bar) y agrega el texto en pantalla que se vea en los cuadros. En carruseles, el texto de cada lámina en orden ("Lámina 1: ..."). Si una palabra es dudosa, márcala con [?].
2. En que_funciona explica qué vale la pena replicar.
3. Elige el formato para Wild Soul: un carrusel se adapta como carrusel. Un video se adapta como video_juanita si el referente es una persona hablando a cámara para explicar algo; si no, como video_corto.
4. Elige el eje temático que mejor calce.
5. Escribe el guion nuevo para Wild Soul adaptando la estructura, nunca copiando el texto. En videos, una pieza por escena en orden (por ejemplo Gancho, Desarrollo, Cierre y CTA) con voz y visual. En carruseles, una pieza por lámina ("Lámina 1 (portada)", ...).`;

function extraerGuion(respuesta) {
  const bloque = (respuesta.content || []).find((b) => b.type === 'tool_use' && b.name === 'entregar_guion');
  if (!bloque) throw new Error('Claude no entregó el guion en el formato esperado.');
  return { bloque, guion: bloque.input };
}

async function escribirConReintento({ mensajes, fuentesPermitidas }) {
  let costo = 0;
  const base = {
    max_tokens: 6000,
    temperature: 0.4,
    system: SISTEMA_GUION,
    tools: [HERRAMIENTA_GUION],
    tool_choice: { type: 'tool', name: 'entregar_guion' },
  };

  const r1 = await llamarClaude({ ...base, messages: mensajes });
  costo += costoDe(r1);
  const { bloque, guion: g1 } = extraerGuion(r1);
  const alertas1 = validarGuion(g1, { fuentesPermitidas });
  if (!hayBloqueos(alertas1)) return { guion: g1, alertas: alertas1, costo };

  const problemas = alertas1.filter((a) => a.bloquea).map((a) => `- ${a.mensaje}`).join('\n');
  const r2 = await llamarClaude({
    ...base,
    messages: [
      ...mensajes,
      { role: 'assistant', content: r1.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: bloque.id,
            is_error: true,
            content: `El guion tiene estos problemas:\n${problemas}\nCorrígelos y vuelve a entregarlo completo con entregar_guion.`,
          },
        ],
      },
    ],
  });
  costo += costoDe(r2);
  const { guion: g2 } = extraerGuion(r2);
  return { guion: g2, alertas: validarGuion(g2, { fuentesPermitidas }), costo };
}

// ---------- Referentes ----------

export async function guionDesdeReferente({ tipo, transcripcion, imagenes, nombreArchivo }) {
  const contenido = [
    { type: 'text', text: INSTRUCCION_REFERENTE },
    { type: 'text', text: `Archivo: ${nombreArchivo || 'sin nombre'}. Tipo: ${tipo === 'carrusel' ? 'carrusel' : 'video'}.` },
  ];
  if (tipo !== 'carrusel') {
    contenido.push({ type: 'text', text: `Transcripción automática de la voz:\n${transcripcion || '(el video no tiene voz)'}` });
  }
  (imagenes || []).forEach((img, i) => {
    contenido.push({ type: 'text', text: tipo === 'carrusel' ? `Lámina ${i + 1}:` : `Cuadro ${i + 1}:` });
    contenido.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } });
  });
  return escribirConReintento({ mensajes: [{ role: 'user', content: contenido }], fuentesPermitidas: null });
}

// ---------- UGC ----------

async function investigarProducto(producto) {
  let costo = 0;
  const fuentes = new Map();
  const mensajes = [
    {
      role: 'user',
      content: `Producto de Wild Soul: ${producto}.
Investiga para un video UGC y entrega notas con 6 a 10 datos concretos y verificables, cada uno con la URL exacta de donde lo sacaste:
1. La ficha del producto en thewildfoods.com: ingredientes, formato y claims de la etiqueta.
2. Evidencia sobre el ingrediente clave (fibra, dátiles, maqui, chía u otro que tenga el producto), idealmente estudios o fuentes de salud reconocidas.
3. Opiniones o reviews de clientes si existen.
4. Datos de la categoría de snacks saludables o de consumo de fibra, idealmente de Chile.
No inventes nada. Si no encuentras algo, dilo.`,
    },
  ];
  const herramientas = [
    { type: process.env.ANTHROPIC_WEB_SEARCH_TOOL || 'web_search_20250305', name: 'web_search', max_uses: 6 },
  ];

  let notas = '';
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    const r = await llamarClaude({ max_tokens: 4000, temperature: 0.2, tools: herramientas, messages: mensajes });
    costo += costoDe(r);
    for (const b of r.content || []) {
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        b.content.forEach((res) => res?.url && fuentes.set(res.url, res.title || res.url));
      }
      if (b.type === 'text') {
        notas += b.text;
        (b.citations || []).forEach((c) => c?.url && fuentes.set(c.url, c.title || c.url));
      }
    }
    if (r.stop_reason !== 'pause_turn') break;
    mensajes.push({ role: 'assistant', content: r.content });
  }
  return { notas: notas.trim(), fuentes: [...fuentes].map(([url, titulo]) => ({ url, titulo })), costo };
}

export async function guionUGC({ producto }) {
  const inv = await investigarProducto(producto);
  const listaFuentes = inv.fuentes.map((f, i) => `${i + 1}. ${f.titulo} | ${f.url}`).join('\n') || '(sin fuentes)';
  const contenido = `Escribe un guion UGC para Wild Soul sobre: ${producto}.

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
    mensajes: [{ role: 'user', content: contenido }],
    fuentesPermitidas: inv.fuentes.map((f) => f.url),
  });
  return { ...escrito, costo: escrito.costo + inv.costo, fuentes: inv.fuentes, notas: inv.notas };
}
