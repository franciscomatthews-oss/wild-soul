import { NextResponse } from 'next/server';
import { exigirUsuarioPermitido } from '@/lib/supabase/server';
import { guionDesdeReferente, guionUGC } from '@/lib/ia';
import { REGLAS_VERSION } from '@/lib/reglas';
import { PRODUCTOS, LIMITES } from '@/lib/catalogo';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request) {
  const acceso = await exigirUsuarioPermitido();
  if (acceso.error) return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  const { supabase } = acceso;

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'La petición no es válida.' }, { status: 400 });
  }
  const { id, origen } = cuerpo;
  if (!id) return NextResponse.json({ error: 'Falta el id del guion.' }, { status: 400 });

  try {
    let resultado;
    const entrada = {};

    if (origen === 'producto') {
      if (!PRODUCTOS.includes(cuerpo.producto)) throw new Error('El producto no está en la lista.');
      resultado = await guionUGC({ producto: cuerpo.producto });
      entrada.notas_investigacion = resultado.notas;
    } else {
      const imagenes = (cuerpo.imagenes || []).slice(0, Math.max(LIMITES.imagenes, LIMITES.cuadros));
      resultado = await guionDesdeReferente({
        tipo: cuerpo.tipo,
        transcripcion: cuerpo.transcripcion,
        imagenes,
        nombreArchivo: cuerpo.nombre_archivo,
      });
      entrada.tipo = cuerpo.tipo;
      entrada.duracion_s = cuerpo.duracion_s || null;
      entrada.transcripcion_automatica = cuerpo.transcripcion || '';
    }

    const g = resultado.guion;
    entrada.texto_referente = g.texto_referente || '';

    const cambios = {
      titulo: g.titulo || 'Sin título',
      formato: g.formato,
      eje: g.eje,
      entrada,
      guion: {
        que_funciona: g.que_funciona || '',
        datos_faltantes: g.datos_faltantes || [],
        piezas: (g.piezas || []).map((p) => ({
          pieza: p.pieza || '',
          voz: p.voz || '',
          visual: p.visual || '',
          fuente_url: p.fuente_url || '',
          fuente_titulo: p.fuente_titulo || '',
          cierra_bucle: Boolean(p.cierra_bucle),
        })),
      },
      claims: (g.claims || []).map((c) => ({ texto: c.texto, tipo: c.tipo, revisado: false })),
      alertas: resultado.alertas,
      fuentes: resultado.fuentes || [],
      estado: 'por_revisar',
      reglas_version: REGLAS_VERSION,
      costo_usd: Number(((cuerpo.costo_previo || 0) + resultado.costo).toFixed(4)),
      error: null,
    };

    const { data, error } = await supabase.from('guiones').update(cambios).eq('id', id).select().single();
    if (error) throw new Error(`No pudimos guardar el guion: ${error.message}`);
    return NextResponse.json({ guion: data });
  } catch (e) {
    await supabase.from('guiones').update({ estado: 'error', error: e.message }).eq('id', id);
    return NextResponse.json({ error: e.message || 'No pudimos generar el guion.' }, { status: 500 });
  }
}
