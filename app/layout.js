import './globals.css';

export const metadata = {
  title: 'Wild Soul · Guiones',
  description: 'Generador de guiones para Wild Soul',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
