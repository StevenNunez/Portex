/**
 * Prueba el SMTP configurado, sin levantar la app.
 *
 *   node scripts/probar-correo.mjs tu-correo@ejemplo.com
 *
 * Sirve para saber si un proveedor nuevo quedó bien conectado **antes** de que
 * un conserje de verdad dependa de eso: se conecta, autentica y manda un correo
 * de prueba. Las credenciales salen de `.env.local`; acá no se escribe ninguna.
 *
 * Los tres errores que más aparecen al cambiar de proveedor:
 *   EAUTH            → usuario o clave malos. En Brevo la clave es la **clave
 *                      SMTP**, no la de la cuenta; y suele arrastrar un espacio
 *                      al copiarla.
 *   ETIMEDOUT/ECONN  → host o puerto malos, o la red bloquea el saliente.
 *   550 / sender     → el remitente (EMAIL_FROM) no está autenticado en el
 *                      proveedor todavía.
 */

import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";

// ── .env.local ───────────────────────────────────────────────────────────────
function cargarEnv(ruta = ".env.local") {
  let texto;
  try {
    texto = readFileSync(ruta, "utf8");
  } catch {
    console.error(`No encontré ${ruta}. Córrelo desde la raíz del proyecto.`);
    process.exit(1);
  }

  for (const linea of texto.split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const i = limpia.indexOf("=");
    if (i === -1) continue;
    const clave = limpia.slice(0, i).trim();
    const valor = limpia.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

cargarEnv();

const destino = process.argv[2];
if (!destino) {
  console.error("Uso: node scripts/probar-correo.mjs tu-correo@ejemplo.com");
  process.exit(1);
}

const host = process.env.EMAIL_HOST;
const puerto = Number(process.env.EMAIL_PORT ?? 465);
const usuario = process.env.EMAIL_USER;
const clave = process.env.EMAIL_PASS;
const remitente = process.env.EMAIL_FROM ?? "portex@teolabs.app";

if (!host || !usuario || !clave) {
  console.error("Faltan EMAIL_HOST, EMAIL_USER o EMAIL_PASS en .env.local.");
  process.exit(1);
}

console.log(`Servidor  ${host}:${puerto} (${puerto === 465 ? "TLS directo" : "STARTTLS"})`);
console.log(`Usuario   ${usuario}`);
console.log(`Remitente ${remitente}`);
console.log(`Destino   ${destino}\n`);

// Mismo transporte que `src/lib/email.ts`: si acá funciona, la app también.
const transporter = nodemailer.createTransport({
  host,
  port: puerto,
  secure: puerto === 465,
  auth: { user: usuario, pass: clave },
});

try {
  await transporter.verify();
  console.log("✓ Conexión y credenciales correctas");
} catch (e) {
  console.error("✗ No se pudo conectar o autenticar:", e.message);
  process.exit(1);
}

try {
  const info = await transporter.sendMail({
    from: `"Portex" <${remitente}>`,
    to: destino,
    subject: "Prueba de correo de Portex",
    text:
      "Si estás leyendo esto, el SMTP de Portex quedó bien configurado.\n\n" +
      `Servidor: ${host}:${puerto}\nRemitente: ${remitente}\n\n` +
      "—\nPortex · Teo Labs",
    html:
      '<div style="font-family:system-ui,sans-serif;color:#1E1B17;line-height:1.6">' +
      "<p><strong>Si estás leyendo esto, el SMTP de Portex quedó bien configurado.</strong></p>" +
      `<p style="color:#5A5652">Servidor: ${host}:${puerto}<br/>Remitente: ${remitente}</p>` +
      '<p style="color:#9A9690;font-size:13px">— Portex · Teo Labs</p></div>',
  });

  console.log("✓ Correo aceptado por el servidor:", info.response);
  console.log("\nRevisa la bandeja —y la carpeta de no deseados, que es donde");
  console.log("cae un dominio nuevo—. Si llegó, la app puede mandar correo.");
} catch (e) {
  console.error("✗ El servidor rechazó el envío:", e.message);
  process.exit(1);
}
