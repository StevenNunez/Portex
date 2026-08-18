import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

/** Las tres páginas que un buscador puede ver. El resto vive tras el login. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const hoy = new Date();

  return [
    { url: base, lastModified: hoy, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/terminos`, lastModified: hoy, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacidad`, lastModified: hoy, changeFrequency: "yearly", priority: 0.3 },
  ];
}
