import { NextResponse } from 'next/server';
import { exigirUsuarioPermitido } from '@/lib/supabase/server';
import { transcribir, costoAudio } from '@/lib/ia';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
  const acceso = await exigirUsuarioPermitido();
  if (acceso.error) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  try {
    const form = await request.formData();
    const audio = form.get('audio');
    const duracion = Number(form.get('duracion_s') || 0);
    if (!audio || typeof audio === 'string') {
      return NextResponse.json({ error: 'No llegó el audio.' }, { status: 400 });
    }
    const { texto } = await transcribir(audio, 'audio.wav');
    return NextResponse.json({ texto, costo: costoAudio(duracion) });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'No pudimos transcribir el audio.' }, { status: 500 });
  }
}
