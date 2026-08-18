import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { appUrl } from "@/lib/app-url";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const DESCRIPCION =
  "Portex digitaliza la portería de condominios y edificios en Chile: visitas con " +
  "aviso al departamento, encomiendas con retiro verificado, estacionamientos, " +
  "asistencia del personal y bitácora de todo lo que pasa en la puerta.";

export const metadata: Metadata = {
  // Sin esto, las URLs de la tarjeta social salen relativas y WhatsApp no
  // muestra imagen.
  metadataBase: new URL(appUrl()),
  title: {
    default: "Portex · Control de acceso para condominios y edificios",
    template: "%s · Portex",
  },
  description: DESCRIPCION,
  keywords: [
    "control de acceso condominios",
    "software para condominios Chile",
    "conserjería digital",
    "bitácora de portería",
    "citófono digital",
    "registro de visitas edificio",
    "control de encomiendas",
    "turnos de conserjes",
  ],
  applicationName: "Portex",
  authors: [{ name: "Teo Labs", url: "https://www.teolabs.app" }],
  creator: "Teo Labs",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "Portex",
    url: "/",
    title: "Portex · Control de acceso para condominios y edificios",
    description: DESCRIPCION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Portex · Control de acceso para condominios y edificios",
    description: DESCRIPCION,
  },
  // El portal del residente se instala en el teléfono: sin esto no hay
  // notificaciones de visita en iOS.
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Portex" },
  // El favicon y el ícono de iOS los toma Next de `app/icon.svg` y
  // `app/apple-icon.png`: declararlos otra vez acá los duplicaría en el HTML.
  // Next 16 emite `mobile-web-app-capable`, que es el estándar nuevo. El
  // iPhone con iOS anterior a 15.4 todavía mira el de Apple, y el portal
  // del residente vive justo ahí.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#17130e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Datos estructurados: es lo que hace que un buscador entienda que esto es
  // un producto de software con precio y público, y no una página cualquiera.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Portex",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    url: appUrl(),
    description: DESCRIPCION,
    inLanguage: "es-CL",
    areaServed: { "@type": "Country", name: "Chile" },
    publisher: {
      "@type": "Organization",
      name: "Teo Labs",
      url: "https://www.teolabs.app",
      email: "portex@teolabs.app",
    },
  };

  return (
    <html lang="es">
      <body className={`${interTight.variable} ${jetbrainsMono.variable}`}>
        {/* Guarda la invitación a instalar que Chrome dispara antes de que
            React esté vivo. `InstallApp` la recoge de ahí. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__portexInstalar=null;" +
              "window.addEventListener('beforeinstallprompt',function(e){" +
              "e.preventDefault();window.__portexInstalar=e;" +
              "window.dispatchEvent(new Event('portex:instalable'));});",
          }}
        />
        <script
          type="application/ld+json"
          // El contenido es nuestro y es estático: no hay entrada de usuario
          // que pueda escaparse del JSON.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
