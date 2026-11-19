'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseNavegador } from '@/lib/supabase/client';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [estado, setEstado] = useState('inicio');
  const [mensaje, setMensaje] = useState('');

  async function entrar(e) {
    e.preventDefault();
    setEstado('enviando');
    setMensaje('');
    const { error } = await supabaseNavegador().auth.signInWithPassword({
      email: email.trim(),
      password: clave,
    });
    if (error) {
      setEstado('inicio');
      setMensaje('Correo o clave incorrectos.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="centro">
      <div className="tarjeta login">
        <span className="marca-logo" aria-hidden="true">WS</span>
        <h1>Wild Soul · Guiones</h1>
        <p>Entra con tu correo y clave de Wild Foods.</p>
        <form onSubmit={entrar}>
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@thewildfoods.com"
          />
          <label htmlFor="clave">Clave</label>
          <input
            id="clave"
            type="password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="••••••••"
          />
          <button className="boton boton-negro" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? 'Entrando…' : 'Entrar'}
          </button>
          {mensaje && <p className="error">{mensaje}</p>}
        </form>
      </div>
    </main>
  );
}
