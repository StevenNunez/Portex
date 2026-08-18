import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { Section, P, UL, Strong, Mail } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Política de privacidad · Portex",
  description:
    "Qué datos guarda Portex, para qué, quién puede verlos y cómo pedir que se eliminen.",
};

const LINK = { color: "#f8f6f2", textDecoration: "underline" } as const;

export default function PrivacidadPage() {
  return (
    <LegalDoc
      title="Política de privacidad"
      intro="Portex guarda datos de personas reales: quién vive en el edificio y quién entró esta tarde. Acá está, sin vueltas, qué guardamos, por qué, quién lo ve y cómo se borra."
      updated="17 de agosto de 2026"
    >
      <Section n="01" title="Quién responde por estos datos">
        <P>
          Portex es operado por <Strong>Teo Labs</Strong>, Santiago de Chile. Contacto para
          cualquier tema de privacidad: <Mail />.
        </P>
        <P>
          Hay que distinguir dos papeles. El <Strong>condominio o edificio</Strong> que contrata
          Portex es el responsable de los datos que carga: decide qué se registra, a quién invita y
          por cuánto tiempo lo conserva. <Strong>Teo Labs es el encargado</Strong>: guardamos y
          procesamos esos datos para que el servicio funcione, siguiendo las instrucciones del
          cliente, y no los usamos para nada más. Si eres residente o visita de un edificio y
          quieres ejercer tus derechos, puedes escribirnos a nosotros o directamente a la
          administración de tu comunidad.
        </P>
      </Section>

      <Section n="02" title="Qué datos guardamos">
        <P>Solo lo que el servicio necesita para funcionar:</P>
        <UL
          items={[
            <>
              <Strong>Cuentas de usuario:</Strong> nombre, correo electrónico, rol
              (administrador, conserje o residente) y clave cifrada. La clave nunca se guarda
              legible ni la podemos ver.
            </>,
            <>
              <Strong>Padrón de residentes:</Strong> nombre, unidad o departamento, integrantes del
              hogar y etiquetas que agregue la administración.
            </>,
            <>
              <Strong>Registro de accesos (bitácora):</Strong> nombre y RUT de quien entra, unidad
              que visita, patente si aplica, tipo de movimiento, fecha y hora, y{" "}
              <Strong>quién autorizó el ingreso</Strong> — el conserje o el residente que dijo que
              sí.
            </>,
            <>
              <Strong>Visitantes frecuentes:</Strong> el RUT identifica a quien ya vino antes, con
              su nombre, la unidad que suele visitar y cuántas veces ha entrado. Es lo que permite
              que la segunda visita tome cinco segundos en vez de treinta.
            </>,
            <>
              <Strong>Encomiendas, vehículos y turnos del personal:</Strong> destinatario, patente,
              nombre del funcionario, RUT, horas trabajadas y valor hora si la administración lo
              carga.
            </>,
            <>
              <Strong>Avisos al teléfono:</Strong> la suscripción de notificaciones del navegador
              del residente y el tipo de dispositivo, para poder avisarle que alguien lo busca.
            </>,
          ]}
        />
        <P>
          <Strong>No pedimos ni guardamos datos de tarjetas de crédito</Strong>, ni instalamos
          rastreadores de publicidad, ni usamos cámaras, reconocimiento facial o lectura biométrica.
          Tampoco perfilamos ni tomamos decisiones automatizadas sobre las personas: quién entra al
          edificio lo decide siempre una persona.
        </P>
      </Section>

      <Section n="03" title="Para qué los usamos">
        <UL
          items={[
            "Prestar el servicio: registrar accesos, avisar al departamento, mantener el padrón y mostrar la bitácora a quien corresponde.",
            "Dejar trazabilidad: que la comunidad pueda reconstruir qué pasó y a qué hora si algo ocurre.",
            "Enviar correos operativos: invitaciones a la plataforma, recuperación de clave y avisos importantes del servicio.",
            "Mantener el sistema seguro y funcionando: registros técnicos para detectar fallas y accesos indebidos.",
          ]}
        />
        <P>
          <Strong>No vendemos datos a nadie.</Strong> No los compartimos con terceros para
          publicidad ni los usamos para entrenar modelos de inteligencia artificial.
        </P>
      </Section>

      <Section n="04" title="Quién puede verlos">
        <P>
          Cada cuenta está aislada por edificio y por rol, y esa separación se aplica en la base de
          datos, no solo en la pantalla:
        </P>
        <UL
          items={[
            <>
              El <Strong>conserje</Strong> ve la portería de su edificio: quién está adentro,
              encomiendas pendientes y el padrón para saber a qué unidad va la visita.
            </>,
            <>
              El <Strong>administrador</Strong> ve su edificio completo: padrón, bitácora, turnos y
              reportes.
            </>,
            <>
              El <Strong>residente</Strong> ve lo suyo: sus visitas anunciadas y las solicitudes de
              ingreso a su departamento. <Strong>No ve el padrón ni los datos de sus vecinos.</Strong>
            </>,
            <>
              Ningún edificio puede ver los datos de otro, y sin sesión iniciada no se lee
              absolutamente nada.
            </>,
          ]}
        />
        <P>
          Del lado de Teo Labs, el acceso técnico a la base de datos queda restringido a quienes
          mantienen el servicio, y solo se usa para operarlo o para resolver un problema que nos
          reporten.
        </P>
      </Section>

      <Section n="05" title="Con qué proveedores trabajamos">
        <P>
          Para que Portex funcione nos apoyamos en terceros que actúan como subencargados, bajo sus
          propios compromisos de seguridad:
        </P>
        <UL
          items={[
            <>
              <Strong>Supabase</Strong> — base de datos y autenticación, sobre infraestructura de
              Amazon Web Services. Los datos viajan cifrados y se guardan cifrados en reposo.
            </>,
            <>
              <Strong>Vercel</Strong> — alojamiento de la aplicación web.
            </>,
            <>
              <Strong>Servidor de correo propio</Strong> — para invitaciones y recuperación de
              clave.
            </>,
            <>
              <Strong>Servicios de notificación del navegador</Strong> (Apple, Google o Mozilla,
              según el teléfono del residente) — solo para hacer llegar el aviso. El contenido del
              mensaje viaja cifrado hasta el dispositivo.
            </>,
          ]}
        />
        <P>
          Esto implica que los datos pueden almacenarse o procesarse fuera de Chile. Cuando ocurre,
          exigimos que el proveedor mantenga un nivel de protección equivalente al de la ley chilena.
        </P>
      </Section>

      <Section n="06" title="Cuánto tiempo los conservamos">
        <P>
          La bitácora de accesos existe justamente para poder mirar hacia atrás, así que se conserva
          mientras la cuenta del edificio esté vigente.{" "}
          <Strong>Hoy no hay borrado automático por antigüedad</Strong>: si tu comunidad definió un
          plazo de conservación —por ejemplo, un año— escríbenos y lo aplicamos.
        </P>
        <P>
          Al cerrar la cuenta eliminamos todos los datos a los 30 días, salvo lo que la ley obligue
          a conservar. Los registros técnicos de seguridad se conservan por un período acotado y
          luego se descartan.
        </P>
      </Section>

      <Section n="07" title="Tus derechos">
        <P>
          La ley chilena te da derecho a <Strong>saber qué datos tuyos tenemos</Strong>, a pedir que
          se corrijan si están errados, a pedir que se eliminen cuando ya no haya razón para
          guardarlos y a oponerte a ciertos usos.
        </P>
        <P>
          Para ejercerlos escribe a <Mail /> desde tu correo, contándonos en qué edificio estás.
          Respondemos dentro de los plazos legales, y sin costo. Si el dato lo cargó tu comunidad,
          coordinamos la solicitud con la administración, porque es ella quien decide sobre ese
          registro.
        </P>
        <P>
          Aplicamos la <Strong>Ley 19.628</Strong> sobre protección de la vida privada y estamos
          adecuando el servicio a la <Strong>Ley 21.719</Strong>, que entra en vigencia en diciembre
          de 2026.
        </P>
      </Section>

      <Section n="08" title="Cookies">
        <P>
          Portex usa únicamente <Strong>cookies de sesión</Strong>: las que mantienen tu sesión
          abierta después de iniciarla. No hay cookies de publicidad, ni de analítica de terceros,
          ni píxeles de redes sociales. Si cierras sesión, se van.
        </P>
      </Section>

      <Section n="09" title="Seguridad y qué pasa si algo falla">
        <P>
          Las claves se guardan cifradas, el tráfico va por HTTPS, la separación entre edificios se
          impone en la propia base de datos y cada rol accede solo a lo suyo. Aun así, ningún
          sistema es infalible.
        </P>
        <P>
          Si ocurre un incidente que afecte datos personales,{" "}
          <Strong>avisaremos a los administradores de las cuentas afectadas</Strong> apenas lo
          confirmemos, contando qué pasó y qué estamos haciendo, y notificaremos a la autoridad
          cuando corresponda.
        </P>
      </Section>

      <Section n="10" title="Cambios a esta política">
        <P>
          Si cambiamos algo relevante actualizamos la fecha del encabezado y avisamos por correo a
          los administradores. Puedes revisar también los{" "}
          <Link href="/terminos" style={LINK}>
            Términos de servicio
          </Link>
          .
        </P>
      </Section>
    </LegalDoc>
  );
}
