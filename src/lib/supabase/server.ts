import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * SUPABASE_URL (server-only) points at the Kong gateway over the docker
 * network (e.g. http://api-gw:8000) so route handlers running inside the
 * `crammer` container don't have to go back out through the host's
 * published port. Falls back to the public URL for `npm run dev`, where
 * there is no docker network and both browser and server reach Supabase
 * the same way.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render; middleware refreshes the session instead.
          }
        },
      },
    }
  );
}
