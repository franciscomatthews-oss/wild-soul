'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseNavegador } from '@/lib/supabase/client';
import { FORMATOS, EJES, ESTADOS } from '@/lib/catalogo';
import { validarGuion, hayBloqueos } from '@/lib/validar';
import { copiarParaNotion, copiarTexto } from '@/lib/copiar';
import Shell from '@/components/Shell';
import Icono from '@/components/Icono';

export default function PaginaGuion() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = supabaseNavegador();
  const [fila, setFila] = useState(null);
  const [usuario, setUsuario] = useState('');
  const [guardado, setGuardado] = useState('');
  const [mensaje, setMensaje] = useState('');
  const temporizador = useRef(null);
  const pendiente = useRef(null);

  useEffect(() => {
    supabase.from('guiones').select('*').eq('id', id).single().then(({ data }) => setFila(data));
    supabase.auth.getUser().then(({ data }) => setUsuario(data.user?.email || ''));
  }, [id, supabase]);

  const fuentesPermitidas = useMemo(
    () => (fila?.origen === 'producto' ? (fila.fuentes || []).map((f) => f.url) : null),
    [fila?.origen, fila?.fuentes]
  );

  const alertas = useMemo(() => {
    if (!fila?.guion) return [];
    return validarGuion({ formato: fila.formato, eje: fila.eje, piezas: fila.guion.piezas }, { fuentesPermitidas });
  }, [fila, fuentesPermitidas]);

  async function guardar(cambios) {
    setGuardado('Guardando…');
    const { error } = await supabase.from('guiones').update(cambios).eq('id', id);
    setGuardado(error ? 'No se pudo guardar' : 'Guardado');
  }

  // Cambia el estado local y guarda en Supabase 600 ms después del último cambio.
  function editar(cambios) {
    setFila((f) => {
      const volverARevision = f.estado === 'aprobado' || f.estado === 'en_grilla';
      const extra = volverARevision ? { estado: 'por_revisar', aprobado_por: null, aprobado_en: null } : {};
      pendiente.current = { ...(pendiente.current || {}), ...cambios, ...extra };
      if (volverARevision) setMensaje('Editaste un guion aprobado: volvió a Por revisar.');
      return { ...f, ...cambios, ...extra };
    });
    setGuardado('Sin guardar');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      const cambiosPendientes = pendiente.current;
      pendiente.current = null;
      if (cambiosPendientes) guardar(cambiosPendientes);
    }, 600);
  }

  useEffect(() => {
    if (!fila?.guion) return undefined;
    const t = setTimeout(() => { supabase.from('guiones').update({ alertas }).eq('id', id); }, 800);
    return () => clearTimeout(t);
  }, [alertas, fila?.guion, id, supabase]);

  if (!fila) {
    return (
      <Shell titulo="Guion">
        <section className="tarjeta"><p className="vacio">Cargando…</p></section>
      </Shell>
    );
  }

  const piezas = fila.guion?.piezas || [];
  const claims = fila.claims || [];
  const claimsPendientes = claims.filter((c) => !c.revisado).length;
  const bloqueos = hayBloqueos(alertas);
  const aprobado = fila.estado === 'aprobado' || fila.estado === 'en_grilla';
  const puedeAprobar = fila.estado === 'por_revisar' && claimsPendientes === 0 && !bloqueos;
  const esUGC = fila.formato === 'ugc';
  const pasosRevision = alertas.filter((a) => a.bloquea).length + claimsPendientes;

  const editarPieza = (i, campo, valor) => {
    const nuevas = piezas.map((p, j) => (j === i ? { ...p, [campo]: valor } : p));
    editar({ guion: { ...fila.guion, piezas: nuevas } });
  };

  const marcarClaim = (i) => {
    const nuevos = claims.map((c, j) => (j === i ? { ...c, revisado: !c.revisado } : c));
    setFila((f) => ({ ...f, claims: nuevos }));
    guardar({ claims: nuevos });
  };

  async function aprobar() {
    const cambios = { estado: 'aprobado', aprobado_por: usuario, aprobado_en: new Date().toISOString() };
    setFila((f) => ({ ...f, ...cambios }));
    await guardar(cambios);
    setMensaje('Guion aprobado.');
  }

  async function alCopiarNotion() {
    try {
      await copiarParaNotion(fila);
      setFila((f) => ({ ...f, estado: 'en_grilla' }));
      await guardar({ estado: 'en_grilla' });
      setMensaje('Copiado. Pégalo en Notion: llega como tabla. El guion pasó a En grilla.');
    } catch {
      setMensaje('No pudimos copiar. Prueba de nuevo.');
    }
  }

  async function alCopiarTexto() {
    try {
      await copiarTexto(fila);
      setMensaje('Texto copiado.');
    } catch {
      setMensaje('No pudimos copiar. Prueba de nuevo.');
    }
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar este guion? No se puede deshacer.')) return;
    await supabase.from('guiones').delete().eq('id', id);
    router.push('/');
  }

  const titulo = (
    <div className="titulo-guion">
      <Link href="/?vista=revisar" className="icono-boton" aria-label="Volver a la biblioteca"><Icono nombre="atras" /></Link>
      <input className="titulo-editable" value={fila.titulo} onChange={(e) => editar({ titulo: e.target.value })} aria-label="Título del guion" />
    </div>
  );

  return (
    <Shell
      titulo={titulo}
      subtitulo={[FORMATOS[fila.formato], fila.eje, fila.producto].filter(Boolean).join(' · ')}
      acciones={
        <>
          <span className="guardado" aria-live="polite">{guardado}</span>
          <span className={`chip chip-${fila.estado}`}>{ESTADOS[fila.estado]}</span>
        </>
      }
    >
      {mensaje && <p className="aviso" role="status">{mensaje}</p>}

      <section className="rejilla rejilla-guion">
        <div className="tarjeta">
          <div className="tarjeta-cabeza">
            <h2>Clasificación</h2>
          </div>
          <div className="selectores">
            <label>
              Formato
              <select value={fila.formato || ''} onChange={(e) => editar({ formato: e.target.value })}>
                {Object.entries(FORMATOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>
              Eje temático
              <select value={fila.eje || ''} onChange={(e) => editar({ eje: e.target.value })}>
                {EJES.map((e) => <option key={e}>{e}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className={`tarjeta ${pasosRevision === 0 ? 'tarjeta-lista' : ''}`}>
          <div className="tarjeta-cabeza">
            <h2>{pasosRevision === 0 ? 'Listo para aprobar' : `${pasosRevision} ${pasosRevision === 1 ? "pendiente" : "pendientes"} antes de aprobar`}</h2>
          </div>
          {alertas.length > 0 && (
            <ul className="alertas">
              {alertas.map((a, i) => (
                <li key={i} className={a.bloquea ? 'bloquea' : 'nota'}>
                  <Icono nombre="alerta" tamano={16} /> {a.mensaje}
                </li>
              ))}
            </ul>
          )}
          {claims.length > 0 && (
            <div className="claims">
              {claims.map((c, i) => (
                <label key={i} className="claim">
                  <input type="checkbox" checked={Boolean(c.revisado)} onChange={() => marcarClaim(i)} />
                  <span>{c.texto}</span>
                  {c.tipo === 'a_validar' && <span className="etiqueta">validar con Regulatorio</span>}
                </label>
              ))}
            </div>
          )}
          {alertas.length === 0 && claims.length === 0 && <p className="vacio">Sin alertas ni claims.</p>}
        </div>
      </section>

      <section className="tarjeta">
        <div className="tarjeta-cabeza">
          <h2>Guion</h2>
          <span className="meta">{piezas.length} {fila.formato === 'carrusel' ? 'láminas' : 'piezas'}</span>
        </div>
        <div className="tabla-guion" role="table" aria-label="Guion">
          <div className={`encabezado-tabla ${esUGC ? 'con-fuente' : ''}`} role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Pieza</span>
            <span role="columnheader">{fila.formato === 'carrusel' ? 'Texto de la lámina' : 'Voz'}</span>
            <span role="columnheader">Visual</span>
            {esUGC && <span role="columnheader">Fuente</span>}
          </div>
          {piezas.map((p, i) => (
            <div key={i} className={`fila-guion ${esUGC ? 'con-fuente' : ''}`} role="row">
              <span className="numero">{i + 1}</span>
              <textarea value={p.pieza} onChange={(e) => editarPieza(i, 'pieza', e.target.value)} rows={1} aria-label={`Nombre de la pieza ${i + 1}`} className="campo-pieza" />
              <textarea value={p.voz} onChange={(e) => editarPieza(i, 'voz', e.target.value)} rows={4} aria-label={`Voz de la pieza ${i + 1}`} />
              <textarea value={p.visual} onChange={(e) => editarPieza(i, 'visual', e.target.value)} rows={4} aria-label={`Visual de la pieza ${i + 1}`} />
              {esUGC && (
                <div className="fuente">
                  <input value={p.fuente_url} onChange={(e) => editarPieza(i, 'fuente_url', e.target.value)} placeholder="URL de la fuente" aria-label={`Fuente de la pieza ${i + 1}`} />
                  {p.fuente_url && <a href={p.fuente_url} target="_blank" rel="noreferrer">Abrir fuente</a>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <details className="tarjeta referente">
        <summary>{fila.origen === 'producto' ? 'Ver investigación y fuentes' : 'Ver referente'}</summary>
        {fila.guion?.que_funciona && (<><h3>Qué funciona</h3><p>{fila.guion.que_funciona}</p></>)}
        {fila.entrada?.texto_referente && (<><h3>Transcripción del referente</h3><pre>{fila.entrada.texto_referente}</pre></>)}
        {fila.entrada?.notas_investigacion && (<><h3>Notas de investigación</h3><pre>{fila.entrada.notas_investigacion}</pre></>)}
        {(fila.fuentes || []).length > 0 && (
          <>
            <h3>Fuentes encontradas</h3>
            <ul>{fila.fuentes.map((f) => <li key={f.url}><a href={f.url} target="_blank" rel="noreferrer">{f.titulo}</a></li>)}</ul>
          </>
        )}
        {(fila.guion?.datos_faltantes || []).length > 0 && (
          <>
            <h3>Falta confirmar</h3>
            <ul>{fila.guion.datos_faltantes.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </>
        )}
        <p className="meta">
          Reglas {fila.reglas_version} · costo estimado US$ {Number(fila.costo_usd || 0).toFixed(3)}
          {fila.aprobado_por ? ` · aprobado por ${fila.aprobado_por}` : ''}
        </p>
      </details>

      <div className="acciones">
        <button className="boton-texto peligro" onClick={eliminar}><Icono nombre="basura" tamano={16} /> Eliminar</button>
        <div className="acciones-derecha">
          <button className="boton boton-claro" onClick={alCopiarTexto}><Icono nombre="copiar" tamano={16} /> Copiar texto</button>
          <button className="boton boton-claro" onClick={alCopiarNotion} disabled={!aprobado} title={aprobado ? '' : 'Aprueba el guion antes de pasarlo a la grilla'}>
            <Icono nombre="grilla" tamano={16} /> Copiar para Notion
          </button>
          <button
            className={`boton ${aprobado ? 'boton-lima' : 'boton-negro'}`}
            onClick={aprobar}
            disabled={!puedeAprobar}
            title={bloqueos ? 'Corrige las alertas antes de aprobar' : claimsPendientes ? 'Marca los claims como revisados' : ''}
          >
            <Icono nombre="aprobado" tamano={16} /> {aprobado ? 'Aprobado' : 'Aprobar'}
          </button>
        </div>
      </div>
    </Shell>
  );
}
