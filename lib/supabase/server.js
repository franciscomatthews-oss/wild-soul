import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabaseServidor() {
  const almacen = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return almacen.getAll();
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: el middleware refresca la sesión.
          }
        },
      },
    }
  );
}

/**
 * Devuelve { supabase, usuario } si la persona inició sesión y está en la lista de permitidos.
 * Si no, devuelve { error, status } para responder desde una ruta de API.
 */
export async function exigirUsuarioPermitido() {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Tienes que iniciar sesión.', status: 401 };
  const { data, error } = await supabase.rpc('es_permitido');
  if (error || data !== true) return { error: 'Tu correo no tiene acceso.', status: 403 };
  return { supabase, usuario: user };
}
