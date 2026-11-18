'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabaseNavegador } from '@/lib/supabase/client';
import { FORMATOS, ESTADOS, PRODUCTOS } from '@/lib/catalogo';
import { detectarTipo, procesarImagenes, procesarVideo } from '@/lib/procesar';
import Shell, { VISTAS } from '@/components/Shell';
import Icono, { ICONO_FORMATO } from '@/components/Icono';

const META = 30;

async function postJson(url, cuerpo) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || `Error ${r.status}`);
  return datos;
}

const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');

function Fila({ g, progreso, onReintentar, onEliminar }) {
  const enProceso = g.estado === 'procesando';
  const conError = g.estado === 'error';
  const meta = enProceso
    ? progreso || 'Procesando…'
    : conError
      ? g.error
      : [FORMATOS[g.formato], g.eje].filter(Boolean).join(' · ');
  const contenido = (
    <>
      <span className={`fila-icono ${conError ? 'error' : ''}`} aria-hidden="true">
        {enProceso ? <span className="girando" /> : <Icono nombre={conError ? 'alerta' : ICONO_FORMATO[g.formato] || 'chispa'} />}
      </span>
      <span className="fila-principal">
        <span className="fila-titulo">{g.titulo}</span>
        <span className="fila-meta">{meta}</span>
      </span>
    </>
  );
  return (
    <li className="fila">
      {enProceso || conError ? <div className="fila-cuerpo">{contenido}</div> : <Link className="fila-cuerpo" href={`/guion/${g.id}`}>{contenido}</Link>}
      <div className="fila-acciones">
        {conError && (
          <>
            <button className="boton-texto" onClick={() => onReintentar(g)}>Reintentar</button>
            <button className="boton-texto peligro" onClick={() => onEliminar(g.id)}>Eliminar</button>
          </>
        )}
        <span className="fila-fecha">{fechaCorta(g.creado_en)}</span>
        <span className={`chip chip-${g.estado}`}>{ESTADOS[g.estado]}</span>
      </div>
    </li>
  );
}

function Inicio() {
  const supabase = supabaseNavegador();
  const vista = useSearchParams().get('vista');
  const [guiones, setGuiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [arrastrando, setArrastrando] = useState(false);
  const [progreso, setProgreso] = useState({});
  const [aviso, setAviso] = useState('');
  const [producto, setProducto] = useState(PRODUCTOS[0]);
  const entradaRef = useRef(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('guiones')
      .select('id, titulo, formato, eje, estado, origen, producto, creado_en, error, costo_usd')
      .order('creado_en', { ascending: false })
      .limit(300);
    setGuiones(data || []);
    setCargando(false);
  }, [supabase]);

  useEffect(() => { cargar(); }, [cargar]);

  const hayProcesando = guiones.some((g) => g.estado === 'procesando');
  useEffect(() => {
    if (!hayProcesando) return undefined;
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [hayProcesando, cargar]);

  const conteos = useMemo(() => {
    const c = {};
    guiones.forEach((g) => { c[g.estado] = (c[g.estado] || 0) + 1; });
    return c;
  }, [guiones]);

  const resumen = useMemo(() => {
    const ahora = new Date();
    const costoMes = guiones
      .filter((g) => { const d = new Date(g.creado_en); return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear(); })
      .reduce((n, g) => n + Number(g.costo_usd || 0), 0);
    const listos = (conteos.aprobado || 0) + (conteos.en_grilla || 0);
    const porFormato = Object.keys(FORMATOS).map((k) => ({ clave: k, n: guiones.filter((g) => g.formato === k).length }));
    return { costoMes, listos, porFormato, totalConFormato: porFormato.reduce((n, f) => n + f.n, 0) };
  }, [guiones, conteos]);

  const marcar = (id, texto) => setProgreso((p) => ({ ...p, [id]: texto }));

  async function crearFila(campos) {
    const { data, error } = await supabase.from('guiones').insert({ estado: 'procesando', ...campos }).select().single();
    if (error) throw new Error(`No pudimos crear el guion: ${error.message}`);
    setGuiones((g) => [data, ...g]);
    return data.id;
  }

  async function fallar(id, mensaje) {
    await supabase.from('guiones').update({ estado: 'error', error: mensaje }).eq('id', id);
  }

  async function procesarArchivos(archivos) {
    setAviso('');
    let tipo;
    try {
      tipo = detectarTipo(archivos);
    } catch (e) {
      setAviso(e.message);
      return;
    }
    const lista = [...archivos];
    const nombre = tipo === 'video' ? lista[0].name : `${lista.length} capturas`;
    let id;
    try {
      id = await crearFila({ origen: 'referente', nombre_archivo: nombre, titulo: nombre });
    } catch (e) {
      setAviso(e.message);
      return;
    }
    try {
      if (tipo === 'video') {
        const v = await procesarVideo(lista[0], (t) => marcar(id, t));
        let transcripcion = '';
        let costo = 0;
        if (v.wav) {
          marcar(id, 'Transcribiendo');
          const form = new FormData();
          form.append('audio', v.wav, 'audio.wav');
          form.append('duracion_s', String(v.duracion));
          const r = await fetch('/api/transcribir', { method: 'POST', body: form });
          const datos = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(datos.error || 'No pudimos transcribir el audio.');
          transcripcion = datos.texto;
          costo = datos.costo || 0;
        }
        if (v.avisos.length) setAviso(v.avisos.join(' '));
        marcar(id, 'Escribiendo el guion');
        await postJson('/api/generar', {
          id, origen: 'referente', tipo: 'video', transcripcion, duracion_s: v.duracion,
          imagenes: v.cuadros, nombre_archivo: nombre, costo_previo: costo,
        });
      } else {
        marcar(id, 'Leyendo las láminas');
        const imagenes = await procesarImagenes(lista);
        marcar(id, 'Escribiendo el guion');
        await postJson('/api/generar', { id, origen: 'referente', tipo: 'carrusel', imagenes, nombre_archivo: nombre });
      }
    } catch (e) {
      await fallar(id, e.message);
      setAviso(e.message);
    } finally {
      marcar(id, null);
      cargar();
    }
  }

  async function hacerUGC(productoElegido = producto) {
    setAviso('');
    let id;
    try {
      id = await crearFila({ origen: 'producto', producto: productoElegido, titulo: `UGC ${productoElegido}` });
      marcar(id, 'Investigando y escribiendo');
      await postJson('/api/generar', { id, origen: 'producto', producto: productoElegido });
    } catch (e) {
      if (id) await fallar(id, e.message);
      setAviso(e.message);
    } finally {
      if (id) marcar(id, null);
      cargar();
    }
  }

  async function reintentar(g) {
    if (g.origen === 'producto') {
      await supabase.from('guiones').delete().eq('id', g.id);
      hacerUGC(g.producto);
    } else {
      setAviso('Para reintentar un referente, vuelve a soltar el archivo en "Nuevo guion".');
    }
  }

  async function eliminar(id) {
    await supabase.from('guiones').delete().eq('id', id);
    cargar();
  }

  const vistaActual = VISTAS.find((v) => v.clave === vista);
  const porRevisar = (conteos.por_revisar || 0) + (conteos.procesando || 0);

  const lista = (items, vacio) => (
    <ul className="lista">
      {cargando && <li className="vacio">Cargando…</li>}
      {!cargando && items.length === 0 && <li className="vacio">{vacio}</li>}
      {items.map((g) => (
        <Fila key={g.id} g={g} progreso={progreso[g.id]} onReintentar={reintentar} onEliminar={eliminar} />
      ))}
    </ul>
  );

  if (vistaActual) {
    const items = guiones.filter((g) => vistaActual.estados.includes(g.estado));
    return (
      <Shell
        titulo={vistaActual.nombre}
        subtitulo={`${items.length} guiones`}
        vista={vistaActual.clave}
        conteos={conteos}
        acciones={<Link href="/" className="boton boton-negro"><Icono nombre="subir" /> Nuevo guion</Link>}
      >
        {aviso && <p className="aviso" role="status">{aviso}</p>}
        <section className="tarjeta">
          <div className="segmentado" role="tablist">
            {VISTAS.map((v) => (
              <Link key={v.clave} href={`/?vista=${v.clave}`} role="tab" aria-selected={v.clave === vistaActual.clave} className={v.clave === vistaActual.clave ? 'activo' : ''}>
                {v.nombre}
              </Link>
            ))}
          </div>
          {lista(items, 'No hay guiones aquí todavía.')}
        </section>
      </Shell>
    );
  }

  const stats = [
    { clave: 'revisar', etiqueta: 'Por revisar', valor: porRevisar, icono: 'revisar', destacada: true },
    { clave: 'aprobados', etiqueta: 'Aprobados', valor: conteos.aprobado || 0, icono: 'aprobado' },
    { clave: 'grilla', etiqueta: 'En grilla', valor: conteos.en_grilla || 0, icono: 'grilla' },
    { clave: null, etiqueta: 'Costo este mes', valor: `US$ ${resumen.costoMes.toFixed(2)}`, icono: 'dinero' },
  ];
  const avance = Math.min(100, Math.round((resumen.listos / META) * 100));

  return (
    <Shell
      titulo="Guiones"
      subtitulo="Convierte referentes y productos en guiones para Wild Soul"
      insignia={porRevisar > 0 ? `${porRevisar} por revisar` : undefined}
      conteos={conteos}
    >
      <section className="stats">
        {stats.map((s) => (
          <div key={s.etiqueta} className={`stat ${s.destacada ? 'destacada' : ''}`}>
            <div className="stat-cabeza">
              <span className="stat-icono" aria-hidden="true"><Icono nombre={s.icono} /></span>
              {s.clave && (
                <Link href={`/?vista=${s.clave}`} className="stat-flecha" aria-label={`Ver ${s.etiqueta}`}>
                  <Icono nombre="flecha" />
                </Link>
              )}
            </div>
            <p className="stat-valor">{s.valor}</p>
            <p className="stat-etiqueta">{s.etiqueta}</p>
          </div>
        ))}
      </section>

      {aviso && <p className="aviso" role="status">{aviso}</p>}

      <section className="rejilla">
        <div className="tarjeta">
          <div className="tarjeta-cabeza">
            <h2><Icono nombre="subir" /> Nuevo guion</h2>
          </div>
          <div
            className={`zona ${arrastrando ? 'activa' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); procesarArchivos(e.dataTransfer.files); }}
          >
            <span className="zona-icono" aria-hidden="true"><Icono nombre="subir" tamano={22} /></span>
            <p className="zona-titulo">Arrastra un reel o las capturas de un carrusel</p>
            <p className="zona-sub">MP4 o MOV de hasta 2 minutos, o hasta 10 capturas</p>
            <button className="boton boton-claro" onClick={() => entradaRef.current?.click()}>Elegir archivos</button>
            <input
              ref={entradaRef}
              type="file"
              hidden
              multiple
              accept="video/*,image/*"
              onChange={(e) => { procesarArchivos(e.target.files); e.target.value = ''; }}
            />
          </div>
          <div className="ugc">
            <div className="ugc-texto">
              <p className="ugc-titulo">UGC de producto</p>
              <p className="ugc-sub">Investiga y arma las 8 piezas con fuentes</p>
            </div>
            <select value={producto} onChange={(e) => setProducto(e.target.value)} aria-label="Producto para el UGC">
              {PRODUCTOS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <button className="boton boton-negro" onClick={() => hacerUGC()}>Hacer UGC</button>
          </div>
        </div>

        <div className="tarjeta">
          <div className="tarjeta-cabeza">
            <h2><Icono nombre="chispa" /> Meta de lanzamiento</h2>
          </div>
          <div className="meta-numeros">
            <div>
              <p className="meta-etiqueta">Listos para grabar</p>
              <p className="meta-grande">{resumen.listos}<span>/{META}</span></p>
            </div>
            <div className="meta-anillo" style={{ '--avance': `${avance * 3.6}deg` }}>
              <span>{avance}%</span>
            </div>
          </div>
          <div className="barras">
            {resumen.porFormato.map((f, i) => {
              const pct = resumen.totalConFormato ? Math.round((f.n / resumen.totalConFormato) * 100) : 0;
              return (
                <div key={f.clave} className="barra-fila">
                  <div className="barra-texto"><span>{FORMATOS[f.clave]}</span><span>{f.n}</span></div>
                  <div className="barra-pista"><div className={`barra-relleno tono-${i}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="tarjeta">
        <div className="tarjeta-cabeza">
          <h2><Icono nombre="revisar" /> Recientes</h2>
          <Link href="/?vista=revisar" className="boton-texto">Ver todos</Link>
        </div>
        {lista(guiones.slice(0, 6), 'Todavía no hay guiones. Arrastra tu primer referente en "Nuevo guion".')}
      </section>
    </Shell>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <Inicio />
    </Suspense>
  );
}
