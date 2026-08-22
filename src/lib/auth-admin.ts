import "server-only";

/**
 * Buscar una cuenta por su correo.
 *
 * `supabase.auth.admin` no expone esto: `listUsers` solo pagina, así que
 * encontrar a alguien obligaba a recorrer todos los usuarios del proyecto.
 * El endpoint de GoTrue sí acepta `?filter=`, y es lo que se usa acá.
 *
 * Hace falta cuando el administrador invita a un residente que **ya tiene
 * cuenta** (por ejemplo, porque también arrienda en otra unidad): la
 * invitación falla con "already been registered" y hay que ligar la cuenta
 * existente a la unidad. Antes eso se resolvía buscando el perfil por
 * `full_name`, lo que en un edificio con dos "Juan Pérez" ligaba el
 * departamento a la persona equivocada.
 */
export async function buscarUsuarioPorEmail(
  email: string
): Promise<{ id: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
  );

  if (!res.ok) return null;

  const datos = (await res.json()) as { users?: { id: string; email?: string }[] };
  const objetivo = email.trim().toLowerCase();

  // El filtro es una búsqueda parcial: "ana@mail.com" también trae
  // "mariana@mail.com". La coincidencia exacta la hacemos acá.
  const exacto = (datos.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === objetivo
  );

  return exacto ? { id: exacto.id, email: exacto.email ?? objetivo } : null;
}
