'use client';

import { supabaseNavegador } from '@/lib/supabase/client';

export default function SinAcceso() {
  async function salir() {
    await supabaseNavegador().auth.signOut();
    window.location.href = '/login';
  }
  return (
    <main className="centro">
      <div className="tarjeta login">
        <span className="marca-logo" aria-hidden="true">WS</span>
        <h1>No tienes acceso</h1>
        <p>Tu correo no está en la lista del equipo. Pídele a Francisco que te agregue.</p>
        <button className="boton boton-claro" onClick={salir} style={{ marginTop: 18 }}>Entrar con otro correo</button>
      </div>
    </main>
  );
}
