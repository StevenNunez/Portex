<div align="center">

<img src="public/icon-192.png" width="88" alt="Portex" />

# Portex

**El conserje no necesita otro software. Necesita que le crean.**

[portex.teolabs.app](https://portex.teolabs.app) · hecho por [Teo Labs](https://www.teolabs.app)

</div>

---

## El problema es un cuaderno

Son las once de la noche. Suena el timbre en el 1204 y una voz dice que viene a
dejar algo. El residente no sabe quién es. El conserje tampoco: anota un nombre
que no puede comprobar en un cuaderno que nadie va a leer, y decide solo si esa
persona sube o no.

Al otro día alguien reclama que le robaron una encomienda. La respuesta está en
ese cuaderno, con una letra que no se entiende, en una página que quizás se mojó.

Eso pasa hoy, esta noche, en miles de edificios. **Portex es el sistema que
reemplaza ese cuaderno** — y, sobre todo, el que hace que el residente sepa quién
está abajo antes de que suba.

## Qué hace

**Nadie entra sin que la unidad lo sepa.** El conserje digita el RUT; si la
persona trae un pase, aparece con nombre y departamento y entra de un toque. Si
no, se le avisa al departamento por notificación y el residente aprueba desde el
teléfono. La bitácora guarda **quién autorizó** cada ingreso, no solo quién entró.

**La visita llega con su QR.** El residente la anuncia desde su teléfono y le
manda el pase por WhatsApp. En portería se escanea, o se dictan seis dígitos si
la cámara falla — porque en portería siempre falla algo.

**La encomienda tiene dueño.** Se recibe a nombre del departamento, al residente
le llega el código de retiro, y quien la venga a buscar tiene que mostrarlo. Si
el conserje la entrega igual —la vecina de siempre—, queda escrito que fue sin
código. Esa diferencia es la que importa cuando alguien reclama.

**El personal marca su jornada.** Jardinero, aseo, mantención: marcan con su RUT
en la misma tablet. El administrador ve horas trabajadas y atrasos contra el
turno, y los exporta a la planilla de sueldos.

**El edificio se entera.** Llegó el de la empresa sanitaria a cortar el agua de
14:00 a 17:00: se publica el aviso y les suena el teléfono a las 312 unidades. No
al día siguiente, cuando ya se ducharon con agua fría.

**Y también:** estacionamientos de visita —incluidos los que un residente presta
mientras no usa el suyo—, padrón importado desde el Excel que ya tienen, turnos
del personal y reportes que abren en Excel sin pelear con las tildes.

## No es solo para condominios

La portería de un edificio residencial es el caso más difícil: pasa de todo, a
toda hora, y lo opera gente que no eligió trabajar con computadores. Lo que
funciona ahí funciona en cualquier lugar donde alguien anota quién entra:

oficinas corporativas · colegios · bodegas y centros de distribución · clínicas ·
coworking · obras en construcción · parques industriales · clubes deportivos

Mismo modelo: unidades, personas, accesos y una bitácora que aguanta que le
pregunten.

## Cómo está hecho

Next.js (App Router) · TypeScript · Supabase (Postgres + Auth) · PWA con
notificaciones push propias (VAPID). Sin librerías de UI: cada pantalla está
dibujada para el trabajo que hace.

Tres decisiones que explican casi todo el código:

- **El RUT es la identidad**, no un campo más. Con eso el sistema reconoce a quien
  ya vino antes y el conserje se ahorra escribir.
- **Cada pantalla hace una cosa.** La portería son cuatro tiles y un buscador. El
  conserje del turno de noche no debería tener que aprender nada.
- **El servidor no confía en el navegador.** Ningún id que viaja desde el cliente
  autoriza por sí solo: RLS deny-all y cada acción vuelve a preguntar a la base
  qué puede hacer esa sesión.

## Correrlo

```bash
npm install
cp .env.example .env.local     # completar con las credenciales
npx next dev --port 3010
```

El esquema y las migraciones están en `supabase/`, numeradas en el orden en que
se aplican. Cada una explica arriba **por qué existe**, no solo qué crea.

---

<div align="center">

Desarrollado por **[Teo Labs](https://www.teolabs.app)** ®

</div>
