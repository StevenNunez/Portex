# Plantillas de correo

Acá queda **solo la que sigue mandando Supabase**.

- `confirmation.html` → dashboard: **Authentication → Email Templates → Confirm
  signup**. Es el correo que confirma la dirección de quien se registra como
  administrador. Lo dispara `signUp` desde el navegador, así que el texto vive
  en el dashboard: hay que pegarlo a mano cada vez que se toque este archivo.

Las demás se fueron de acá el 25-ago-2026, cuando las invitaciones y la
recuperación de clave dejaron de pasar por el correo de Supabase:

| Antes | Ahora |
|---|---|
| `invite.html` | `enviarInvitacion` en `src/lib/email.ts` |
| `recovery.html` | `enviarRecuperacion` en `src/lib/email.ts` |
| `magiclink.html` | — nada la usaba |

El token lo emite `generarEnlaceDeAcceso` (`src/lib/auth-admin.ts`) con
`generate_link`, que **no manda correo**; el sobre sale del SMTP propio con
nodemailer. Con eso la plantilla se versiona con el código, no la limita el tope
de correos por hora de Supabase Auth, y el envío se puede mirar.

Lo que quedó pegado en el dashboard en los slots Invite / Reset / Magic Link ya
no lo dispara nada. No estorba; se puede dejar tal cual.
