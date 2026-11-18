'use client';

import { createBrowserClient } from '@supabase/ssr';

let cliente;

export function supabaseNavegador() {
  if (!cliente) {
    cliente = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return cliente;
}
