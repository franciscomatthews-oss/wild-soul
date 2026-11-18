// Íconos de línea simples (24x24, trazo 1.75). Se pintan con currentColor.
const TRAZOS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  revisar: 'M4 4h16v12H14l-2 3-2-3H4zM8 9h8M8 12h5',
  aprobado: 'M20 7 10 17l-5-5',
  grilla: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  salir: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  subir: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  chispa: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  flecha: 'M7 17 17 7M8 7h9v9',
  atras: 'M15 18l-6-6 6-6',
  video: 'M4 6h11v12H4zM15 10l5-3v10l-5-3z',
  carrusel: 'M7 5h10v14H7zM4 7v10M20 7v10',
  persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  megafono: 'M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  dinero: 'M12 3v18M16 7.5C16 6 14.2 5 12 5S8 6 8 8s2 2.6 4 3 4 1 4 3-1.8 3-4 3-4-1-4-2.5',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  basura: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  alerta: 'M12 4 2 20h20zM12 10v4M12 17v.5',
};

export default function Icono({ nombre, tamano = 18, className = '' }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={TRAZOS[nombre] || ''} />
    </svg>
  );
}

export const ICONO_FORMATO = {
  video_corto: 'video',
  video_juanita: 'persona',
  carrusel: 'carrusel',
  ugc: 'megafono',
};
