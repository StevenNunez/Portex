/**
 * Los tipos de aviso, sin nada de servidor adentro.
 *
 * Viven aparte de `lib/avisos` porque la portería los elige desde el
 * navegador (al registrar al proveedor que viene a hacer el trabajo) y ese
 * módulo es solo de servidor.
 */

export type NoticeKind =
  | "agua" | "luz" | "gas" | "internet" | "ascensor"
  | "fumigacion" | "obra" | "aseo" | "otro";

/** Cómo se llama cada trabajo cuando hay que escribirlo. */
export const NOTICE_LABEL: Record<NoticeKind, string> = {
  agua: "Corte de agua",
  luz: "Corte de luz",
  gas: "Corte de gas",
  internet: "Internet / TV cable",
  ascensor: "Ascensor",
  fumigacion: "Fumigación",
  obra: "Obra o mantención",
  aseo: "Aseo",
  otro: "Aviso",
};

/** Nombre corto, para los botones de la portería. */
export const NOTICE_CHIP: Record<NoticeKind, string> = {
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  internet: "Internet",
  ascensor: "Ascensor",
  fumigacion: "Fumigación",
  obra: "Obra",
  aseo: "Aseo",
  otro: "Otro",
};

export const NOTICE_KINDS = Object.keys(NOTICE_CHIP) as NoticeKind[];
