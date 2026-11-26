"use client";

/**
 * La "×" de los cajones. Mide 44 px, que es lo mínimo cómodo para un dedo en
 * la tablet de la portería (los de antes eran de 36 y había que apuntar), y
 * dice "Cerrar" a quien usa lector de pantalla: el "×" solo no dice nada.
 */
export default function BotonCerrar({
  onClick,
  disabled = false,
  etiqueta = "Cerrar",
}: {
  onClick: () => void;
  disabled?: boolean;
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      style={{
        background: "var(--px-paper)",
        border: "1px solid var(--px-line)",
        borderRadius: 22,
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        color: "var(--px-ink2)",
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
        padding: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M3 3l10 10M13 3L3 13" />
      </svg>
    </button>
  );
}
