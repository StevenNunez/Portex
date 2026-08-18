import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { Section, P, UL, Strong, Mail } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Términos de servicio · Portex",
  description: "Condiciones de uso del servicio Portex, operado por Teo Labs.",
};

const LINK = { color: "#f8f6f2", textDecoration: "underline" } as const;

export default function TerminosPage() {
  return (
    <LegalDoc
      title="Términos de servicio"
      intro="Las reglas del trato entre quien usa Portex y quien lo opera. Están escritas para que se entiendan sin abogado al lado."
      updated="17 de agosto de 2026"
    >
      <Section n="01" title="Quién presta el servicio">
        <P>
          Portex es un producto de <Strong>Teo Labs</Strong>, con domicilio en Santiago de Chile.
          Cuando estos términos dicen &ldquo;nosotros&rdquo; se refieren a Teo Labs; cuando dicen
          &ldquo;tú&rdquo; o &ldquo;el cliente&rdquo;, a la comunidad, administración o empresa que
          contrata Portex y a las personas que usan el sistema en su nombre.
        </P>
        <P>
          Para cualquier tema de este documento, el canal es <Mail />.
        </P>
      </Section>

      <Section n="02" title="Qué hace Portex">
        <P>
          Portex es un sistema web de control de acceso para condominios, edificios y
          organizaciones. Permite registrar quién entra y quién sale, avisar al departamento antes
          de que alguien suba, llevar el padrón de residentes, las encomiendas, los vehículos y los
          turnos del personal.
        </P>
        <P>
          Es un servicio de software: no incluye hardware, torniquetes, cámaras, guardias ni
          servicio de vigilancia. <Strong>Portex no decide quién entra</Strong> — quien decide es
          siempre una persona del edificio: el conserje o el residente. El sistema registra esa
          decisión y quién la tomó.
        </P>
      </Section>

      <Section n="03" title="Cuentas, roles y responsabilidad">
        <P>
          Cada persona entra con su propio correo y clave. Hay tres roles:{" "}
          <Strong>administrador</Strong>, <Strong>conserje</Strong> y <Strong>residente</Strong>, y
          cada uno ve solamente lo que le corresponde.
        </P>
        <UL
          items={[
            <>
              El administrador de la cuenta es quien invita al personal y a los residentes, y es
              responsable de mantener esa lista al día: dar de baja al conserje que ya no trabaja en
              el edificio es tarea suya, no nuestra.
            </>,
            <>
              Las credenciales son personales e intransferibles. No compartas una cuenta entre
              turnos: si dos personas usan el mismo acceso, la bitácora deja de servir como
              respaldo.
            </>,
            <>
              Si sospechas que una cuenta quedó en manos equivocadas, avísanos a <Mail /> y
              cámbiale la clave de inmediato.
            </>,
          ]}
        />
      </Section>

      <Section n="04" title="Los datos de las personas del edificio">
        <P>
          Los datos que se cargan en Portex —residentes, visitas, RUT, patentes, horarios— son{" "}
          <Strong>del cliente, no nuestros</Strong>. El condominio, edificio u organización es el
          responsable del tratamiento de esos datos frente a las personas titulares; Teo Labs actúa
          como encargado, tratándolos únicamente para prestar el servicio y siguiendo tus
          instrucciones.
        </P>
        <P>
          Al cargar datos declaras que tienes fundamento para hacerlo y que informas a las personas
          del edificio que el ingreso queda registrado. El detalle de qué guardamos, por cuánto
          tiempo y con qué proveedores está en la{" "}
          <Link href="/privacidad" style={LINK}>
            Política de privacidad
          </Link>
          .
        </P>
      </Section>

      <Section n="05" title="Uso aceptable">
        <P>Al usar Portex te comprometes a no:</P>
        <UL
          items={[
            "Usar los datos de residentes o visitas para algo distinto del control de acceso y la operación del edificio — nada de marketing, venta de bases de datos ni curiosidad sobre los vecinos.",
            "Intentar acceder a datos de otro edificio u organización, ni a cuentas ajenas.",
            "Cargar datos falsos a sabiendas, ni alterar la bitácora para encubrir un hecho.",
            "Revender el servicio, ni automatizar accesos masivos que degraden el sistema para los demás.",
          ]}
        />
        <P>
          Si detectamos un uso así podemos suspender la cuenta. Cuando la situación lo permita
          avisaremos antes; si hay riesgo para los datos de terceros, actuamos primero y avisamos
          después.
        </P>
      </Section>

      <Section n="06" title="Planes, precios y marcha blanca">
        <P>
          Portex está en <Strong>marcha blanca</Strong>: hoy no hay cobro y las cuentas creadas
          durante esta etapa se usan sin costo. Los valores publicados en el sitio son los planes
          previstos, no un cobro vigente.
        </P>
        <P>
          Cuando empecemos a cobrar te lo avisaremos por correo con{" "}
          <Strong>al menos 30 días de anticipación</Strong>, y podrás decidir si sigues o te vas
          llevándote tus datos. Nunca se cobra sin que lo aceptes antes de forma expresa.
        </P>
      </Section>

      <Section n="07" title="Disponibilidad, soporte y límites reales">
        <P>
          Trabajamos para que Portex esté siempre arriba, pero{" "}
          <Strong>no comprometemos un porcentaje de disponibilidad</Strong> ni un tiempo de
          respuesta garantizado. Puede haber mantenciones e interrupciones, propias o de los
          proveedores de infraestructura.
        </P>
        <UL
          items={[
            <>
              Portex <Strong>necesita conexión a internet</Strong> en la portería. Si se corta, el
              conserje no puede registrar hasta que vuelva.
            </>,
            <>
              Los avisos al departamento dependen de las notificaciones del teléfono del residente:
              si tiene el teléfono apagado, sin datos o rechazó los permisos, el aviso no llega y la
              decisión vuelve al conserje.
            </>,
            <>El soporte es por correo a <Mail />, en horario hábil de Chile.</>,
          ]}
        />
      </Section>

      <Section n="08" title="De quién es cada cosa">
        <P>
          El software, la marca Portex, el diseño y el código son de Teo Labs. Que uses el servicio
          no te transfiere ningún derecho sobre ellos más allá de poder usarlo mientras la cuenta
          esté vigente.
        </P>
        <P>
          Tus datos siguen siendo tuyos. Puedes pedirnos una copia en cualquier momento escribiendo
          a <Mail />, y te la entregamos en un formato legible por máquina.
        </P>
      </Section>

      <Section n="09" title="Responsabilidad">
        <P>
          Portex es una herramienta de registro. No respondemos por lo que ocurra dentro del
          edificio, por las decisiones de acceso que tomen el conserje o los residentes, ni por
          daños causados por terceros que hayan ingresado.
        </P>
        <P>
          En lo que la ley permita, nuestra responsabilidad total frente a ti se limita a lo que
          hayas pagado por el servicio en los 12 meses anteriores al hecho. Mientras el servicio sea
          gratuito, esa cifra es cero — lo decimos derecho, no escondido en letra chica. Nada de
          esto limita la responsabilidad por dolo o culpa grave.
        </P>
      </Section>

      <Section n="10" title="Terminar la cuenta">
        <P>
          Puedes dejar de usar Portex cuando quieras, sin plazo de aviso ni multa: escríbenos a{" "}
          <Mail /> y cerramos la cuenta.
        </P>
        <P>
          Al cerrarla te entregamos una copia de tus datos si la pides.{" "}
          <Strong>Los eliminamos a los 30 días</Strong> del cierre, salvo lo que debamos conservar
          por obligación legal. También podemos terminar nosotros el servicio, avisando con 30 días
          y devolviéndote tus datos.
        </P>
      </Section>

      <Section n="11" title="Cambios a estos términos">
        <P>
          Si cambiamos algo relevante lo avisamos por correo a los administradores de cada cuenta y
          actualizamos la fecha del encabezado. Seguir usando Portex después del aviso significa que
          aceptas la nueva versión; si no la aceptas, puedes cerrar la cuenta bajo el punto
          anterior.
        </P>
      </Section>

      <Section n="12" title="Ley aplicable">
        <P>
          Estos términos se rigen por la ley chilena. Cualquier diferencia que no logremos resolver
          conversando se somete a los tribunales ordinarios de justicia de Santiago de Chile.
        </P>
      </Section>
    </LegalDoc>
  );
}
