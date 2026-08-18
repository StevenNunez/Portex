"use client";

import { QR_PREFIJO } from "@/lib/qr";
import QrCodigo, { codigoLegible } from "./QrCodigo";

/**
 * El pase de visita, como lo ve quien viene: QR para que el conserje lo
 * escanee y seis dígitos para decirlos en voz alta.
 */

interface Props {
  token: string;
  code: string;
  visitorName: string;
  unitCode: string;
  validUntil: string;
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { timeZone: "America/Santiago",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default function PaseQR({ token, code, visitorName, unitCode, validUntil }: Props) {
  const texto =
    `Pase de visita en ${unitCode} para ${visitorName}.\n` +
    `Código en portería: ${codigoLegible(code)} · válido hasta las ${hora(validUntil)}.`;

  return (
    <QrCodigo
      contenido={QR_PREFIJO + token}
      code={code}
      textoCompartir={texto}
      etiquetaBoton="Enviar a mi visita"
      alt={`Código QR del pase de ${visitorName}`}
      pie={`Sirve hasta las ${hora(validUntil)}. El conserje escanea el QR o digita el código.`}
    />
  );
}
