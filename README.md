# Wild Soul · Guiones

Herramienta interna para convertir referentes (reels y carruseles) y productos en guiones para Wild Soul. Sueltas un MP4 o las capturas de un carrusel, o eliges un producto para un UGC, y en uno o dos minutos tienes un guion editable con sus claims y fuentes marcados, listo para aprobar.

## Qué hace

- **Reels y videos:** el navegador saca el audio y hasta 15 cuadros, la herramienta transcribe y Claude escribe el guion adaptado a Soul.
- **Carruseles:** lee el texto de cada lámina y escribe un carrusel nuevo para Soul.
- **UGC:** con solo elegir el producto, investiga en la web y arma la fórmula de 8 piezas, con una fuente por cada dato.
- **Validación:** antes de entregar, el código revisa estructura, fuentes y frases prohibidas, y reintenta una vez si algo falla.
- **Revisión:** cada claim se marca como revisado antes de poder aprobar, y "Copiar para Notion" pega el guion como tabla.

## Puesta en marcha (unos 30 minutos)

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor**, pega el contenido de `supabase/schema.sql` y ejecútalo. Antes, agrega al final los correos del equipo que tendrán acceso.
3. En **Authentication > URL Configuration**:
   - **Site URL:** la URL de Vercel (por ejemplo `https://wild-soul-guiones.vercel.app`).
   - **Redirect URLs:** agrega `https://TU-DOMINIO/auth/callback` y, para probar en tu computador, `http://localhost:3000/auth/callback`.
4. En **Project Settings > API** copia la *Project URL* y la *anon public key*.

Para sumar a alguien después, en SQL Editor:

```sql
insert into public.permitidos (email) values ('nombre@thewildfoods.com');
```

### 2. API keys

- **Anthropic:** crea una key en console.anthropic.com y define un tope de gasto mensual.
- **OpenAI:** crea una key en platform.openai.com y define un tope de gasto mensual.
- **Modelos:** revisa en la documentación de cada proveedor que los nombres de `ANTHROPIC_MODEL` y `OPENAI_TRANSCRIBE_MODEL` sigan vigentes; cámbialos en las variables de entorno si no.

### 3. GitHub y Vercel

1. Sube esta carpeta a un repo nuevo en GitHub.
2. En [vercel.com](https://vercel.com) elige **Add New > Project**, importa el repo y agrega las variables de `.env.example` con sus valores reales.
3. Haz el deploy. Copia la URL final y ponla en el paso 1.3 de Supabase.

Las funciones usan hasta 300 segundos, que es el máximo del plan Hobby con fluid compute.

### 4. Prueba

1. Entra a la URL, pon tu correo y abre el link que te llega.
2. Suelta un reel corto y revisa que aparezca en "Por revisar".
3. Prueba un UGC y revisa que cada cuerpo tenga su fuente.

## Para trabajar en tu computador

```bash
npm install
cp .env.example .env.local   # completa los valores
npm run dev                  # http://localhost:3000
npm test                     # pruebas del validador
```

## Dónde se cambia cada cosa

| Qué | Archivo |
|---|---|
| Reglas de marca, claims y frases prohibidas | `lib/reglas.js` (sube `REGLAS_VERSION` al cambiarlo) |
| Productos para UGC, ejes, formatos y límites | `lib/catalogo.js` |
| Validaciones del guion | `lib/validar.js` |
| Llamadas a Claude y OpenAI | `lib/ia.js` |
| Procesamiento del video en el navegador | `lib/procesar.js` |
| Pantalla de inicio y biblioteca | `app/page.js` |
| Pantalla del guion | `app/guion/[id]/page.js` |
| Base de datos y permisos | `supabase/schema.sql` |

## Cosas a saber

- **Pestaña abierta:** el procesamiento lo dirige el navegador. No cierres la pestaña hasta que el guion aparezca en "Por revisar".
- **Videos del iPhone:** si Chrome no puede reproducir un MOV, la herramienta sigue solo con el audio y lo avisa. Si tampoco lee el audio, pide un MP4 o una grabación de pantalla.
- **Reintentar:** un referente que falla se reintenta volviendo a soltar el archivo, porque los videos no se guardan. Un UGC que falla se reintenta con un clic.
- **Costo:** cada guion guarda su costo estimado según los precios de `.env`. Ajústalos a los precios vigentes.
- **Edición después de aprobar:** si editas un guion aprobado, vuelve a "Por revisar".
