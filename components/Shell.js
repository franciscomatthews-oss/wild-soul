'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabaseNavegador } from '@/lib/supabase/client';
import Icono from './Icono';

export const VISTAS = [
  { clave: 'revisar', nombre: 'Por revisar', icono: 'revisar', estados: ['procesando', 'por_revisar', 'error'], contar: ['procesando', 'por_revisar'] },
  { clave: 'aprobados', nombre: 'Aprobados', icono: 'aprobado', estados: ['aprobado'] },
  { clave: 'grilla', nombre: 'En grilla', icono: 'grilla', estados: ['en_grilla'] },
];

const iniciales = (email) =>
  (email.split('@')[0] || '?')
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

/**
 * Marco de la app: barra lateral con navegación y conteos, y barra superior con título.
 * @param {{ titulo: React.ReactNode, subtitulo?: string, insignia?: string, vista?: string, acciones?: React.ReactNode, conteos?: object, children: React.ReactNode }} props
 */
export default function Shell({ titulo, subtitulo, insignia, vista, acciones, conteos: conteosExternos, children }) {
  const ruta = usePathname();
  const [email, setEmail] = useState('');
  const [conteos, setConteos] = useState(conteosExternos || {});

  useEffect(() => {
    const supabase = supabaseNavegador();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
    if (conteosExternos) return;
    supabase
      .from('guiones')
      .select('estado')
      .then(({ data }) => {
        const c = {};
        (data || []).forEach((g) => { c[g.estado] = (c[g.estado] || 0) + 1; });
        setConteos(c);
      });
  }, [conteosExternos]);

  useEffect(() => { if (conteosExternos) setConteos(conteosExternos); }, [conteosExternos]);

  async function salir() {
    await supabaseNavegador().auth.signOut();
    window.location.href = '/login';
  }

  const total = (v) => (v.contar || v.estados).reduce((n, e) => n + (conteos[e] || 0), 0);

  return (
    <div className="app">
      <aside className="lateral">
        <Link href="/" className="marca">
          <span className="marca-logo" aria-hidden="true">WS</span>
          <span>Wild Soul</span>
        </Link>

        <nav className="nav" aria-label="Principal">
          <Link href="/" className={`nav-item ${ruta === '/' && !vista ? 'activo' : ''}`}>
            <Icono nombre="inicio" /> Inicio
          </Link>
          {VISTAS.map((v) => (
            <Link key={v.clave} href={`/?vista=${v.clave}`} className={`nav-item ${vista === v.clave ? 'activo' : ''}`}>
              <Icono nombre={v.icono} /> {v.nombre}
              {total(v) > 0 && <span className={`nav-conteo ${v.clave === 'revisar' ? 'azul' : ''}`}>{total(v)}</span>}
            </Link>
          ))}
        </nav>

        <div className="lateral-tarjeta">
          <span className="lateral-icono" aria-hidden="true"><Icono nombre="chispa" /></span>
          <p className="lateral-titulo">Meta de lanzamiento</p>
          <p className="lateral-texto">30 guiones aprobados antes de que parta diseño.</p>
          <div className="usuario">
            <span className="avatar" aria-hidden="true">{iniciales(email)}</span>
            <span className="usuario-email" title={email}>{email}</span>
            <button className="icono-boton" onClick={salir} aria-label="Salir"><Icono nombre="salir" /></button>
          </div>
        </div>
      </aside>

      <div className="principal">
        <header className="superior">
          <div className="superior-titulo">
            <div className="titulo-fila">
              {typeof titulo === 'string' ? <h1>{titulo}</h1> : titulo}
              {insignia && <span className="insignia">{insignia}</span>}
            </div>
            {subtitulo && <p className="subtitulo">{subtitulo}</p>}
          </div>
          {acciones && <div className="superior-acciones">{acciones}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}
