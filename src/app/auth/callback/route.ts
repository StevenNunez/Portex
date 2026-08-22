import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // ── PKCE flow: code in query param ───────────────────────────────
  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (next) {
        return NextResponse.redirect(new URL(next, request.url));
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const orgIdInMeta = user.user_metadata?.organization_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id, role")
          .eq("id", user.id)
          .single();

        if (orgIdInMeta && !profile?.organization_id) {
          return NextResponse.redirect(new URL("/update-password", request.url));
        }

        if (!profile?.organization_id) {
          const createdAt   = user.created_at        ? new Date(user.created_at).getTime()        : 0;
          const confirmedAt = user.email_confirmed_at ? new Date(user.email_confirmed_at).getTime() : 0;
          const isFresh     = confirmedAt > 0
            && Date.now() - confirmedAt < 30 * 60 * 1000
            && confirmedAt - createdAt  < 24 * 60 * 60 * 1000;

          if (isFresh && user.email) {
            sendWelcomeEmail(user.email, user.user_metadata?.full_name as string | undefined).catch(() => {});
          }
          return NextResponse.redirect(new URL("/onboarding", request.url));
        }

        return NextResponse.redirect(new URL("/inicio", request.url));
      }

      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // ── Implicit flow: token arrives as hash fragment (#access_token=…) ──
  // The hash is never sent to the server, so we return a tiny HTML page
  // that reads the hash client-side and forwards it to /update-password
  // where the Supabase browser client will process it automatically.
  const nextPath = next ?? "/update-password";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Portex</title></head>
<body><script>
(function(){
  var h = window.location.hash;
  var dest = ${JSON.stringify(nextPath)};
  if (h && h.indexOf('access_token') !== -1) {
    // Forward the hash so the Supabase browser client can exchange it
    window.location.replace(dest + h);
    return;
  }
  // Supabase devuelve el motivo en el hash cuando el enlace ya se usó o
  // venció (\`error_code=otp_expired\`). Antes caía en un login mudo: la
  // persona veía "iniciar sesión" sin saber que su invitación se había
  // quemado. Ahora va a una página que lo dice y explica cómo seguir.
  if (h && h.indexOf('error') !== -1) {
    var p = new URLSearchParams(h.replace(/^#/, ''));
    var codigo = p.get('error_code') || p.get('error') || 'invalido';
    window.location.replace('/invitacion?error=' + encodeURIComponent(codigo));
    return;
  }
  window.location.replace('/invitacion?error=sin_token');
})();
</script></body></html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
