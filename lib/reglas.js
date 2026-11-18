// Reglas de marca de Wild Soul. Este archivo es la fuente única de verdad:
// cuando cambie algo de la marca, edita aquí y sube la versión.

export const REGLAS_VERSION = '2026-11-18.1';

export const REGLAS_SOUL = `
# Wild Soul: reglas de marca para guiones

## Qué es Wild Soul
Marca hermana de Wild Foods enfocada en el wellness accesible y sin complicaciones. Rompe con la idea de que "para ser fit hay que sufrir". Nació en 2015 con Juanita Ringeling y la primera Soul Bar crudo-vegana. Es transparente y humana, simple, conectada con el origen e inclusiva.

## Territorio
Bienestar simple y natural, con la fibra como beneficio principal. La proteína es territorio de Wild Foods: no se usa como mensaje de Wild Soul.

## Público
Principalmente mujeres de 25 a 41 años de Santiago, organizadas, que leen etiquetas, evitan el azúcar y los endulzantes, hacen deporte 2 o 3 veces por semana y usan mucho Instagram. Muchas son intolerantes a la lactosa y pocas son veganas. Queremos abrirnos también a hombres y a gente de más edad.

## Ejes temáticos (elige uno)
- Receta abierta: qué tiene la barra, cómo leer etiquetas, endulzado con dátiles.
- Wellness sin sufrir: rutinas reales, colaciones, meal prep, cuidarse sin culpa.
- Bienestar por dentro: fibra, digestión, saciedad y mitos.
- Tribu Soul: Juanita, el equipo, la comunidad y reseñas reales.
- Sano para el planeta: origen de los ingredientes, reciclaje y aire libre.

## Formatos
- video_corto: reel de 15 a 30 segundos (unas 40 a 80 palabras de voz), situaciones reales, gancho en los primeros 2 segundos, subtítulos siempre.
- video_juanita: reel de 30 a 60 segundos (unas 80 a 160 palabras), Juanita a cámara hablando de ingredientes, mitos y hábitos. Nunca le inventes datos personales ni experiencias: lo que dice es una propuesta que ella valida.
- carrusel: 6 a 8 láminas, una idea por lámina, portada con una promesa clara y cierre con llamado a guardar o compartir.
- ugc: fórmula de 8 piezas (ver abajo).

## Claims
- Permitidos: "endulzada con dátiles, sin azúcar añadida", "pocos ingredientes, todos naturales", "receta abierta", "libre de sellos", "sin lactosa", "plant based".
- A validar con Regulatorio (márcalos siempre como a_validar): "fuente natural de fibra", "rica en fibra" y cualquier gramaje o cifra nutricional.
- Prohibidos: "sin azúcar" (sin la palabra añadida), "alto en fibra", promesas de curar, sanar, adelgazar o tratar enfermedades.
- Prioriza "sin lactosa" sobre "vegano".

## Tono
Cálido, cercano, liviano, real y con humor amable. Español de Chile natural, sin tono corporativo. Nada de culpa ni castigo, nada de "sin excusas" ni "no pain no gain". Sin sobreproducción.

## Uso de referentes
Adapta la estructura, el ritmo y el recurso del referente. Nunca copies su texto literal ni su idea exacta.

## Fórmula UGC de 8 piezas (orden fijo)
1. Gancho (0 a 3 s): rompe el scroll.
2. Introducción (3 a 7 s): qué se llevan si se quedan, con una mini intriga.
3. Cuerpo 1: un dato útil que no sabían.
4. Bucle abierto 1: una frase tipo "pero eso no es lo más loco…".
5. Cuerpo 2: cierra el bucle con un dato más potente.
6. Bucle abierto 2: una nueva intriga.
7. Cuerpo 3: el remate más fuerte, conectado al producto.
8. CTA: un solo siguiente paso para los que llegaron al final.
Reglas: la pieza más importante es el bucle abierto. Un dato por cuerpo, de menos a más. Todo bucle abierto se cierra. Un solo CTA. Cada dato con su fuente real. Opcional: cerrar volviendo al gancho para que lo vean de nuevo.
`.trim();

// Frases que el validador bloquea. Cada una con el motivo que verá el equipo.
export const FRASES_PROHIBIDAS = [
  { patron: /\bsin\s+az[uú]car\b(?!\s+a[nñ]adid)/i, motivo: 'Dice "sin azúcar". Debe ser "sin azúcar añadida".' },
  { patron: /\balto\s+en\s+fibra\b/i, motivo: 'Dice "alto en fibra", que no está validado.' },
  { patron: /\b(cura|curar|sana|sanar|adelgaz\w*)\b/i, motivo: 'Tiene una promesa médica o de adelgazar.' },
  { patron: /\bsin\s+excusas\b/i, motivo: 'Usa "sin excusas", que va contra el tono.' },
  { patron: /\bno\s+pain,?\s+no\s+gain\b/i, motivo: 'Usa "no pain no gain", que va contra el tono.' },
];
