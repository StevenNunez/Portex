import { savePushSubscription } from "@/app/citofono-actions";

/**
 * El lado navegador de las notificaciones.
 *
 * Lo usan dos pantallas muy distintas —el teléfono del residente y el kiosco
 * de la portería— y hacen exactamente lo mismo: pedir el permiso, registrar
 * el service worker y guardar la suscripción. Vive acá para que arreglarlo en
 * un lado lo arregle en los dos.
 */

export type PermisoPush = "granted" | "denied" | "default" | "no-soportado" | "desconocido";

export function getPushPermission(): PermisoPush {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "no-soportado";
  return Notification.permission;
}

/**
 * La Permissions API avisa cuando alguien cambia el permiso desde el
 * navegador. No todos lo exponen para `notifications`; si no está, la
 * suscripción no hace nada y el valor se lee igual en cada render.
 */
export function subscribePushPermission(onChange: () => void) {
  let status: PermissionStatus | undefined;
  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((s) => {
      status = s;
      s.addEventListener("change", onChange);
    })
    .catch(() => {});
  return () => status?.removeEventListener("change", onChange);
}

/** La clave VAPID viaja en base64url y el navegador la pide como bytes. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Pide el permiso y deja el dispositivo suscrito. Devuelve si quedó activo.
 *
 * Si la persona dice que no, no se insiste: el permiso queda como esté y el
 * botón vuelve a aparecer la próxima vez.
 */
export async function activarPush(vapidPublicKey: string): Promise<boolean> {
  if (!vapidPublicKey) return false;

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return false;

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
      await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Escucha los avisos que el service worker manda a la página abierta.
 *
 * La portería es un kiosco que no se cierra nunca: cuando llega un push, además
 * de la alerta conviene traer los datos nuevos sin que nadie recargue.
 */
export function escucharPush(alLlegar: () => void): () => void {
  if (!("serviceWorker" in navigator)) return () => {};

  const manejar = (e: MessageEvent) => {
    if (e.data?.tipo === "portex:push") alLlegar();
  };

  navigator.serviceWorker.addEventListener("message", manejar);
  return () => navigator.serviceWorker.removeEventListener("message", manejar);
}
