"use server";

import { getUserContext } from "@/lib/user-context";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import { formatoDeUnidad, type FormatoUnidad } from "@/lib/residentes";

/**
 * Cómo escribe este edificio sus códigos de unidad, y cuáles ya existen.
 *
 * Lo pide el formulario de "Nuevo residente" al abrirse, en vez de que la
 * página lo cargue siempre: el botón vive en dos pantallas y casi nunca se
 * abre, así que no vale la pena hacerle esa consulta a cada visita.
 */
export async function formatoDelPadron(): Promise<{
  formato: FormatoUnidad;
  existentes: string[];
}> {
  const vacio = { formato: { separador: "-", digitos: 0, torres: [] }, existentes: [] };

  const ctx = await getUserContext();
  if (!ctx?.buildingId) return vacio;

  const db = createServiceClient();
  const { data } = await db
    .from("residents")
    .select("unit_code")
    .eq("building_id", ctx.buildingId);

  const codigos = (data ?? []).map((r) => r.unit_code);
  return { formato: formatoDeUnidad(codigos), existentes: codigos };
}
