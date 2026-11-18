'use client';

import { useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('inicio');
  const [mensaje, setMensaje] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setEstado('enviando');
    const { error } = await supabaseNavegador().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setEstado('inicio');
      setMensaje('No pudimos mandar el link. Revisa el correo e intenta de nuevo.');
      return;
    }
    setEstado('enviado');
  }

  return (
    <main className="centro">
      <div className="tarjeta login">
        <span className="marca-logo" aria-hidden="true">WS</span>
        <h1>Wild Soul · Guiones</h1>
        <p>Entra con tu correo de Wild Foods.</p>
        {estado === 'enviado' ? (
          <p>Te mandamos un link a <strong>{email}</strong>. Ábrelo en este mismo navegador para entrar.</p>
        ) : (
          <form onSubmit={enviar}>
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@thewildfoods.com"
            />
            <button className="boton boton-negro" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando…' : 'Recibir link para entrar'}
            </button>
            {mensaje && <p className="error">{mensaje}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
