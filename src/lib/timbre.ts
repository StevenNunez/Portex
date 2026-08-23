/**
 * El timbre del citófono.
 *
 * Una notificación del sistema suena una vez y se calla. Un citófono insiste
 * hasta que alguien contesta, y esa insistencia es justamente lo que hace que
 * se atienda. Como el sonido de una notificación web lo decide el sistema
 * operativo —no se puede mandar un tono propio en un push—, el timbre se toca
 * **desde la app**, que es donde sí mandamos nosotros.
 *
 * Se sintetiza en vez de cargar un archivo: son dos osciladores y pesa cero.
 * En un edificio con mala señal, un mp3 que no alcanza a bajar es un timbre
 * que no suena.
 *
 * El patrón imita al citófono de verdad: dos tonos alternados, un repique
 * corto, silencio, y otra vez. No es una sirena continua a propósito — algo
 * que no se puede callar termina con el teléfono en silencio para siempre, y
 * ahí se pierden todas las visitas.
 */

const TONO_ALTO = 880;   // La5
const TONO_BAJO = 660;   // Mi5
const DURACION_TONO = 0.28;
const REPIQUES = 3;      // cuántos pares suenan en cada tanda
const PAUSA_ENTRE_TANDAS = 2200;

export interface Timbre {
  detener: () => void;
}

/**
 * Empieza a sonar y no para hasta que se llame a `detener()`.
 *
 * Devuelve null si el navegador no deja crear audio —pasa cuando todavía no
 * hubo ninguna interacción con la página—. Quien llama debe seguir andando
 * igual: el timbre es un refuerzo, no el aviso.
 */
export function sonarTimbre(): Timbre | null {
  const Ctx =
    typeof window !== "undefined"
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;

  if (!Ctx) return null;

  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return null;
  }

  let vivo = true;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  function tanda() {
    if (!vivo) return;

    // El navegador suspende el contexto cuando la pestaña pasa a segundo
    // plano; al volver hay que despertarlo o el timbre queda mudo sin avisar.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const inicio = ctx.currentTime;

    for (let i = 0; i < REPIQUES * 2; i++) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = i % 2 === 0 ? TONO_ALTO : TONO_BAJO;

      const desde = inicio + i * DURACION_TONO;
      // Entrada y salida suaves: un tono que arranca de golpe suena a error
      // del parlante, no a timbre.
      vol.gain.setValueAtTime(0, desde);
      vol.gain.linearRampToValueAtTime(0.32, desde + 0.02);
      vol.gain.setValueAtTime(0.32, desde + DURACION_TONO - 0.06);
      vol.gain.linearRampToValueAtTime(0, desde + DURACION_TONO - 0.01);

      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start(desde);
      osc.stop(desde + DURACION_TONO);
    }

    const largoTanda = REPIQUES * 2 * DURACION_TONO * 1000;
    temporizador = setTimeout(tanda, largoTanda + PAUSA_ENTRE_TANDAS);
  }

  tanda();

  // Vibración en paralelo: en un teléfono en silencio —que es como anda medio
  // mundo— es lo único que se siente.
  const vibrar = setInterval(() => {
    if (vivo && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([300, 150, 300, 150, 300]);
    }
  }, 3000);
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([300, 150, 300, 150, 300]);
  }

  return {
    detener() {
      vivo = false;
      if (temporizador) clearTimeout(temporizador);
      clearInterval(vibrar);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0);
      ctx.close().catch(() => {});
    },
  };
}
