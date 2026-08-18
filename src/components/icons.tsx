import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * La marca: una puerta con la bitácora adentro.
 *
 * El marco y el dintel son la puerta de siempre. Los tres renglones —larga,
 * corta, larga— son el cuaderno de portería que Portex reemplaza, y el punto
 * rojo del primer renglón hace doble lectura: es la manilla y es el registro
 * que acaba de entrar.
 *
 * Los tres renglones van centrados entre el dintel y la base del marco: con
 * el mismo aire arriba y abajo, el bloque se lee como un párrafo y no como
 * algo que se cayó al fondo de la puerta.
 *
 * **Bajo 22px suelta el renglón del medio.** A tamaño de header los tres
 * renglones se empastan en una mancha; con dos, la idea se lee igual. Es la
 * misma marca, dibujada para el tamaño en que se va a ver.
 */
export function IconMark({ size = 18, className, accent }: IconProps & { accent?: string }) {
  const rojo = accent ?? "var(--px-mark, #E01B22)";
  const compacto = size < 22;

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M4 14h16" />
      {compacto ? (
        <>
          <g strokeWidth="1.3" strokeLinecap="round">
            <path d="M6.7 16.3h7.1" />
            <path d="M6.7 18.7h7.1" />
          </g>
          <circle cx="16.8" cy="16.3" r="1.15" fill={rojo} stroke="none" />
        </>
      ) : (
        <>
          <g strokeWidth="1.15" strokeLinecap="round">
            <path d="M6.7 15.9h7.1" />
            <path d="M6.7 17.5h4.2" />
            <path d="M6.7 19.1h7.1" />
          </g>
          <circle cx="16.8" cy="15.9" r="1.05" fill={rojo} stroke="none" />
        </>
      )}
    </svg>
  );
}

export function IconSearch({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function IconArrowIn({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  );
}

export function IconArrowOut({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 12H6M11 7l-5 5 5 5" />
    </svg>
  );
}

export function IconParcel({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className={className}>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

export function IconCar({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 14l2-5h14l2 5" />
      <rect x="2" y="14" width="20" height="5" rx="1" />
      <circle cx="7" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </svg>
  );
}

export function IconPlus({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
