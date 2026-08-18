/**
 * El retiro de una encomienda se guarda como
 * "Encomienda retirada · <uuid>" porque ese id es lo que permite
 * descontarla de las pendientes. Al mostrarlo hay que sacar el uuid:
 * al administrador no le dice nada.
 */
export function displayContext(context: string | null): string | null {
  if (!context) return context;
  return context.replace(
    /^(Encomienda retirada) · [0-9a-f-]{36}$/i,
    "$1"
  );
}
