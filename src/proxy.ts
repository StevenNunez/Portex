import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/admin", "/conserje", "/residente", "/onboarding", "/update-password", "/inicio"];
const AUTH_ONLY  = ["/login", "/register"];

/**
 * Antes se llamaba `middleware`. Next 16 renombró el archivo y la función a
 * `proxy` para dejar claro que esto corre en el borde de la red, antes de que
 * la petición llegue a la app.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Acá solo se verifica el JWT: nada de consultas a la base.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((r) => path.startsWith(r));
  const isAuthOnly  = AUTH_ONLY.some((r) => path.startsWith(r));

  // Sin sesión en una ruta protegida: al login.
  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Con sesión en login/register → /inicio, que reparte según el rol.
  // Acá no se consulta el perfil: la decisión vive en /inicio.
  if (user && isAuthOnly) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
