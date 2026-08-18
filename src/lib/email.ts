import nodemailer from "nodemailer";
import { appUrl } from "./app-url";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = `"Portex" <${process.env.EMAIL_USER ?? "portex@teolabs.app"}>`;

// ── Shared layout ────────────────────────────────────────────────────────────
function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Portex</title>
</head>
<body style="margin:0;padding:0;background:#F9F7F4;font-family:'Inter',system-ui,sans-serif;color:#1E1B17;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:#F9F7F4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:560px;">
          <!-- Logo -->
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
                style="color:#9A9690;text-decoration:underline;">portex@teolabs.app</a>
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

// ── Welcome (sent after email confirmation) ──────────────────────────────────
export async function sendWelcomeEmail(
  to: string,
  name?: string | null
): Promise<void> {
  const greeting = name ? `¡Hola, ${name.split(" ")[0]}!` : "¡Bienvenido/a a Portex!";
  const url = appUrl();

  const html = layout(`
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
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: "¡Tu cuenta Portex está lista!",
    html,
  });
}

// ── Invitaciones y recuperación de clave ─────────────────────────────────────
//
// No se mandan desde acá: las manda **Supabase Auth**, porque es quien emite
// el enlace con el token de un solo uso (`inviteUserByEmail`, `resetPasswordForEmail`).
// Sus plantillas en español están en `supabase/email-templates/` y hay que
// pegarlas en el dashboard (Authentication → Email Templates), junto con el
// SMTP propio (Project Settings → Auth → SMTP): con el servidor que trae
// Supabase por defecto se caen las invitaciones apenas se manden unas pocas
// seguidas.
