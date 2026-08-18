import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

/**
 * Qué puede mirar un buscador.
 *
 * Público hay poco y es a propósito: la landing y los dos documentos legales.
 * Todo lo demás es la operación del edificio —el padrón, la bitácora, la
 * portería— y no tiene por qué estar en ningún índice, aunque igual esté
 * detrás del login: lo que no se rastrea no se filtra por una URL compartida
 * sin querer.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/terminos", "/privacidad"],
        disallow: [
          "/admin",
          "/conserje",
          "/residente",
          "/onboarding",
          "/inicio",
          "/auth/",
          "/login",
          "/register",
          "/reset-password",
          "/update-password",
        ],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  };
}
