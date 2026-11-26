import nodemailer from "nodemailer";
import { appUrl } from "./app-url";

const PUERTO = Number(process.env.EMAIL_PORT ?? 465);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: PUERTO,
  // 465 es TLS desde el saludo; 587 y el resto arrancan en claro y suben con
  // STARTTLS. Estaba fijo en `true`, así que cambiar de proveedor —o apuntar a
  // un servidor de prueba— colgaba el envío sin decir por qué.
  secure: PUERTO === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * De quién sale el correo, que **no** es lo mismo que con qué usuario nos
 * conectamos al SMTP.
 *
 * Con Zoho coincidían —el usuario era `portex@teolabs.app`— y por eso el
 * remitente salía de `EMAIL_USER`. Con un relay como Brevo el usuario es algo
 * como `9a1b2c001@smtp-brevo.com`: si el remitente se sigue sacando de ahí,
 * todas las invitaciones salen firmadas por una dirección que no es de Portex
 * y que nadie reconoce. `EMAIL_FROM` es la dirección visible; el dominio tiene
 * que estar autenticado en el proveedor.
 */
const REMITENTE = process.env.EMAIL_FROM ?? "portex@teolabs.app";
const FROM = `"Portex" <${REMITENTE}>`;

/**
 * Todo correo sale con `html` **y** `text`.
 *
 * Un correo sin alternativa en texto plano suma puntos de spam, y con un
 * dominio nuevo —sin historial de reputación— eso alcanza para caer en no
 * deseados. Además es lo que ven los relojes, los lectores de pantalla y
 * quien tiene las imágenes bloqueadas.
 */
async function enviar(correo: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await transporter.sendMail({ from: FROM, ...correo });
}

/** ¿Hay SMTP configurado? Sin él, el aviso de errores ni lo intenta. */
export function smtpConfigurado(): boolean {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

/** Para meter texto ajeno (un mensaje de error, un nombre) dentro del HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * "Desarrollado por Teo Labs ®", con cada letra de un color del degradado
 * azul → morado → verde: los clientes de correo no hacen texto con degradado.
 */
const FIRMA_TEO_LABS =
  `Desarrollado por <a href="https://www.teolabs.app" target="_blank" rel="noopener noreferrer" style="text-decoration:none;font-weight:bold;">` +
  `<span style="color:#2563eb;">T</span><span style="color:#4f46e5;">e</span><span style="color:#7c3aed;">o</span> ` +
  `<span style="color:#a855f7;">L</span><span style="color:#8b5cf6;">a</span><span style="color:#22c55e;">b</span><span style="color:#16a34a;">s</span>` +
  `</a> ®`;

// ── Shared layout ────────────────────────────────────────────────────────────
function layout(content: string, preheader?: string): string {
  // El preheader es el resumen que se ve en la bandeja antes de abrir. Va
  // oculto: sin él, el cliente de correo muestra las primeras palabras del HTML.
  const oculto = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F9F7F4;opacity:0;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Portex</title>
</head>
<body style="margin:0;padding:0;background:#F9F7F4;font-family:'Inter',system-ui,sans-serif;color:#1E1B17;">
  ${oculto}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:#F9F7F4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:560px;">
          <!-- Marca: logo arriba del nombre, igual que en la app.
               En PNG y no en SVG: los clientes de correo borran el <svg>. -->
          <tr>
            <td style="padding-bottom:8px;text-align:center;">
              <img src="${appUrl()}/logo-portex.png" width="34" height="34" alt="Portex"
                style="display:inline-block;width:34px;height:34px;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:22px;font-weight:700;letter-spacing:-0.045em;color:#1E1B17;">
                Portex
              </span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border:1px solid #ECEAE5;border-radius:16px;padding:40px 36px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center;font-size:12px;color:#9A9690;line-height:1.6;">
              © ${new Date().getFullYear()} Teo Labs · Portex<br />
              <a href="mailto:portex@teolabs.app"
                style="color:#9A9690;text-decoration:underline;">portex@teolabs.app</a><br />
              ${FIRMA_TEO_LABS}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string): string {
  return `<a href="${url}"
    style="display:inline-block;padding:12px 28px;background:#1E1B17;color:#F9F7F4;
    border-radius:8px;font-size:14px;font-weight:600;letter-spacing:-0.02em;
    text-decoration:none;margin-top:28px;">${text}</a>`;
}

/** El círculo con emoji que abre la tarjeta de invitación y la de recuperación. */
function burbuja(emoji: string, fondo: string): string {
  return `<div style="text-align:center;margin-bottom:26px;">
    <div style="display:inline-block;width:52px;height:52px;border-radius:50%;
      background:${fondo};line-height:52px;text-align:center;font-size:24px;">${emoji}</div>
  </div>`;
}

/** El pie de todo correo, en su versión de texto plano. */
const PIE_TEXTO =
  "\n\n—\nPortex · Teo Labs\nportex@teolabs.app\nDesarrollado por Teo Labs ® · https://www.teolabs.app";

// ── Welcome (sent after email confirmation) ──────────────────────────────────
export async function sendWelcomeEmail(
  to: string,
  name?: string | null
): Promise<void> {
  const greeting = name ? `¡Hola, ${name.split(" ")[0]}!` : "¡Bienvenido/a a Portex!";
  const url = appUrl();

  const html = layout(
    `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;letter-spacing:-0.03em;color:#1E1B17;">
      ${greeting}
    </h1>
    <p style="margin:0 0 6px;font-size:15px;color:#5A5652;line-height:1.6;">
      Tu cuenta fue confirmada con éxito.
    </p>
    <p style="margin:0;font-size:15px;color:#5A5652;line-height:1.6;">
      Con Portex puedes gestionar el acceso a tu condominio, invitar conserjes y
      llevar el control de visitantes — todo desde un solo lugar.
    </p>
    <hr style="border:none;border-top:1px solid #ECEAE5;margin:28px 0;" />
    <p style="margin:0;font-size:14px;color:#7D7A75;line-height:1.6;">
      Para comenzar, configura tu condominio y agrega los edificios y torres que correspondan.
    </p>
    ${btn("Ir al panel →", `${url}/onboarding`)}
  `,
    "Tu cuenta Portex está confirmada. Configura tu condominio para empezar."
  );

  const text =
    `${greeting}\n\n` +
    "Tu cuenta fue confirmada con éxito.\n\n" +
    "Con Portex puedes gestionar el acceso a tu condominio, invitar conserjes y " +
    "llevar el control de visitantes — todo desde un solo lugar.\n\n" +
    "Para comenzar, configura tu condominio y agrega los edificios y torres que correspondan:\n" +
    `${url}/onboarding` +
    PIE_TEXTO;

  await enviar({ to, subject: "¡Tu cuenta Portex está lista!", html, text });
}

// ── Invitación ───────────────────────────────────────────────────────────────
//
// La manda **la app**, no Supabase. `generarEnlaceDeAcceso` (lib/auth-admin.ts)
// emite el token sin despachar correo; el sobre sale de acá. Así la plantilla
// vive en el repo —se acabó pegarla a mano en el dashboard cada vez que se
// toca— y no la limita el tope de correos por hora de Supabase Auth.
//
// La `url` ya viene apuntando a /invitacion?token_hash=…: abrir ese enlace no
// gasta el token; se canjea recién cuando la persona aprieta el botón.

export async function enviarInvitacion(datos: {
  to: string;
  url: string;
  nombre?: string | null;
  /** Un reenvío a quien ya fue invitado y nunca entró. Cambia solo el texto. */
  reenvio?: boolean;
}): Promise<void> {
  const saludo = datos.nombre?.trim()
    ? `Hola, ${datos.nombre.trim().split(" ")[0]}:`
    : null;

  const html = layout(
    `
    ${burbuja("👋", "#F0F7F1")}
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#1E1B17;text-align:center;">
      Te invitaron a Portex
    </h1>
    ${
      saludo
        ? `<p style="margin:0 0 6px;font-size:15px;color:#5A5652;line-height:1.65;text-align:center;">${saludo}</p>`
        : ""
    }
    <p style="margin:0 0 6px;font-size:15px;color:#5A5652;line-height:1.65;text-align:center;">
      Tu edificio empezó a usar <strong>Portex</strong> para registrar las visitas,
      las encomiendas y quién entra — y te dieron acceso.
    </p>
    <p style="margin:0;font-size:15px;color:#5A5652;line-height:1.65;text-align:center;">
      Crea tu contraseña para acceder — te toma menos de un minuto.
    </p>
    <div style="text-align:center;">
      ${btn("Crear contraseña →", datos.url)}
    </div>
    <hr style="border:none;border-top:1px solid #ECEAE5;margin:36px 0 24px;" />
    <p style="margin:0;font-size:12px;color:#9A9690;line-height:1.6;text-align:center;">
      Si no esperabas esta invitación, puedes ignorar este correo.<br />
      Este enlace es de un solo uso y expira en 24 horas.
    </p>
  `,
    "Te invitaron a Portex. Crea tu contraseña para empezar."
  );

  const text =
    "Te invitaron a Portex\n\n" +
    (saludo ? `${saludo}\n\n` : "") +
    "Tu edificio empezó a usar Portex para registrar las visitas, las encomiendas " +
    "y quién entra — y te dieron acceso.\n\n" +
    `Crea tu contraseña acá (te toma menos de un minuto):\n${datos.url}\n\n` +
    "Si no esperabas esta invitación, puedes ignorar este correo. " +
    "Este enlace es de un solo uso y expira en 24 horas." +
    PIE_TEXTO;

  await enviar({
    to: datos.to,
    subject: datos.reenvio
      ? "Tu invitación a Portex sigue esperando"
      : "Te invitaron a Portex",
    html,
    text,
  });
}

// ── Recuperación de contraseña ───────────────────────────────────────────────

export async function enviarRecuperacion(datos: {
  to: string;
  url: string;
}): Promise<void> {
  const html = layout(
    `
    ${burbuja("🔑", "#F5F3EF")}
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#1E1B17;text-align:center;">
      Recupera tu contraseña
    </h1>
    <p style="margin:0;font-size:15px;color:#5A5652;line-height:1.65;text-align:center;">
      Pediste volver a entrar a Portex. Elige una contraseña nueva y listo.
    </p>
    <div style="text-align:center;">
      ${btn("Elegir contraseña →", datos.url)}
    </div>
    <hr style="border:none;border-top:1px solid #ECEAE5;margin:36px 0 24px;" />
    <p style="margin:0;font-size:12px;color:#9A9690;line-height:1.6;text-align:center;">
      Si no fuiste tú, ignora este correo: tu contraseña sigue siendo la misma.<br />
      Este enlace es de un solo uso y expira en 24 horas.
    </p>
  `,
    "Elige una contraseña nueva para entrar a Portex."
  );

  const text =
    "Recupera tu contraseña\n\n" +
    `Pediste volver a entrar a Portex. Elige una contraseña nueva acá:\n${datos.url}\n\n` +
    "Si no fuiste tú, ignora este correo: tu contraseña sigue siendo la misma. " +
    "Este enlace es de un solo uso y expira en 24 horas." +
    PIE_TEXTO;

  await enviar({ to: datos.to, subject: "Recupera tu contraseña de Portex", html, text });
}

// ── Lo único que sigue mandando Supabase ─────────────────────────────────────
//
// La confirmación de correo del registro (Confirm signup): la dispara `signUp`
// desde el navegador y su plantilla vive en el dashboard
// (`supabase/email-templates/confirmation.html`). Las invitaciones y la
// recuperación de clave ya no pasan por ahí.

// ── Aviso de error nuevo (para Teo Labs, no para el condominio) ──────────────
//
// Lo manda `lib/errores-servidor.ts` la primera vez que aparece un error, y
// solo desde producción. Va a `AVISO_ERRORES_A` → `ADMIN_EMAIL` →
// hola@teolabs.app.

export async function enviarAvisoDeError(datos: {
  to: string;
  donde: string;
  mensaje: string;
  filas: [string, string][];
}): Promise<void> {
  const html = layout(
    `
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9A9690;">
      Registro de errores
    </p>
    <h1 style="margin:0 0 18px;font-size:20px;font-weight:700;letter-spacing:-0.03em;color:#1E1B17;border-left:3px solid #D63A2B;padding-left:10px;">
      Apareció un error nuevo
    </h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.55;color:#1E1B17;">
      ${datos.filas
        .map(
          ([k, v]) =>
            `<tr><td style="padding:2px 16px 2px 0;color:#7D7A75;vertical-align:top;">${escaparHtml(k)}</td><td style="padding:2px 0;word-break:break-word;">${escaparHtml(v)}</td></tr>`
        )
        .join("")}
    </table>
    <pre style="margin:18px 0 0;padding:12px;background:#F5F3EF;border-radius:8px;font-size:13px;white-space:pre-wrap;word-break:break-word;color:#1E1B17;">${escaparHtml(datos.mensaje)}</pre>
    <p style="margin:18px 0 0;font-size:13px;color:#7D7A75;line-height:1.6;">
      El detalle está en Supabase → tabla <strong>errores</strong>. Si se repite,
      no vuelve a avisar hasta marcarlo resuelto.
    </p>
  `,
    `Error nuevo en Portex · ${escaparHtml(datos.donde)}`
  );

  const text =
    "Apareció un error nuevo en Portex.\n\n" +
    datos.filas.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\n${datos.mensaje}\n\n` +
    "El detalle está en Supabase → tabla errores. Si se repite, no vuelve a avisar hasta marcarlo resuelto." +
    PIE_TEXTO;

  await enviar({
    to: datos.to,
    subject: `Error nuevo en Portex · ${datos.donde}`.slice(0, 180),
    html,
    text,
  });
}
